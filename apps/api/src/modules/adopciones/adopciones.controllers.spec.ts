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
import { AdopcionesAdoptanteController } from './adopciones-adoptante.controller';
import { AdopcionesFundacionController } from './adopciones-fundacion.controller';
import { AdopcionesService } from './adopciones.service';

const SUCIO = {
  actaUrl: 'privado/solicitudes/a.pdf',
  clave: 'privado/x',
  numeroDocumento: '1',
  fechaNacimiento: '1990-01-01',
  direccion: 'Calle 1',
};
const BASE = {
  id: 5,
  fechaEntrega: '2026-12-01',
  estado: 'activa',
  solicitudId: 11,
  mascota: { id: 7, nombre: 'Luna' },
  tieneActa: true,
  ...SUCIO,
};
const DE_ADOPTANTE = { ...BASE, fundacion: { nombre: 'Refugio', ciudad: 'Bogotá', ...SUCIO } };
const DE_FUNDACION = {
  ...BASE,
  adoptante: { nombreCompleto: 'Ana', email: 'a@x.co', telefono: '3', ciudad: 'Cali', ...SUCIO },
};
const PDF = Buffer.from('%PDF-1.7\nxx');
const ARCHIVO = {
  buffer: PDF,
  tipo: 'application/pdf',
  tamano: PDF.length,
  nombreArchivo: 'acta-adopcion-5.pdf',
};

