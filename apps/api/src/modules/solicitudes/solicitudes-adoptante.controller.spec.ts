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
import { FormularioService } from './formulario.service';
import { SolicitudesAdoptanteController } from './solicitudes-adoptante.controller';
import { SolicitudesService } from './solicitudes.service';

const CLAVE = 'privado/solicitudes/aaa.pdf';
// Datos «sucios»: lo que traería un objeto crudo con todo lo que no debe salir.
const SUCIO = { formularioUrl: CLAVE, clave: CLAVE, numeroDocumento: '1', direccion: 'Calle 1' };
const DETALLE = {
  id: 11,
  fechaSolicitud: new Date('2026-01-01T00:00:00Z'),
  estado: 'pendiente',
  mascota: { id: 7, nombre: 'Luna', ...SUCIO },
  fundacion: { nombre: 'Refugio', ...SUCIO },
  motivo: 'm',
  tipoVivienda: 'casa',
  tieneOtrasMascotas: false,
  observacion: null,
  fechaRespuesta: null,
  ...SUCIO,
};
const PDF = Buffer.from('%PDF-1.7\nxx');

describe('SolicitudesAdoptanteController (HTTP, servicios simulados)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const solicitudes = {
    crear: jest.fn(),
    listarMias: jest.fn(),
    obtenerMia: jest.fn(),
    cancelar: jest.fn(),
  };
  const formularios = { leer: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [SolicitudesAdoptanteController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
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
  beforeEach(() => jest.resetAllMocks());

  const http = (metodo: 'get' | 'post' | 'patch', ruta: string, rol = 'adoptante') =>
    request(app.getHttpServer())
      [metodo](ruta)
      .set('Authorization', `Bearer ${jwt.sign({ sub: 9, rol })}`);

  const CAMPOS = {
    mascotaId: '7',
    motivo: ' Quiero un hogar ',
    tipoVivienda: 'casa',
    tieneOtrasMascotas: 'false',
  };
  const crear = (campos: Record<string, string> = CAMPOS, rol = 'adoptante') => {
    const r = http('post', '/solicitudes', rol);
    for (const [k, v] of Object.entries(campos)) r.field(k, v);
    return r;
  };

  it('toda la clase exige rol adoptante; anónimos 401 y otros roles 403', async () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, SolicitudesAdoptanteController)).toEqual([
      'adoptante',
    ]);
    const rutas: [string, string][] = [
      ['post', '/solicitudes'],
      ['get', '/mis-solicitudes'],
      ['get', '/mis-solicitudes/1'],
      ['get', '/mis-solicitudes/1/formulario'],
      ['patch', '/solicitudes/1/cancelar'],
    ];
    for (const [metodo, ruta] of rutas) {
      await request(app.getHttpServer())[metodo as 'get'](ruta).expect(401);
      await http(metodo as 'get', ruta, 'fundacion').expect(403);
      await http(metodo as 'get', ruta, 'administrador').expect(403);
    }
    expect(solicitudes.crear).not.toHaveBeenCalled();
  });

  it('crear: valida el cuerpo multipart, recorta y entrega usuario, dto y archivo', async () => {
    solicitudes.crear.mockResolvedValue(DETALLE);
    const res = await crear().attach('formulario', PDF, { filename: 'f.pdf' }).expect(201);
    const [usuario, dto, buffer] = solicitudes.crear.mock.calls[0];
    expect(usuario).toEqual({ id: 9, rol: 'adoptante' });
    expect(dto).toMatchObject({
      mascotaId: 7,
      motivo: 'Quiero un hogar',
      tipoVivienda: 'casa',
      tieneOtrasMascotas: false,
    });
    expect(buffer.equals(PDF)).toBe(true);
    expect(res.body.formulario).toEqual({ url: '/api/mis-solicitudes/11/formulario' });
  });

  it('crear: campos inválidos dan 400 por campo sin llegar al servicio', async () => {
    const res = await crear({
      mascotaId: 'abc',
      motivo: '',
      tipoVivienda: 'castillo',
      tieneOtrasMascotas: 'quizá',
    })
      .attach('formulario', PDF, { filename: 'f.pdf' })
      .expect(400);
    expect(res.body.errores.map((e: { campo: string }) => e.campo).sort()).toEqual([
      'mascotaId',
      'motivo',
      'tieneOtrasMascotas',
      'tipoVivienda',
    ]);
    expect(solicitudes.crear).not.toHaveBeenCalled();
  });

  it('crear: sin archivo el servicio recibe undefined (y responde 400 por su cuenta)', async () => {
    solicitudes.crear.mockResolvedValue(DETALLE);
    await crear().expect(201);
    expect(solicitudes.crear.mock.calls[0][2]).toBeUndefined();
  });

  it('crear: campo de archivo equivocado 400 y más de 5 MB 413, sin llegar al servicio', async () => {
    await crear().attach('otro', PDF, { filename: 'f.pdf' }).expect(400);
    const res = await crear()
      .attach('formulario', Buffer.alloc(5 * 1024 * 1024 + 1, 1), { filename: 'f.pdf' })
      .expect(413);
    expect(res.body.message).toContain('5 MB');
    expect(solicitudes.crear).not.toHaveBeenCalled();
  });

  it('crear lleva un límite de 10 por minuto por IP; las descargas, 30', () => {
    const limite = (fn: unknown): unknown =>
      Reflect.getMetadata('THROTTLER:LIMITdefault', fn as object);
    const proto = SolicitudesAdoptanteController.prototype;
    expect(limite(proto.crear)).toBe(10);
    expect(limite(proto.formulario)).toBe(30);
  });

  it('listar entrega el filtro y mapea sin claves ni datos sensibles', async () => {
    solicitudes.listarMias.mockResolvedValue({ data: [DETALLE], total: 1, page: 1, limit: 10 });
    const res = await http('get', '/mis-solicitudes?estado=pendiente&page=1').expect(200);
    expect(solicitudes.listarMias.mock.calls[0][0]).toBe(9);
    expect(solicitudes.listarMias.mock.calls[0][1]).toEqual({ estado: 'pendiente' });
    expect(Object.keys(res.body.data[0]).sort()).toEqual([
      'estado',
      'fechaSolicitud',
      'fundacion',
      'id',
      'mascota',
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(
      /privado\/|formularioUrl|numeroDocumento|direccion/,
    );
    await http('get', '/mis-solicitudes?estado=otro').expect(400);
    await http('get', '/mis-solicitudes?limit=101').expect(400);
  });

  it('el detalle incluye el enlace de descarga y nunca la clave', async () => {
    solicitudes.obtenerMia.mockResolvedValue(DETALLE);
    const res = await http('get', '/mis-solicitudes/11').expect(200);
    expect(res.body.formulario).toEqual({ url: '/api/mis-solicitudes/11/formulario' });
    expect(res.body).toMatchObject({ observacion: null, fechaRespuesta: null, motivo: 'm' });
    expect(JSON.stringify(res.body)).not.toMatch(/privado\/|formularioUrl|"clave"/);
  });

  it('una solicitud ajena responde 404 y los ids no válidos 400', async () => {
    solicitudes.obtenerMia.mockRejectedValue(new NotFoundException('La solicitud no existe'));
    const res = await http('get', '/mis-solicitudes/5').expect(404);
    expect(res.body.message).toBe('La solicitud no existe');
    await http('get', '/mis-solicitudes/0').expect(400);
    await http('patch', '/solicitudes/abc/cancelar').expect(400);
  });

  it('cancelar pasa el usuario y el id', async () => {
    solicitudes.cancelar.mockResolvedValue({ ...DETALLE, estado: 'cancelada' });
    const res = await http('patch', '/solicitudes/11/cancelar').expect(200);
    expect(solicitudes.cancelar).toHaveBeenCalledWith(9, 11);
    expect(res.body.estado).toBe('cancelada');
  });

  it('la descarga entrega el tipo real con cabeceras seguras y sin la clave', async () => {
    formularios.leer.mockResolvedValue({
      buffer: PDF,
      tipo: 'application/pdf',
      tamano: PDF.length,
      nombreArchivo: 'formulario-solicitud-11.pdf',
    });
    const res = await http('get', '/mis-solicitudes/11/formulario').expect(200);
    expect(formularios.leer).toHaveBeenCalledWith(11, { tipo: 'adoptante', usuarioId: 9 });
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'inline; filename="formulario-solicitud-11.pdf"',
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(JSON.stringify(res.headers)).not.toContain(CLAVE);
  });
});
