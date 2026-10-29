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
import { EstadoValidacion } from '../fundaciones/entities/fundacion.enum';
import { FundacionesService } from '../fundaciones/fundaciones.service';
import { ApprovedFoundationGuard } from '../fundaciones/guards/approved-foundation.guard';
import { FormularioService } from './formulario.service';
import { SolicitudesFundacionController } from './solicitudes-fundacion.controller';
import { SolicitudesService } from './solicitudes.service';

const CLAVE = 'privado/solicitudes/aaa.pdf';
// Lo que traería un objeto crudo del adoptante con todo lo que la fundación NO debe ver.
const SUCIO = {
  numeroDocumento: '123',
  tipoDocumento: 'CC',
  fechaNacimiento: '1990-01-01',
  direccion: 'Calle 1',
  contrasena: 'hash',
  formularioUrl: CLAVE,
};
const DETALLE = {
  id: 11,
  fechaSolicitud: new Date('2026-01-01T00:00:00Z'),
  estado: 'pendiente',
  mascota: { id: 7, nombre: 'Luna' },
  motivo: 'm',
  tipoVivienda: 'casa',
  tieneOtrasMascotas: true,
  observacion: null,
  fechaRespuesta: null,
  adoptante: {
    nombreCompleto: 'Ana Pérez',
    email: 'ana@x.co',
    telefono: '300',
    ciudad: 'Bogotá',
    ...SUCIO,
  },
  ...SUCIO,
};

describe('SolicitudesFundacionController (HTTP, servicios simulados)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const solicitudes = { listarDeFundacion: jest.fn(), obtenerDeFundacion: jest.fn() };
  const formularios = { leer: jest.fn() };
  const fundaciones = { estadoPorUsuarioId: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [SolicitudesFundacionController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        ApprovedFoundationGuard,
        { provide: FundacionesService, useValue: fundaciones },
        { provide: SolicitudesService, useValue: solicitudes },
        { provide: FormularioService, useValue: formularios },
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

  const http = (ruta: string, rol = 'fundacion') =>
    request(app.getHttpServer())
      .get(ruta)
      .set('Authorization', `Bearer ${jwt.sign({ sub: 9, rol })}`);

  it('exige rol fundación y fundación aprobada (ApprovedFoundationGuard a nivel de clase)', async () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, SolicitudesFundacionController)).toEqual([
      'fundacion',
    ]);
    const guards = Reflect.getMetadata('__guards__', SolicitudesFundacionController) as unknown[];
    expect(guards).toContain(ApprovedFoundationGuard);
    for (const ruta of [
      '/fundacion/solicitudes',
      '/fundacion/solicitudes/1',
      '/fundacion/solicitudes/1/formulario',
    ]) {
      await request(app.getHttpServer()).get(ruta).expect(401);
      await http(ruta, 'adoptante').expect(403);
      await http(ruta, 'administrador').expect(403);
    }
    fundaciones.estadoPorUsuarioId.mockResolvedValue({
      id: 3,
      estadoValidacion: EstadoValidacion.Pendiente,
    });
    await http('/fundacion/solicitudes').expect(403);
    expect(solicitudes.listarDeFundacion).not.toHaveBeenCalled();
  });

  it('listar usa la fundación del guard y valida estado y mascota', async () => {
    solicitudes.listarDeFundacion.mockResolvedValue({
      data: [{ ...DETALLE, adoptante: { nombreCompleto: 'Ana Pérez', ...SUCIO } }],
      total: 1,
      page: 1,
      limit: 10,
    });
    const res = await http('/fundacion/solicitudes?estado=pendiente&mascotaId=7').expect(200);
    expect(solicitudes.listarDeFundacion.mock.calls[0][0]).toBe(3);
    expect(solicitudes.listarDeFundacion.mock.calls[0][1]).toEqual({
      estado: 'pendiente',
      mascotaId: 7,
    });
    expect(res.body.data[0].adoptante).toEqual({ nombreCompleto: 'Ana Pérez' });
    await http('/fundacion/solicitudes?estado=x').expect(400);
    await http('/fundacion/solicitudes?mascotaId=0').expect(400);
    await http('/fundacion/solicitudes?mascotaId=abc').expect(400);
    await http('/fundacion/solicitudes?limit=101').expect(400);
  });

  it('el detalle muestra solo nombre, correo, teléfono y ciudad del adoptante', async () => {
    solicitudes.obtenerDeFundacion.mockResolvedValue(DETALLE);
    const res = await http('/fundacion/solicitudes/11').expect(200);
    expect(solicitudes.obtenerDeFundacion).toHaveBeenCalledWith(11, 3);
    expect(res.body.adoptante).toEqual({
      nombreCompleto: 'Ana Pérez',
      email: 'ana@x.co',
      telefono: '300',
      ciudad: 'Bogotá',
    });
    expect(res.body.formulario).toEqual({ url: '/api/fundacion/solicitudes/11/formulario' });
    expect(JSON.stringify(res.body)).not.toMatch(
      /numeroDocumento|tipoDocumento|fechaNacimiento|direccion|contrasena|formularioUrl|privado\//,
    );
  });

  it('una solicitud de mascota ajena es el mismo 404 que una inexistente', async () => {
    solicitudes.obtenerDeFundacion.mockRejectedValue(
      new NotFoundException('La solicitud no existe'),
    );
    const res = await http('/fundacion/solicitudes/99').expect(404);
    expect(res.body.message).toBe('La solicitud no existe');
    await http('/fundacion/solicitudes/0').expect(400);
  });

  it('la descarga entrega el tipo real con cabeceras seguras y límite de 30 por minuto', async () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
    formularios.leer.mockResolvedValue({
      buffer,
      tipo: 'image/jpeg',
      tamano: buffer.length,
      nombreArchivo: 'formulario-solicitud-11.jpg',
    });
    const res = await http('/fundacion/solicitudes/11/formulario').expect(200);
    expect(formularios.leer).toHaveBeenCalledWith(11, { tipo: 'fundacion', fundacionId: 3 });
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['content-disposition']).toContain('formulario-solicitud-11.jpg');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(
      Reflect.getMetadata(
        'THROTTLER:LIMITdefault',
        SolicitudesFundacionController.prototype.formulario,
      ),
    ).toBe(30);
  });

  it('descargar una ajena es 404 y no entrega nada', async () => {
    formularios.leer.mockRejectedValue(new NotFoundException('La solicitud no existe'));
    const res = await http('/fundacion/solicitudes/11/formulario').expect(404);
    expect(res.headers['content-type']).toContain('application/json');
  });
});
