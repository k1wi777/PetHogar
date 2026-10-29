import 'reflect-metadata';
import { request as httpRequest } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import helmet from 'helmet';
import request from 'supertest';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { crearValidationPipe } from '../../src/common/pipes/validation.pipe';
import { MailModule } from '../../src/modules/mail/mail.module';
import { PruebasModule } from '../../src/modules/pruebas/pruebas.module';
import { servirArchivosPublicos } from '../../src/modules/storage/archivos-estaticos';
import { StorageModule } from '../../src/modules/storage/storage.module';
import { STORAGE_SERVICE, type IStorageService } from '../../src/modules/storage/storage.interface';

// V9: requiere Mailpit levantado (SMTP_HOST/SMTP_PORT y MAILPIT_UI_PORT; por defecto 1025/8025).
const SMTP_HOST = process.env.SMTP_HOST ?? 'localhost';
const SMTP_PORT = process.env.SMTP_PORT ?? '1025';
const MAILPIT_API = `http://${process.env.MAILPIT_HOST ?? 'localhost'}:${process.env.MAILPIT_UI_PORT ?? '8025'}/api/v1`;

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('contenido-png-real'),
]);
const PDF = Buffer.from('%PDF-1.7\ncontenido-pdf-real\n%%EOF');

interface MensajeMailpit {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

async function buscarMensajes(destinatario: string): Promise<MensajeMailpit[]> {
  const res = await fetch(`${MAILPIT_API}/messages`);
  const cuerpo = (await res.json()) as { messages: MensajeMailpit[] };
  return cuerpo.messages.filter((m) => m.To.some((t) => t.Address === destinatario));
}

/** Solo borra los mensajes de la prueba, no el buzón completo. */
async function borrarMensajes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await fetch(`${MAILPIT_API}/messages`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  });
}

/** GET sin normalizar la ruta (supertest/fetch la normalizarían y ocultarían el `..`). */
function getCrudo(base: string, ruta: string): Promise<number> {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: url.hostname, port: url.port, path: ruta, method: 'GET' },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('V9 — infraestructura real (Mailpit y disco)', () => {
  let raiz: string;
  let app: NestExpressApplication;
  let storage: IStorageService;
  let urlApp: string;
  const mensajesCreados: string[] = [];

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    raiz = await mkdtemp(path.join(tmpdir(), 'pethogar-infra-'));
    const modulo = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              PORT: 0,
              SMTP_HOST,
              SMTP_PORT: Number(SMTP_PORT),
              SMTP_FROM: 'PetHogar <no-reply@pethogar.local>',
              UPLOADS_DIR: raiz,
              API_PUBLIC_URL: 'http://localhost:3001',
              HABILITAR_ENDPOINTS_PRUEBA: 'true',
            }),
          ],
        }),
        StorageModule,
        MailModule,
        PruebasModule,
      ],
    }).compile();
    app = modulo.createNestApplication<NestExpressApplication>();
    app.use(helmet());
    servirArchivosPublicos(app, raiz);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(crearValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0);
    urlApp = await app.getUrl();
    urlApp = urlApp.replace('[::1]', 'localhost');
    storage = app.get<IStorageService>(STORAGE_SERVICE);
  });

  afterAll(async () => {
    await borrarMensajes(mensajesCreados);
    await app?.close();
    jest.restoreAllMocks();
    await rm(raiz, { recursive: true, force: true });
  });

  describe('correo', () => {
    it('entrega un correo de prueba real a Mailpit, en español', async () => {
      const para = `v9-${Date.now()}@example.com`;
      const res = await request(app.getHttpServer())
        .post('/api/pruebas/correo')
        .send({ destinatario: para })
        .expect(200);
      expect(res.body).toEqual({ enviado: true });

      const mensajes = await buscarMensajes(para);
      mensajesCreados.push(...mensajes.map((m) => m.ID));
      expect(mensajes).toHaveLength(1);
      expect(mensajes[0].Subject).toBe('Correo de prueba de PetHogar');
    });

    it('no lanza ni rompe la operación si el SMTP no responde', async () => {
      const { SmtpMailService } = await import('../../src/modules/mail/smtp-mail.service');
      const { createTransport } = await import('nodemailer');
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const caido = new SmtpMailService(
        createTransport({ host: '127.0.0.1', port: 1, connectionTimeout: 2000 }),
        'PetHogar <no-reply@pethogar.local>',
      );
      const r = await caido.enviar({
        para: 'ana@example.com',
        plantilla: 'prueba',
        datos: { nombre: 'Ana' },
      });
      expect(r.enviado).toBe(false);
      expect(r.error).toBeTruthy();
    });
  });

  describe('archivos', () => {
    it('sirve por HTTP el archivo público con cabeceras seguras', async () => {
      const subida = await request(app.getHttpServer())
        .post('/api/pruebas/archivos')
        .field('categoria', 'imagen')
        .field('carpeta', 'pruebas-publicas')
        .attach('archivo', PNG, { filename: 'x.jpg', contentType: 'image/jpeg' })
        .expect(201);
      const clave = subida.body.clave as string;
      expect(existsSync(path.join(raiz, clave))).toBe(true);
      expect((await readFile(path.join(raiz, clave))).equals(PNG)).toBe(true);

      const ruta = `/uploads/${clave.slice('publico/'.length)}`;
      expect(subida.body.url).toBe(`http://localhost:3001${ruta}`);
      const res = await fetch(`${urlApp}${ruta}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/png');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
      expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
    });

    it('guarda el archivo privado en disco pero no lo expone bajo /uploads', async () => {
      const subida = await request(app.getHttpServer())
        .post('/api/pruebas/archivos')
        .field('categoria', 'documento')
        .field('carpeta', 'pruebas-privadas')
        .attach('archivo', PDF, 'doc.pdf')
        .expect(201);
      const clave = subida.body.clave as string;
      expect(subida.body.url).toBeUndefined();
      expect(existsSync(path.join(raiz, clave))).toBe(true);

      const nombre = clave.split('/').slice(1).join('/');
      expect(await getCrudo(urlApp, `/uploads/${nombre}`)).toBe(404);
      expect(await getCrudo(urlApp, `/uploads/${clave}`)).toBe(404);
      expect(await getCrudo(urlApp, `/uploads/../${clave}`)).toBe(404);
      expect(await getCrudo(urlApp, `/uploads/%2e%2e/${clave}`)).toBe(404);
      expect(await getCrudo(urlApp, `/uploads/..%2f${clave}`)).toBe(404);
    });

    it('no permite escapar del directorio de uploads con claves o carpetas maliciosas', async () => {
      const canario = path.join(path.dirname(raiz), `canario-${path.basename(raiz)}.txt`);
      await writeFile(canario, 'no me borres');
      try {
        const relativa = path.relative(raiz, canario);
        await expect(storage.eliminar(relativa)).rejects.toThrow();
        await expect(
          storage.eliminar(`publico/mascotas/../../../${path.basename(canario)}`),
        ).rejects.toThrow();
        await request(app.getHttpServer())
          .post('/api/pruebas/archivos')
          .field('categoria', 'imagen')
          .field('carpeta', '../../fuera')
          .attach('archivo', PNG, 'x.png')
          .expect(400);
        expect(existsSync(canario)).toBe(true);
        expect(existsSync(path.join(path.dirname(raiz), 'fuera'))).toBe(false);
      } finally {
        await rm(canario, { force: true });
      }
    });
  });
});
