import 'reflect-metadata';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { ES_PUBLICA } from '../../common/auth/public.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AllExceptionsFilter } from '../../common/filters/http-exception.filter';
import { CatalogosController } from './catalogos.controller';
import { CatalogosService } from './catalogos.service';

describe('CatalogosController', () => {
  let app: INestApplication;
  const servicio = { listarEspecies: jest.fn(), listarRazas: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
      ],
      controllers: [CatalogosController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: CatalogosService, useValue: servicio },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  it('las dos rutas son públicas y llevan límite propio', () => {
    const reflector = new Reflector();
    for (const metodo of ['listarEspecies', 'listarRazas'] as const) {
      const handler = CatalogosController.prototype[metodo];
      expect(reflector.get(ES_PUBLICA, handler)).toBe(true);
      expect(Reflect.getMetadataKeys(handler).some((k) => String(k).includes('THROTTLER'))).toBe(
        true,
      );
    }
  });

  it('GET /especies responde sin token', async () => {
    servicio.listarEspecies.mockResolvedValue([{ id: 1, nombre: 'perro' }]);
    const res = await request(app.getHttpServer()).get('/especies').expect(200);
    expect(res.body).toEqual([{ id: 1, nombre: 'perro' }]);
  });

  it('GET /especies/:id/razas responde 404 en español si no existe la especie', async () => {
    servicio.listarRazas.mockRejectedValue(new NotFoundException('La especie no existe'));
    const res = await request(app.getHttpServer()).get('/especies/9/razas').expect(404);
    expect(res.body.message).toBe('La especie no existe');
  });

  it('rechaza ids no válidos con 400 sin llegar al servicio', async () => {
    await request(app.getHttpServer()).get('/especies/abc/razas').expect(400);
    await request(app.getHttpServer()).get('/especies/99999999999/razas').expect(400);
    expect(servicio.listarRazas).not.toHaveBeenCalled();
  });
});