describe('Controllers de adopciones (HTTP, servicios simulados)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const adopciones = {
    listarMias: jest.fn(),
    listarDeFundacion: jest.fn(),
    subirActa: jest.fn(),
    leerActa: jest.fn(),
  };
  const fundaciones = { estadoPorUsuarioId: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [AdopcionesAdoptanteController, AdopcionesFundacionController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        ApprovedFoundationGuard,
        { provide: FundacionesService, useValue: fundaciones },
        { provide: AdopcionesService, useValue: adopciones },
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

  const http = (metodo: 'get' | 'post', ruta: string, rol: string) =>
    request(app.getHttpServer())
      [metodo](ruta)
      .set('Authorization', `Bearer ${jwt.sign({ sub: 9, rol })}`);

  it('cada controller exige su rol; la fundación además aprobada; anónimos 401', async () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, AdopcionesAdoptanteController)).toEqual([
      'adoptante',
    ]);
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, AdopcionesFundacionController)).toEqual([
      'fundacion',
    ]);
    expect(Reflect.getMetadata('__guards__', AdopcionesFundacionController)).toContain(
      ApprovedFoundationGuard,
    );
    for (const ruta of ['/mis-adopciones', '/mis-adopciones/1/acta']) {
      await request(app.getHttpServer()).get(ruta).expect(401);
      await http('get', ruta, 'fundacion').expect(403);
      await http('get', ruta, 'administrador').expect(403);
    }
    for (const [metodo, ruta] of [
      ['get', '/fundacion/adopciones'],
      ['get', '/fundacion/adopciones/1/acta'],
      ['post', '/fundacion/adopciones/1/acta'],
    ] as const) {
      await request(app.getHttpServer())[metodo](ruta).expect(401);
      await http(metodo, ruta, 'adoptante').expect(403);
    }
    fundaciones.estadoPorUsuarioId.mockResolvedValue({
      id: 3,
      estadoValidacion: EstadoValidacion.Pendiente,
    });
    await http('get', '/fundacion/adopciones', 'fundacion').expect(403);
    expect(adopciones.listarMias).not.toHaveBeenCalled();
    expect(adopciones.listarDeFundacion).not.toHaveBeenCalled();
    expect(adopciones.subirActa).not.toHaveBeenCalled();
  });

  it('mis-adopciones mapea con acta como enlace, seguimientos [] y la fundación solo con nombre y ciudad', async () => {
    adopciones.listarMias.mockResolvedValue({
      data: [DE_ADOPTANTE, { ...DE_ADOPTANTE, tieneActa: false }],
      total: 2,
      page: 1,
      limit: 10,
    });
    const res = await http('get', '/mis-adopciones?estado=activa', 'adoptante').expect(200);
    expect(adopciones.listarMias.mock.calls[0][0]).toBe(9);
    expect(adopciones.listarMias.mock.calls[0][1]).toEqual({ estado: 'activa' });
    expect(res.body.data[0]).toEqual({
      id: 5,
      fechaEntrega: '2026-12-01',
      estado: 'activa',
      solicitudId: 11,
      mascota: { id: 7, nombre: 'Luna' },
      acta: { url: '/api/mis-adopciones/5/acta' },
      seguimientos: [],
      fundacion: { nombre: 'Refugio', ciudad: 'Bogotá' },
    });
    expect(res.body.data[1].acta).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(
      /actaUrl|privado\/|numeroDocumento|fechaNacimiento|direccion|"clave"/,
    );
    await http('get', '/mis-adopciones?estado=x', 'adoptante').expect(400);
    await http('get', '/mis-adopciones?limit=101', 'adoptante').expect(400);
  });

  it('fundacion/adopciones usa la fundación del guard y expone solo los datos mínimos del adoptante', async () => {
    adopciones.listarDeFundacion.mockResolvedValue({
      data: [DE_FUNDACION],
      total: 1,
      page: 1,
      limit: 10,
    });
    const res = await http('get', '/fundacion/adopciones', 'fundacion').expect(200);
    expect(adopciones.listarDeFundacion.mock.calls[0][0]).toBe(3);
    expect(res.body.data[0].adoptante).toEqual({
      nombreCompleto: 'Ana',
      email: 'a@x.co',
      telefono: '3',
      ciudad: 'Cali',
    });
    expect(res.body.data[0].acta).toEqual({ url: '/api/fundacion/adopciones/5/acta' });
    expect(res.body.data[0].seguimientos).toEqual([]);
    expect(JSON.stringify(res.body)).not.toMatch(
      /actaUrl|privado\/|numeroDocumento|fechaNacimiento|direccion/,
    );
  });

  describe('acta', () => {
    it('POST entrega fundación del guard, id y archivo; responde 201 sin la clave', async () => {
      adopciones.subirActa.mockResolvedValue(DE_FUNDACION);
      const res = await http('post', '/fundacion/adopciones/5/acta', 'fundacion')
        .attach('acta', PDF, { filename: 'a.pdf' })
        .expect(201);
      const [id, fundacionId, buffer] = adopciones.subirActa.mock.calls[0];
      expect([id, fundacionId]).toEqual([5, 3]);
      expect(buffer.equals(PDF)).toBe(true);
      expect(JSON.stringify(res.body)).not.toMatch(/actaUrl|privado\//);
    });

    it('campo equivocado 400, más de 5 MB 413, id no válido 400; sin llegar al servicio', async () => {
      await http('post', '/fundacion/adopciones/5/acta', 'fundacion')
        .attach('otro', PDF, { filename: 'a.pdf' })
        .expect(400);
      await http('post', '/fundacion/adopciones/5/acta', 'fundacion')
        .attach('acta', Buffer.alloc(5 * 1024 * 1024 + 1, 1), { filename: 'a.pdf' })
        .expect(413);
      await http('post', '/fundacion/adopciones/0/acta', 'fundacion')
        .attach('acta', PDF, { filename: 'a.pdf' })
        .expect(400);
      expect(adopciones.subirActa).not.toHaveBeenCalled();
    });

    it('límites: subir 10 por minuto, descargar 30', () => {
      const limite = (fn: unknown): unknown =>
        Reflect.getMetadata('THROTTLER:LIMITdefault', fn as object);
      expect(limite(AdopcionesFundacionController.prototype.subirActa)).toBe(10);
      expect(limite(AdopcionesFundacionController.prototype.acta)).toBe(30);
      expect(limite(AdopcionesAdoptanteController.prototype.acta)).toBe(30);
    });

    it.each([
      ['fundacion', '/fundacion/adopciones/5/acta', { tipo: 'fundacion', fundacionId: 3 }],
      ['adoptante', '/mis-adopciones/5/acta', { tipo: 'adoptante', usuarioId: 9 }],
    ] as const)(
      'la descarga de %s entrega el tipo real con cabeceras seguras',
      async (rol, ruta, propietario) => {
        adopciones.leerActa.mockResolvedValue(ARCHIVO);
        const res = await http('get', ruta, rol).expect(200);
        expect(adopciones.leerActa).toHaveBeenCalledWith(5, propietario);
        expect(res.headers['content-type']).toBe('application/pdf');
        expect(res.headers['content-disposition']).toBe('inline; filename="acta-adopcion-5.pdf"');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['cache-control']).toBe('private, no-store');
        expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
      },
    );

    it('una adopción ajena responde 404', async () => {
      adopciones.leerActa.mockRejectedValue(new NotFoundException('La adopción no existe'));
      await http('get', '/mis-adopciones/9/acta', 'adoptante').expect(404);
      await http('get', '/fundacion/adopciones/9/acta', 'fundacion').expect(404);
    });
  });
});
