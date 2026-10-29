import 'reflect-metadata';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { ES_PUBLICA } from '../../../common/auth/public.decorator';
import { AllExceptionsFilter } from '../../../common/filters/http-exception.filter';
import { crearValidationPipe } from '../../../common/pipes/validation.pipe';
import { CatalogoMascotasService } from './catalogo-mascotas.service';
import { MascotasCatalogoController } from './mascotas-catalogo.controller';

describe('MascotasCatalogoController (HTTP, servicio simulado)', () => {
  let app: INestApplication;
  const servicio = { listar: jest.fn(), obtenerFicha: jest.fn(), obtenerHistorial: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
      ],
      controllers: [MascotasCatalogoController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: CatalogoMascotasService, useValue: servicio },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(crearValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.resetAllMocks();
    servicio.listar.mockResolvedValue({ data: [], total: 0, page: 1, limit: 12 });
  });

  const get = (ruta: string): request.Test => request(app.getHttpServer()).get(ruta);

  it('las tres rutas son públicas y con límite propio por IP', () => {
    const reflector = new Reflector();
    for (const metodo of ['listar', 'obtener', 'historial'] as const) {
      const handler = MascotasCatalogoController.prototype[metodo];
      expect(reflector.get(ES_PUBLICA, handler)).toBe(true);
      expect(
        Reflect.getMetadataKeys(handler).some((k) => String(k).includes('THROTTLER:LIMIT')),
      ).toBe(true);
    }
  });

  it('GET /mascotas responde sin token con límite por defecto 12 y sin filtros', async () => {
    const res = await get('/mascotas').expect(200);
    expect(res.body).toEqual({ data: [], total: 0, page: 1, limit: 12 });
    const [filtro, paginacion] = servicio.listar.mock.calls[0];
    expect(filtro).toEqual({
      especieId: undefined,
      tamano: undefined,
      edadMinMeses: undefined,
      edadMaxMeses: undefined,
      ciudad: undefined,
    });
    expect(paginacion).toMatchObject({ page: 1, limit: 12 });
  });

  it('convierte y entrega los filtros', async () => {
    await get(
      '/mascotas?especieId=2&tamano=pequeño&edadMinMeses=6&edadMaxMeses=24&ciudad=%20bogota%20&page=3&limit=50',
    ).expect(200);
    const [filtro, paginacion] = servicio.listar.mock.calls[0];
    expect(filtro).toEqual({
      especieId: 2,
      tamano: 'pequeño',
      edadMinMeses: 6,
      edadMaxMeses: 24,
      ciudad: 'bogota',
    });
    expect(paginacion).toMatchObject({ page: 3, limit: 50 });
  });

  it.each([
    ['limit por encima del tope', '/mascotas?limit=101'],
    ['page cero', '/mascotas?page=0'],
    ['rango de edad incoherente', '/mascotas?edadMinMeses=30&edadMaxMeses=10'],
    ['tamaño inexistente', '/mascotas?tamano=enorme'],
    ['especie no numérica', '/mascotas?especieId=abc'],
    ['especie mayor que int4', '/mascotas?especieId=99999999999'],
    ['edad negativa', '/mascotas?edadMinMeses=-1'],
    ['edad decimal', '/mascotas?edadMaxMeses=1.5'],
    ['ciudad vacía', '/mascotas?ciudad='],
    ['ciudad demasiado larga', `/mascotas?ciudad=${'a'.repeat(61)}`],
  ])('400 por %s', async (_caso, ruta) => {
    const res = await get(ruta).expect(400);
    expect(res.body.message).toBeDefined();
    expect(servicio.listar).not.toHaveBeenCalled();
  });

  it('rango de edad con el mismo valor en ambos extremos es válido', async () => {
    await get('/mascotas?edadMinMeses=12&edadMaxMeses=12').expect(200);
  });

  it('ficha: 404 en español y validación del id', async () => {
    servicio.obtenerFicha.mockRejectedValue(new NotFoundException('La mascota no existe'));
    const res = await get('/mascotas/5').expect(404);
    expect(res.body.message).toBe('La mascota no existe');
    await get('/mascotas/abc').expect(400);
    await get('/mascotas/0/historial').expect(400);
    servicio.obtenerHistorial.mockResolvedValue([]);
    await get('/mascotas/5/historial').expect(200);
  });
});
