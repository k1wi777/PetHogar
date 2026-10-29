import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AllExceptionsFilter } from '../../common/filters/http-exception.filter';
import { crearValidationPipe } from '../../common/pipes/validation.pipe';
import { MAIL_SERVICE, type IMailService } from '../mail/mail.interface';
import { LocalStorageService } from '../storage/local-storage.service';
import { MAX_BYTES } from '../storage/storage.constants';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import { EndpointsPruebaGuard } from './endpoints-prueba.guard';
import { PruebasController } from './pruebas.controller';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);
const PDF = Buffer.from('%PDF-1.7\n%%EOF');

async function crearApp(
  habilitar: string | undefined,
  raiz: string,
  mail: IMailService,
): Promise<INestApplication> {
  const modulo = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        load: [() => ({ HABILITAR_ENDPOINTS_PRUEBA: habilitar })],
      }),
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ],
    controllers: [PruebasController],
    providers: [
      EndpointsPruebaGuard,
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      {
        provide: STORAGE_SERVICE,
        useValue: new LocalStorageService({ directorio: raiz, urlBase: 'http://api.test' }),
      },
      { provide: MAIL_SERVICE, useValue: mail },
    ],
  }).compile();
  const app = modulo.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(crearValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

describe('PruebasController', () => {
  let raiz: string;
  let app: INestApplication;
  const mail = { enviar: jest.fn() };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    raiz = await mkdtemp(path.join(tmpdir(), 'pethogar-pruebas-'));
    mail.enviar.mockReset().mockResolvedValue({ enviado: true });
  });

  afterEach(async () => {
    await app?.close();
    jest.restoreAllMocks();
    await rm(raiz, { recursive: true, force: true });
  });

  describe.each([undefined, 'false'])('con HABILITAR_ENDPOINTS_PRUEBA=%s', (flag) => {
    it('responde 404 en ambos endpoints y no toca disco ni SMTP', async () => {
      app = await crearApp(flag, raiz, mail);
      await request(app.getHttpServer())
        .post('/api/pruebas/archivos')
        .field('categoria', 'imagen')
        .field('carpeta', 'pruebas-publicas')
        .attach('archivo', PNG, 'a.png')
        .expect(404);
      await request(app.getHttpServer())
        .post('/api/pruebas/correo')
        .send({ destinatario: 'a@b.co' })
        .expect(404);
      expect(mail.enviar).not.toHaveBeenCalled();
      expect(await readdir(raiz)).toEqual([]);
    });
  });

  describe('con HABILITAR_ENDPOINTS_PRUEBA=true', () => {
    beforeEach(async () => {
      app = await crearApp('true', raiz, mail);
    });

    it('sube un archivo público y devuelve clave y URL', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/pruebas/archivos')
        .field('categoria', 'imagen')
        .field('carpeta', 'pruebas-publicas')
        .attach('archivo', PNG, { filename: 'foto.jpg', contentType: 'image/jpeg' })
        .expect(201);
      expect(res.body.clave).toMatch(/^publico\/pruebas-publicas\/.+\.png$/);
      expect(res.body.url).toMatch(/^http:\/\/api\.test\/uploads\/pruebas-publicas\/.+\.png$/);
    });

    it('sube un archivo privado y devuelve solo la clave', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/pruebas/archivos')
        .field('categoria', 'documento')
        .field('carpeta', 'pruebas-privadas')
        .attach('archivo', PDF, 'doc.pdf')
        .expect(201);
      expect(res.body.clave).toMatch(/^privado\/pruebas-privadas\/.+\.pdf$/);
      expect(res.body.url).toBeUndefined();
    });

    it('rechaza en español un PDF como imagen, un falso JPG y una carpeta inválida', async () => {
      const subir = (buffer: Buffer, nombre: string, categoria: string, carpeta: string) =>
        request(app.getHttpServer())
          .post('/api/pruebas/archivos')
          .field('categoria', categoria)
          .field('carpeta', carpeta)
          .attach('archivo', buffer, nombre);
      const pdf = await subir(PDF, 'a.pdf', 'imagen', 'pruebas-publicas').expect(400);
      expect(pdf.body.message).toContain('Solo se permiten imágenes JPG o PNG');
      await subir(Buffer.from('MZ ejecutable'), 'a.jpg', 'imagen', 'pruebas-publicas').expect(400);
      const carpeta = await subir(PNG, 'a.png', 'imagen', '../fuera').expect(400);
      expect(JSON.stringify(carpeta.body)).toContain('La carpeta de destino no es válida');
      expect(await readdir(raiz)).toEqual([]);
    });

    it('rechaza con 413 un archivo de más de 5 MB y con 400 si falta el archivo', async () => {
      const grande = Buffer.concat([PNG, Buffer.alloc(MAX_BYTES)]);
      const res = await request(app.getHttpServer())
        .post('/api/pruebas/archivos')
        .field('categoria', 'imagen')
        .field('carpeta', 'pruebas-publicas')
        .attach('archivo', grande, 'grande.png')
        .expect(413);
      expect(JSON.stringify(res.body)).toContain('5 MB');
      await request(app.getHttpServer())
        .post('/api/pruebas/archivos')
        .field('categoria', 'imagen')
        .field('carpeta', 'pruebas-publicas')
        .expect(400);
      expect(await readdir(raiz)).toEqual([]);
    });

    it('envía el correo de prueba y responde 200 aunque el envío falle', async () => {
      await request(app.getHttpServer())
        .post('/api/pruebas/correo')
        .send({ destinatario: 'ana@example.com' })
        .expect(200, { enviado: true });
      expect(mail.enviar).toHaveBeenCalledWith(
        expect.objectContaining({ para: 'ana@example.com', plantilla: 'prueba' }),
      );

      mail.enviar.mockResolvedValue({ enviado: false, error: 'ECONNREFUSED' });
      await request(app.getHttpServer())
        .post('/api/pruebas/correo')
        .send({ destinatario: 'ana@example.com' })
        .expect(200, { enviado: false });
    });

    it('valida el destinatario', async () => {
      await request(app.getHttpServer())
        .post('/api/pruebas/correo')
        .send({ destinatario: 'no-es-correo' })
        .expect(400);
    });

    it('aplica un límite propio de 10 peticiones por minuto', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/api/pruebas/correo')
          .send({ destinatario: 'ana@example.com' })
          .expect(200);
      }
      await request(app.getHttpServer())
        .post('/api/pruebas/correo')
        .send({ destinatario: 'ana@example.com' })
        .expect(429);
    });
  });
});
