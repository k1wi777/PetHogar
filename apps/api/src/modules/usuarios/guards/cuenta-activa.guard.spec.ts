import 'reflect-metadata';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { Public } from '../../../common/auth/public.decorator';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { AllExceptionsFilter } from '../../../common/filters/http-exception.filter';
import { UsuariosService } from '../usuarios.service';
import { CuentaActivaGuard } from './cuenta-activa.guard';

@Controller('demo')
class DemoController {
  @Public()
  @Get('publica')
  publica(): { ok: boolean } {
    return { ok: true };
  }

  @Get('privada')
  privada(): { ok: boolean } {
    return { ok: true };
  }

  @Roles('administrador')
  @Get('admin')
  admin(): { ok: boolean } {
    return { ok: true };
  }
}

describe('CuentaActivaGuard (orden global JwtAuth → CuentaActiva → Roles)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const estaActiva = jest.fn();

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [DemoController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: CuentaActivaGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: UsuariosService, useValue: { estaActiva } },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    jwt = modulo.get(JwtService);
  });

  afterAll(() => app.close());
  beforeEach(() => estaActiva.mockReset());

  const token = (rol: string, sub = 5): string => jwt.sign({ sub, rol });
  const http = (ruta: string, t?: string): request.Test => {
    const r = request(app.getHttpServer()).get(ruta);
    return t ? r.set('Authorization', `Bearer ${t}`) : r;
  };

  it('cuenta activa: deja pasar y consulta por el id del token', async () => {
    estaActiva.mockResolvedValue(true);
    await http('/demo/privada', token('adoptante', 9)).expect(200);
    expect(estaActiva).toHaveBeenCalledWith(9);
  });

  it('cuenta inactiva o inexistente: 401 con access token aún vigente', async () => {
    estaActiva.mockResolvedValue(false);
    const res = await http('/demo/privada', token('adoptante')).expect(401);
    expect(res.body.message).toBe('Sesión no válida o vencida');
  });

  it('corre antes que los roles: un administrador desactivado recibe 401, no 200', async () => {
    estaActiva.mockResolvedValue(false);
    await http('/demo/admin', token('administrador')).expect(401);
    // Un rol incorrecto de una cuenta inactiva también es 401 (no filtra el 403).
    await http('/demo/admin', token('adoptante')).expect(401);
  });

  it('con cuenta activa los roles siguen mandando (403)', async () => {
    estaActiva.mockResolvedValue(true);
    await http('/demo/admin', token('adoptante')).expect(403);
  });

  it('rutas públicas: no consulta la base de datos', async () => {
    await http('/demo/publica').expect(200);
    expect(estaActiva).not.toHaveBeenCalled();
  });

  it('sin token sigue siendo 401 de JwtAuthGuard y no consulta la base de datos', async () => {
    await http('/demo/privada').expect(401);
    expect(estaActiva).not.toHaveBeenCalled();
  });
});
