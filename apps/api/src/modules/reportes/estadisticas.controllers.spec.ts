import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ROLES_PERMITIDOS } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AllExceptionsFilter } from '../../common/filters/http-exception.filter';
import { crearValidationPipe } from '../../common/pipes/validation.pipe';
import { EstadoValidacion } from '../fundaciones/entities/fundacion.enum';
import { FundacionesService } from '../fundaciones/fundaciones.service';
import { ApprovedFoundationGuard } from '../fundaciones/guards/approved-foundation.guard';
import { EstadisticasAdminController } from './estadisticas-admin.controller';
import { EstadisticasFundacionController } from './estadisticas-fundacion.controller';
import { EstadisticasService } from './estadisticas.service';

describe('controllers de estadísticas (HTTP, servicios simulados)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const estadisticas = { deFundacion: jest.fn(), deAdministrador: jest.fn() };
  const fundaciones = { estadoPorUsuarioId: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [EstadisticasFundacionController, EstadisticasAdminController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        ApprovedFoundationGuard,
        { provide: FundacionesService, useValue: fundaciones },
        { provide: EstadisticasService, useValue: estadisticas },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(crearValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    jwt = modulo.get(JwtService);
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.resetAllMocks();
    estadisticas.deFundacion.mockResolvedValue({ ok: 'fundacion' });
    estadisticas.deAdministrador.mockResolvedValue({ ok: 'admin' });
    fundaciones.estadoPorUsuarioId.mockResolvedValue({
      id: 3,
      estadoValidacion: EstadoValidacion.Aprobada,
    });
  });

  const get = (ruta: string, rol?: string) => {
    const r = request(app.getHttpServer()).get(ruta);
    return rol ? r.set('Authorization', `Bearer ${jwt.sign({ sub: 9, rol })}`) : r;
  };

  it('declara los roles correctos y el guard de fundación aprobada', () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, EstadisticasFundacionController)).toEqual([
      'fundacion',
    ]);
    expect(Reflect.getMetadata('__guards__', EstadisticasFundacionController)).toContain(
      ApprovedFoundationGuard,
    );
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, EstadisticasAdminController)).toEqual([
      'administrador',
    ]);
  });

  it('anónimos 401 y roles ajenos 403 en ambas rutas', async () => {
    await get('/fundacion/estadisticas').expect(401);
    await get('/admin/estadisticas').expect(401);
    await get('/fundacion/estadisticas', 'adoptante').expect(403);
    await get('/fundacion/estadisticas', 'administrador').expect(403);
    await get('/admin/estadisticas', 'fundacion').expect(403);
    await get('/admin/estadisticas', 'adoptante').expect(403);
    expect(estadisticas.deFundacion).not.toHaveBeenCalled();
    expect(estadisticas.deAdministrador).not.toHaveBeenCalled();
  });

  it('fundación pendiente o rechazada: 403', async () => {
    for (const estado of [EstadoValidacion.Pendiente, EstadoValidacion.Rechazada]) {
      fundaciones.estadoPorUsuarioId.mockResolvedValue({ id: 3, estadoValidacion: estado });
      await get('/fundacion/estadisticas', 'fundacion').expect(403);
    }
    expect(estadisticas.deFundacion).not.toHaveBeenCalled();
  });

  it('fundación: usa la del token e ignora un fundacionId enviado por el cliente', async () => {
    await get('/fundacion/estadisticas?desde=2026-10-01&hasta=2026-10-31', 'fundacion').expect(200);
    expect(estadisticas.deFundacion).toHaveBeenCalledWith(3, '2026-10-01', '2026-10-31');
    estadisticas.deFundacion.mockClear();
    await get('/fundacion/estadisticas?fundacionId=77', 'fundacion').expect(200);
    expect(estadisticas.deFundacion).toHaveBeenCalledWith(3, undefined, undefined);
  });

  it('administrador: pasa fundacionId y rango', async () => {
    await get('/admin/estadisticas?fundacionId=4&desde=2026-10-01', 'administrador').expect(200);
    expect(estadisticas.deAdministrador).toHaveBeenCalledWith(4, '2026-10-01', undefined);
    await get('/admin/estadisticas', 'administrador').expect(200);
    expect(estadisticas.deAdministrador).toHaveBeenLastCalledWith(undefined, undefined, undefined);
  });

  it('valida fechas y fundacionId con mensajes en español (400)', async () => {
    const res = await get('/admin/estadisticas?desde=2026-02-30', 'administrador').expect(400);
    expect(JSON.stringify(res.body)).toContain('fecha inicial');
    await get('/admin/estadisticas?hasta=ayer', 'administrador').expect(400);
    await get('/admin/estadisticas?fundacionId=abc', 'administrador').expect(400);
    await get('/admin/estadisticas?fundacionId=0', 'administrador').expect(400);
    expect(estadisticas.deAdministrador).not.toHaveBeenCalled();
  });
});
