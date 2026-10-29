import 'reflect-metadata';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AllExceptionsFilter } from '../filters/http-exception.filter';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import type { UsuarioAutenticado } from './usuario-autenticado';

const SECRETO = 'secreto-de-prueba-con-mas-de-32-caracteres';

@Controller('demo')
class DemoController {
  @Public()
  @Get('publica')
  publica(): { ok: boolean } {
    return { ok: true };
  }

  @Get('privada')
  privada(@CurrentUser() usuario: UsuarioAutenticado): UsuarioAutenticado {
    return usuario;
  }

  @Roles('administrador')
  @Get('admin')
  admin(): { ok: boolean } {
    return { ok: true };
  }

  @Roles('fundacion', 'administrador')
  @Get('varios')
  varios(): { ok: boolean } {
    return { ok: true };
  }
}

describe('JwtAuthGuard y RolesGuard (401 y 403)', () => {
  let app: INestApplication;
  let jwt: JwtService;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: SECRETO,
          signOptions: { algorithm: 'HS256', expiresIn: 900 },
        }),
      ],
      controllers: [DemoController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    jwt = modulo.get(JwtService);
  });

  afterAll(() => app.close());

  const token = (rol: string, sub: unknown = 7): string => jwt.sign({ sub, rol });
  const get = (ruta: string, bearer?: string): request.Test => {
    const r = request(app.getHttpServer()).get(ruta);
    return bearer ? r.set('Authorization', `Bearer ${bearer}`) : r;
  };

  it('deja pasar sin token las rutas @Public()', async () => {
    await get('/demo/publica').expect(200);
  });

  it('responde 401 sin token', async () => {
    const res = await get('/demo/privada').expect(401);
    expect(res.body.message).toBe('Sesión no válida o vencida');
  });

  it('responde 401 con token mal formado, firmado con otro secreto o con esquema distinto', async () => {
    await get('/demo/privada', 'basura').expect(401);
    const ajeno = new JwtService({ secret: 'otro-secreto-distinto-con-32-caracteres!!' }).sign({
      sub: 1,
      rol: 'adoptante',
    });
    await get('/demo/privada', ajeno).expect(401);
    await request(app.getHttpServer())
      .get('/demo/privada')
      .set('Authorization', `Basic ${token('adoptante')}`)
      .expect(401);
  });

  it('responde 401 con token vencido', async () => {
    const vencido = jwt.sign({ sub: 1, rol: 'adoptante' }, { expiresIn: -10 });
    await get('/demo/privada', vencido).expect(401);
  });

  it('rechaza un token sin firma (alg none) y un payload sin id o con rol desconocido', async () => {
    const cabecera = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
    const cuerpo = Buffer.from('{"sub":1,"rol":"administrador"}').toString('base64url');
    await get('/demo/admin', `${cabecera}.${cuerpo}.`).expect(401);
    await get('/demo/privada', token('adoptante', 'abc')).expect(401);
    await get('/demo/privada', token('superusuario')).expect(401);
  });

  it('@CurrentUser() expone solo id y rol', async () => {
    const res = await get('/demo/privada', token('adoptante', 42)).expect(200);
    expect(res.body).toEqual({ id: 42, rol: 'adoptante' });
  });

  it('responde 403 si el rol no está entre los permitidos', async () => {
    const res = await get('/demo/admin', token('fundacion')).expect(403);
    expect(res.body.message).toBe('No tienes permiso para realizar esta acción');
    await get('/demo/varios', token('adoptante')).expect(403);
  });

  it('permite el rol correcto y cualquier autenticado en rutas sin @Roles()', async () => {
    await get('/demo/admin', token('administrador')).expect(200);
    await get('/demo/varios', token('fundacion')).expect(200);
    await get('/demo/privada', token('adoptante')).expect(200);
  });
});
