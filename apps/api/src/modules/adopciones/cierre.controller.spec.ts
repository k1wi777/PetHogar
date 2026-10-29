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
import { CierreAdopcionService } from './cierre-adopcion.service';
import { CierreController } from './cierre.controller';

const SUCIO = { actaUrl: 'privado/solicitudes/a.pdf', numeroDocumento: '1' };
const ADOPCION = {
  id: 9,
  fechaEntrega: '2026-11-01',
  estado: 'revocada',
  solicitudId: 11,
  mascota: { id: 4, nombre: 'Luna' },
  tieneActa: false,
  motivoCierre: 'Maltrato',
  fechaCierre: new Date('2026-12-01T10:00:00Z'),
  seguimientos: [
    {
      id: 31,
      tipo: 'visita',
      fechaProgramada: '2026-12-15',
      fechaRealizada: null,
      estado: 'cancelado',
      vencido: false,
    },
  ],
  adoptante: { nombreCompleto: 'Ana', email: 'a@x.co', telefono: '3', ciudad: 'Cali', ...SUCIO },
  ...SUCIO,
};

describe('CierreController (HTTP, servicios simulados)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const cierre = { cerrar: jest.fn() };
  const fundaciones = { estadoPorUsuarioId: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [CierreController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        ApprovedFoundationGuard,
        { provide: FundacionesService, useValue: fundaciones },
        { provide: CierreAdopcionService, useValue: cierre },
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

  const patch = (rol = 'fundacion', ruta = '/adopciones/9/estado') =>
    request(app.getHttpServer())
      .patch(ruta)
      .set('Authorization', `Bearer ${jwt.sign({ sub: 9, rol })}`);
  const CUERPO = { estado: 'revocada', motivo: 'Maltrato', mascotaDestino: 'disponible' };

  it('exige fundación aprobada: anónimo 401, otros roles 403, pendiente 403', async () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, CierreController)).toEqual(['fundacion']);
    expect(Reflect.getMetadata('__guards__', CierreController)).toContain(ApprovedFoundationGuard);
    await request(app.getHttpServer()).patch('/adopciones/9/estado').send(CUERPO).expect(401);
    await patch('adoptante').send(CUERPO).expect(403);
    await patch('administrador').send(CUERPO).expect(403);
    fundaciones.estadoPorUsuarioId.mockResolvedValue({
      id: 3,
      estadoValidacion: EstadoValidacion.Pendiente,
    });
    await patch().send(CUERPO).expect(403);
    expect(cierre.cerrar).not.toHaveBeenCalled();
  });

  it('cierra con la fundación del guard (nunca del cuerpo) y responde con motivo, fecha y seguimientos', async () => {
    cierre.cerrar.mockResolvedValue(ADOPCION);
    const res = await patch()
      .send({ ...CUERPO, motivo: '  Maltrato  ', fundacionId: 99 })
      .expect(200);
    const [id, fundacionId, dto] = cierre.cerrar.mock.calls[0] as [number, number, object];
    expect([id, fundacionId]).toEqual([9, 3]);
    expect(dto).toMatchObject({
      estado: 'revocada',
      motivo: 'Maltrato',
      mascotaDestino: 'disponible',
    });
    expect(dto).not.toHaveProperty('fundacionId');
    expect(res.body.estado).toBe('revocada');
    expect(res.body.motivoCierre).toBe('Maltrato');
    expect(res.body.fechaCierre).toBe('2026-12-01T10:00:00.000Z');
    expect(res.body.seguimientos[0].estado).toBe('cancelado');
    expect(JSON.stringify(res.body)).not.toMatch(/actaUrl|privado\/|numeroDocumento/);
  });

  it('rechaza con 400 un cuerpo inválido sin llegar al servicio', async () => {
    for (const cuerpo of [
      {},
      { estado: 'activa', motivo: 'x' },
      { estado: 'finalizada' },
      { estado: 'revocada', motivo: 'x' },
      { estado: 'revocada', motivo: 'x', mascotaDestino: 'adoptada' },
      { estado: 'finalizada', motivo: 'a'.repeat(301) },
    ]) {
      await patch().send(cuerpo).expect(400);
    }
    await patch('fundacion', '/adopciones/0/estado').send(CUERPO).expect(400);
    expect(cierre.cerrar).not.toHaveBeenCalled();
  });

  it('propaga 404 uniforme y 409 del service', async () => {
    cierre.cerrar.mockRejectedValueOnce(new NotFoundException('La adopción no existe'));
    const noExiste = await patch().send(CUERPO).expect(404);
    expect(noExiste.body.message).toBe('La adopción no existe');
    cierre.cerrar.mockRejectedValueOnce(new ConflictException('La adopción ya está revocada'));
    await patch().send(CUERPO).expect(409);
  });
});
