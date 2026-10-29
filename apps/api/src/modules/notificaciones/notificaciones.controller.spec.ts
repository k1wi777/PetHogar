import 'reflect-metadata';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ROLES_PERMITIDOS } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AllExceptionsFilter } from '../../common/filters/http-exception.filter';
import { crearValidationPipe } from '../../common/pipes/validation.pipe';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';

describe('NotificacionesController (HTTP, servicio simulado)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const servicio = {
    listar: jest.fn(),
    contarNoLeidas: jest.fn(),
    marcarLeida: jest.fn(),
    marcarTodas: jest.fn(),
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [NotificacionesController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: NotificacionesService, useValue: servicio },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(crearValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    jwt = modulo.get(JwtService);
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  const http = (metodo: 'get' | 'patch', ruta: string, rol = 'adoptante', sub = 9) =>
    request(app.getHttpServer())
      [metodo](ruta)
      .set('Authorization', `Bearer ${jwt.sign({ sub, rol })}`);

  it('no restringe por rol (cualquier usuario autenticado) y exige sesión', async () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, NotificacionesController)).toBeUndefined();
    servicio.listar.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });
    for (const rol of ['adoptante', 'fundacion', 'administrador']) {
      await http('get', '/notificaciones', rol).expect(200);
    }
    await request(app.getHttpServer()).get('/notificaciones').expect(401);
    await request(app.getHttpServer()).get('/notificaciones/no-leidas/count').expect(401);
    await request(app.getHttpServer()).patch('/notificaciones/leer-todas').expect(401);
    await request(app.getHttpServer()).patch('/notificaciones/1/leida').expect(401);
  });

  it('listar usa el usuario del token y el filtro estricto de lectura', async () => {
    servicio.listar.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });
    await http('get', '/notificaciones?leida=false&page=2&limit=5', 'fundacion', 4).expect(200);
    const [usuarioId, filtro, pagina] = servicio.listar.mock.calls[0];
    expect(usuarioId).toBe(4);
    expect(filtro).toEqual({ leida: false });
    expect(pagina).toMatchObject({ page: 2, limit: 5 });
    await http('get', '/notificaciones?leida=true').expect(200);
    expect(servicio.listar.mock.calls[1][1]).toEqual({ leida: true });
    await http('get', '/notificaciones').expect(200);
    expect(servicio.listar.mock.calls[2][1]).toEqual({ leida: undefined });
  });

  it('rechaza filtros y paginación inválidos', async () => {
    await http('get', '/notificaciones?leida=quizas').expect(400);
    await http('get', '/notificaciones?leida=1').expect(400);
    await http('get', '/notificaciones?limit=101').expect(400);
    await http('get', '/notificaciones?page=0').expect(400);
    expect(servicio.listar).not.toHaveBeenCalled();
  });

  it('el contador y leer-todas devuelven sus cantidades para el usuario del token', async () => {
    servicio.contarNoLeidas.mockResolvedValue({ noLeidas: 3 });
    servicio.marcarTodas.mockResolvedValue({ actualizadas: 3 });
    const a = await http('get', '/notificaciones/no-leidas/count').expect(200);
    const b = await http('patch', '/notificaciones/leer-todas').expect(200);
    expect(a.body).toEqual({ noLeidas: 3 });
    expect(b.body).toEqual({ actualizadas: 3 });
    expect(servicio.contarNoLeidas).toHaveBeenCalledWith(9);
    expect(servicio.marcarTodas).toHaveBeenCalledWith(9);
  });

  it('marcar una como leída: id válido, usuario del token y 404 uniforme', async () => {
    servicio.marcarLeida.mockResolvedValue({ id: 5, leida: true });
    await http('patch', '/notificaciones/5/leida').expect(200);
    expect(servicio.marcarLeida).toHaveBeenCalledWith(9, 5);
    servicio.marcarLeida.mockRejectedValue(new NotFoundException('La notificación no existe'));
    const res = await http('patch', '/notificaciones/6/leida').expect(404);
    expect(res.body.message).toBe('La notificación no existe');
    await http('patch', '/notificaciones/0/leida').expect(400);
    await http('patch', '/notificaciones/abc/leida').expect(400);
  });

  it('límites por IP: 120 lectura y contador, 60 marcar una, 30 leer todas', () => {
    const limite = (fn: unknown): unknown =>
      Reflect.getMetadata('THROTTLER:LIMITdefault', fn as object);
    const proto = NotificacionesController.prototype;
    expect(limite(proto.listar)).toBe(120);
    expect(limite(proto.contarNoLeidas)).toBe(120);
    expect(limite(proto.leer)).toBe(60);
    expect(limite(proto.leerTodas)).toBe(30);
  });
});
