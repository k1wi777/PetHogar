import 'reflect-metadata';
import { ConflictException, INestApplication, NotFoundException } from '@nestjs/common';
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
import { AprobacionService } from './aprobacion.service';
import { DecisionController } from './decision.controller';

const SUCIO = {
  numeroDocumento: '1',
  fechaNacimiento: '1990-01-01',
  direccion: 'Calle 1',
  formularioUrl: 'privado/solicitudes/a.pdf',
};
const SOLICITUD = {
  id: 11,
  fechaSolicitud: new Date('2026-01-01T00:00:00Z'),
  estado: 'aprobada',
  mascota: { id: 7, nombre: 'Luna' },
  motivo: 'm',
  tipoVivienda: 'casa',
  tieneOtrasMascotas: false,
  observacion: null,
  fechaRespuesta: new Date('2026-02-01T00:00:00Z'),
  adoptante: { nombreCompleto: 'Ana', email: 'a@x.co', telefono: '3', ciudad: 'Bogotá', ...SUCIO },
  ...SUCIO,
};

describe('DecisionController (HTTP, servicios simulados)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const aprobacion = { decidir: jest.fn() };
  const fundaciones = { estadoPorUsuarioId: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [DecisionController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        ApprovedFoundationGuard,
        { provide: FundacionesService, useValue: fundaciones },
        { provide: AprobacionService, useValue: aprobacion },
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
    fundaciones.estadoPorUsuarioId.mockResolvedValue({
      id: 3,
      estadoValidacion: EstadoValidacion.Aprobada,
    });
  });

  const patch = (ruta: string, rol = 'fundacion') =>
    request(app.getHttpServer())
      .patch(ruta)
      .set('Authorization', `Bearer ${jwt.sign({ sub: 9, rol })}`);

  it('exige rol fundación y fundación aprobada', async () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, DecisionController)).toEqual(['fundacion']);
    expect(Reflect.getMetadata('__guards__', DecisionController)).toContain(
      ApprovedFoundationGuard,
    );
    await request(app.getHttpServer()).patch('/solicitudes/1/decision').expect(401);
    await patch('/solicitudes/1/decision', 'adoptante')
      .send({ decision: 'rechazar', observacion: 'x' })
      .expect(403);
    fundaciones.estadoPorUsuarioId.mockResolvedValue({
      id: 3,
      estadoValidacion: EstadoValidacion.Rechazada,
    });
    await patch('/solicitudes/1/decision')
      .send({ decision: 'rechazar', observacion: 'x' })
      .expect(403);
    expect(aprobacion.decidir).not.toHaveBeenCalled();
  });

  it('valida el cuerpo antes de llegar al servicio', async () => {
    await patch('/solicitudes/1/decision').send({}).expect(400);
    await patch('/solicitudes/1/decision').send({ decision: 'rechazar' }).expect(400);
    await patch('/solicitudes/1/decision').send({ decision: 'aprobar' }).expect(400);
    await patch('/solicitudes/1/decision')
      .send({ decision: 'aprobar', fechaEntrega: '2020-01-01' })
      .expect(400);
    await patch('/solicitudes/0/decision')
      .send({ decision: 'rechazar', observacion: 'x' })
      .expect(400);
    expect(aprobacion.decidir).not.toHaveBeenCalled();
  });

  it('aprobar entrega fundación del guard e id, y responde con la adopción sin datos sensibles', async () => {
    aprobacion.decidir.mockResolvedValue({
      solicitud: SOLICITUD,
      adopcion: { id: 55, fechaEntrega: '2099-12-01', estado: 'activa', ...SUCIO },
    });
    const res = await patch('/solicitudes/11/decision')
      .send({ decision: 'aprobar', fechaEntrega: '2099-12-01' })
      .expect(200);
    const [id, fundacionId, dto] = aprobacion.decidir.mock.calls[0];
    expect([id, fundacionId]).toEqual([11, 3]);
    expect(dto).toMatchObject({ decision: 'aprobar', fechaEntrega: '2099-12-01' });
    expect(res.body.adopcion).toEqual({ id: 55, fechaEntrega: '2099-12-01', estado: 'activa' });
    expect(res.body.estado).toBe('aprobada');
    expect(JSON.stringify(res.body)).not.toMatch(
      /numeroDocumento|fechaNacimiento|direccion|formularioUrl|privado\//,
    );
  });

  it('rechazar responde con adopción null', async () => {
    aprobacion.decidir.mockResolvedValue({
      solicitud: { ...SOLICITUD, estado: 'rechazada' },
      adopcion: null,
    });
    const res = await patch('/solicitudes/11/decision')
      .send({ decision: 'rechazar', observacion: 'No cumple' })
      .expect(200);
    expect(res.body.adopcion).toBeNull();
    expect(res.body.estado).toBe('rechazada');
  });

  it('propaga 404 (ajena) y 409 (ya decidida)', async () => {
    aprobacion.decidir.mockRejectedValueOnce(new NotFoundException('La solicitud no existe'));
    await patch('/solicitudes/11/decision')
      .send({ decision: 'rechazar', observacion: 'x' })
      .expect(404);
    aprobacion.decidir.mockRejectedValueOnce(
      new ConflictException('La solicitud ya está aprobada'),
    );
    const res = await patch('/solicitudes/11/decision')
      .send({ decision: 'rechazar', observacion: 'x' })
      .expect(409);
    expect(res.body.message).toBe('La solicitud ya está aprobada');
  });
});
