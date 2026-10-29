import 'reflect-metadata';
import { ConflictException, INestApplication, Logger, NotFoundException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AllExceptionsFilter } from '../../common/filters/http-exception.filter';
import { crearValidationPipe } from '../../common/pipes/validation.pipe';
import { SesionService } from '../auth/sesion.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { UsuarioAdmin } from '../usuarios/usuarios.types';
import { AdminUsuariosController } from './admin-usuarios.controller';
import { AdminUsuariosService, MENSAJE_AUTODESACTIVACION } from './admin-usuarios.service';
import { DataSource } from 'typeorm';

const MANAGER = { id: 'tx' };
const PROHIBIDAS = /contrasena|password|hash|token|reset|secret|bloqueado|intentos/i;

const USUARIO: UsuarioAdmin = {
  id: 7,
  email: 'ana@example.com',
  telefono: '3001234567',
  rol: 'adoptante',
  activo: true,
  emailVerificado: true,
  fechaCreacion: new Date('2026-10-01T10:00:00Z'),
  nombre: 'Ana Pérez',
};

/** Recorre el JSON y devuelve las claves que parecen sensibles. */
function clavesProhibidas(valor: unknown, ruta = ''): string[] {
  if (Array.isArray(valor)) return valor.flatMap((v) => clavesProhibidas(v, ruta));
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => [
      ...(PROHIBIDAS.test(k) ? [`${ruta}${k}`] : []),
      ...clavesProhibidas(v, `${ruta}${k}.`),
    ]);
  }
  return [];
}

