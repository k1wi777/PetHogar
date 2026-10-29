import 'reflect-metadata';
import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { AllExceptionsFilter } from '../../../common/filters/http-exception.filter';
import { EstadoValidacion } from '../entities/fundacion.enum';
import { FundacionesService } from '../fundaciones.service';
import { ApprovedFoundationGuard } from './approved-foundation.guard';

@Controller('operativa')
class OperativaController {
  @Roles('fundacion')
  @UseGuards(ApprovedFoundationGuard)
  @Get()
  operar(): { ok: boolean } {
    return { ok: true };
  }
}

describe('ApprovedFoundationGuard', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const estadoPorUsuarioId = jest.fn();

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [OperativaController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        ApprovedFoundationGuard,
        { provide: FundacionesService, useValue: { estadoPorUsuarioId } },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    jwt = modulo.get(JwtService);
  });

  afterAll(() => app.close());
  beforeEach(() => estadoPorUsuarioId.mockReset());

  const llamar = (rol = 'fundacion'): request.Test =>
    request(app.getHttpServer())
      .get('/operativa')
      .set('Authorization', `Bearer ${jwt.sign({ sub: 9, rol })}`);

  it('responde 403 con mensaje de pendiente si la fundación no está validada', async () => {
    estadoPorUsuarioId.mockResolvedValue({ estadoValidacion: EstadoValidacion.Pendiente });
    const res = await llamar().expect(403);
    expect(res.body.message).toContain('pendiente de validación');
  });

  it('responde 403 con mensaje de rechazada', async () => {
    estadoPorUsuarioId.mockResolvedValue({ estadoValidacion: EstadoValidacion.Rechazada });
    const res = await llamar().expect(403);
    expect(res.body.message).toContain('rechazada');
  });

  it('deja pasar a una fundación aprobada', async () => {
    estadoPorUsuarioId.mockResolvedValue({ estadoValidacion: EstadoValidacion.Aprobada });
    await llamar().expect(200);
    expect(estadoPorUsuarioId).toHaveBeenCalledWith(9);
  });

  it('responde 403 si no existe la fundación y 401 sin token', async () => {
    estadoPorUsuarioId.mockResolvedValue(null);
    await llamar().expect(403);
    await request(app.getHttpServer()).get('/operativa').expect(401);
  });

  it('RolesGuard corta antes de consultar el estado si el rol no es fundación', async () => {
    await llamar('adoptante').expect(403);
    expect(estadoPorUsuarioId).not.toHaveBeenCalled();
  });
});