describe('AdminUsuariosController (HTTP, dependencias simuladas)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const usuarios = { listar: jest.fn(), cambiarEstado: jest.fn() };
  const sesion = { revocarTodas: jest.fn() };
  const dataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => fn(MANAGER)),
  };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [AdminUsuariosController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        AdminUsuariosService,
        { provide: UsuariosService, useValue: usuarios },
        { provide: SesionService, useValue: sesion },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(crearValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    jwt = modulo.get(JwtService);
  });

  afterAll(() => app.close());
  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => {
    jest.clearAllMocks();
    usuarios.listar.mockReset();
    usuarios.cambiarEstado.mockReset();
    sesion.revocarTodas.mockReset().mockResolvedValue(undefined);
  });

  const admin = (id = 1): string => `Bearer ${jwt.sign({ sub: id, rol: 'administrador' })}`;
  const http = (metodo: 'get' | 'patch', ruta: string, auth: string | null = admin()) => {
    const r = request(app.getHttpServer())[metodo](ruta);
    return auth ? r.set('Authorization', auth) : r;
  };

  it.each([
    ['get', '/admin/usuarios'],
    ['patch', '/admin/usuarios/7/estado'],
  ] as const)('%s %s: 401 sin token y 403 para fundación y adoptante', async (metodo, ruta) => {
    await http(metodo, ruta, null).expect(401);
    for (const rol of ['fundacion', 'adoptante']) {
      await http(metodo, ruta, `Bearer ${jwt.sign({ sub: 5, rol })}`).expect(403);
    }
    expect(usuarios.listar).not.toHaveBeenCalled();
    expect(usuarios.cambiarEstado).not.toHaveBeenCalled();
  });

  describe('GET /admin/usuarios', () => {
    it('pasa los filtros recortados y la paginación; la salida no trae campos sensibles', async () => {
      usuarios.listar.mockResolvedValue({ data: [USUARIO], total: 1, page: 2, limit: 5 });
      const res = await http(
        'get',
        '/admin/usuarios?nombre=%20Ana%20&correo=ana%25&rol=adoptante&page=2&limit=5',
      ).expect(200);
      expect(usuarios.listar).toHaveBeenCalledWith(
        { nombre: 'Ana', correo: 'ana%', rol: 'adoptante' },
        expect.objectContaining({ page: 2, limit: 5 }),
      );
      expect(res.body).toMatchObject({ total: 1, page: 2, limit: 5 });
      expect(res.body.data[0]).toEqual({
        ...USUARIO,
        fechaCreacion: '2026-10-01T10:00:00.000Z',
      });
      expect(clavesProhibidas(res.body)).toEqual([]);
    });

    it('rechaza un rol inválido y una página no válida', async () => {
      await http('get', '/admin/usuarios?rol=superadmin').expect(400);
      await http('get', '/admin/usuarios?limit=1000').expect(400);
      await http('get', `/admin/usuarios?correo=${'a'.repeat(101)}`).expect(400);
      expect(usuarios.listar).not.toHaveBeenCalled();
    });

    it('no deja pasar campos de más que el servicio devuelva (mapeo explícito)', async () => {
      usuarios.listar.mockResolvedValue({
        data: [{ ...USUARIO, contrasena: '$2b$10$x', resetCodeHash: 'abc' }],
        total: 1,
        page: 1,
        limit: 10,
      });
      const res = await http('get', '/admin/usuarios').expect(200);
      expect(clavesProhibidas(res.body)).toEqual([]);
    });
  });

  describe('PATCH /admin/usuarios/:id/estado', () => {
    it('desactiva: cambia el estado y revoca sus sesiones con el mismo manager de la transacción', async () => {
      usuarios.cambiarEstado.mockResolvedValue({ ...USUARIO, activo: false });
      const res = await http('patch', '/admin/usuarios/7/estado')
        .send({ activo: false })
        .expect(200);
      expect(res.body.activo).toBe(false);
      expect(usuarios.cambiarEstado).toHaveBeenCalledWith(7, false, MANAGER);
      expect(sesion.revocarTodas).toHaveBeenCalledWith(7, MANAGER);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(clavesProhibidas(res.body)).toEqual([]);
    });

    it('reactivar no toca las sesiones', async () => {
      usuarios.cambiarEstado.mockResolvedValue(USUARIO);
      await http('patch', '/admin/usuarios/7/estado').send({ activo: true }).expect(200);
      expect(sesion.revocarTodas).not.toHaveBeenCalled();
    });

    it('es idempotente: repetir la desactivación responde 200 y vuelve a revocar', async () => {
      usuarios.cambiarEstado.mockResolvedValue({ ...USUARIO, activo: false });
      await http('patch', '/admin/usuarios/7/estado').send({ activo: false }).expect(200);
      await http('patch', '/admin/usuarios/7/estado').send({ activo: false }).expect(200);
      expect(sesion.revocarTodas).toHaveBeenCalledTimes(2);
    });

    it('un administrador no puede desactivarse a sí mismo (400) ni se abre transacción', async () => {
      const res = await http('patch', '/admin/usuarios/1/estado', admin(1))
        .send({ activo: false })
        .expect(400);
      expect(res.body.message).toBe(MENSAJE_AUTODESACTIVACION);
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(sesion.revocarTodas).not.toHaveBeenCalled();
    });

    it('activarse a sí mismo es válido (no-op)', async () => {
      usuarios.cambiarEstado.mockResolvedValue({ ...USUARIO, id: 1, rol: 'administrador' });
      await http('patch', '/admin/usuarios/1/estado', admin(1)).send({ activo: true }).expect(200);
    });

    it('si falla la revocación, el error sube y la transacción no confirma', async () => {
      usuarios.cambiarEstado.mockResolvedValue({ ...USUARIO, activo: false });
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      sesion.revocarTodas.mockRejectedValue(new Error('BD caída'));
      await http('patch', '/admin/usuarios/7/estado').send({ activo: false }).expect(500);
    });

    it('último administrador: 409; usuario inexistente: 404', async () => {
      usuarios.cambiarEstado.mockRejectedValueOnce(
        new ConflictException('Debe haber al menos un administrador activo'),
      );
      await http('patch', '/admin/usuarios/2/estado').send({ activo: false }).expect(409);
      expect(sesion.revocarTodas).not.toHaveBeenCalled();
      usuarios.cambiarEstado.mockRejectedValueOnce(new NotFoundException('El usuario no existe'));
      await http('patch', '/admin/usuarios/99/estado').send({ activo: false }).expect(404);
    });

    it.each([
      ['sin activo', {}],
      ['activo numérico', { activo: 1 }],
      ['activo nulo', { activo: null }],
      ['activo texto libre', { activo: 'quizá' }],
    ])('%s: 400', async (_n, cuerpo) => {
      await http('patch', '/admin/usuarios/7/estado').send(cuerpo).expect(400);
      expect(usuarios.cambiarEstado).not.toHaveBeenCalled();
    });

    it('la cadena "false" cuenta como false, no como true', async () => {
      usuarios.cambiarEstado.mockResolvedValue({ ...USUARIO, activo: false });
      await http('patch', '/admin/usuarios/7/estado').send({ activo: 'false' }).expect(200);
      expect(usuarios.cambiarEstado).toHaveBeenCalledWith(7, false, MANAGER);
    });

    it('id no numérico: 400', async () => {
      await http('patch', '/admin/usuarios/abc/estado').send({ activo: true }).expect(400);
    });
  });
});
