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
import { ComprobanteService } from './comprobante.service';
import { DonacionesFundacionController } from './donaciones-fundacion.controller';
import { DonacionesService } from './donaciones.service';

const PDF = Buffer.from('%PDF-1.7\nxx');
const SUCIO = { comprobanteUrl: 'privado/donaciones/a.pdf', correo: 'a@x.co', telefono: '300' };
const PAGINA = {
  data: [
    {
      id: 5,
      tipo: 'economica',
      monto: '10.50',
      descripcionEspecie: null,
      fecha: new Date('2026-10-29T15:00:00Z'),
      donante: { nombre: 'Ana Pérez', origen: 'plataforma', ...SUCIO },
      comprobante: { url: '/api/fundacion/donaciones/5/comprobante', ...SUCIO },
      usuarioId: 9,
      ...SUCIO,
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
  totales: { economica: { cantidad: 1, monto: '10.50' }, especie: { cantidad: 0 } },
};

describe('DonacionesFundacionController (HTTP, servicios simulados)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const donaciones = { listar: jest.fn(), crearManual: jest.fn() };
  const comprobantes = { leer: jest.fn() };
  const fundaciones = { estadoPorUsuarioId: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [DonacionesFundacionController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        ApprovedFoundationGuard,
        { provide: FundacionesService, useValue: fundaciones },
        { provide: DonacionesService, useValue: donaciones },
        { provide: ComprobanteService, useValue: comprobantes },
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

  const http = (metodo: 'get' | 'post', ruta: string, rol = 'fundacion') =>
    request(app.getHttpServer())
      [metodo](ruta)
      .set('Authorization', `Bearer ${jwt.sign({ sub: 9, rol })}`);

  it('exige rol fundación y fundación aprobada; anónimos 401 y otros roles 403', async () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, DonacionesFundacionController)).toEqual([
      'fundacion',
    ]);
    expect(Reflect.getMetadata('__guards__', DonacionesFundacionController)).toContain(
      ApprovedFoundationGuard,
    );
    const rutas: ['get' | 'post', string][] = [
      ['get', '/fundacion/donaciones'],
      ['post', '/fundacion/donaciones'],
      ['get', '/fundacion/donaciones/1/comprobante'],
    ];
    for (const [metodo, ruta] of rutas) {
      await request(app.getHttpServer())[metodo](ruta).expect(401);
      await http(metodo, ruta, 'adoptante').expect(403);
      await http(metodo, ruta, 'administrador').expect(403);
    }
    fundaciones.estadoPorUsuarioId.mockResolvedValue({
      id: 3,
      estadoValidacion: EstadoValidacion.Pendiente,
    });
    await http('get', '/fundacion/donaciones').expect(403);
    expect(donaciones.listar).not.toHaveBeenCalled();
  });

  it('listar usa la fundación del token, pasa el filtro y mapea sin datos sensibles', async () => {
    donaciones.listar.mockResolvedValue(PAGINA);
    const res = await http(
      'get',
      '/fundacion/donaciones?desde=2026-10-01&hasta=2026-10-31&tipo=economica&page=1&limit=10',
    ).expect(200);
    const [fundacionId, consulta] = donaciones.listar.mock.calls[0];
    expect(fundacionId).toBe(3);
    expect(consulta).toMatchObject({ desde: '2026-10-01', hasta: '2026-10-31', tipo: 'economica' });
    expect(res.body.totales).toEqual(PAGINA.totales);
    expect(Object.keys(res.body.data[0]).sort()).toEqual([
      'comprobante',
      'descripcionEspecie',
      'donante',
      'fecha',
      'id',
      'monto',
      'tipo',
    ]);
    expect(res.body.data[0].donante).toEqual({ nombre: 'Ana Pérez', origen: 'plataforma' });
    expect(res.body.data[0].comprobante).toEqual({
      url: '/api/fundacion/donaciones/5/comprobante',
    });
    expect(JSON.stringify(res.body)).not.toMatch(
      /privado\/|comprobanteUrl|a@x\.co|telefono|usuarioId/,
    );
  });

  it('rechaza filtros inválidos con 400', async () => {
    await http('get', '/fundacion/donaciones?desde=2026-02-30').expect(400);
    await http('get', '/fundacion/donaciones?tipo=otro').expect(400);
    await http('get', '/fundacion/donaciones?limit=101').expect(400);
    expect(donaciones.listar).not.toHaveBeenCalled();
  });

  it('el registro manual toma la fundación del token y descarta fundacionId y usuarioId', async () => {
    donaciones.crearManual.mockResolvedValue({
      id: 8,
      fundacion: { id: 3, nombre: 'Huellas' },
      tipo: 'especie',
      monto: null,
      descripcionEspecie: 'Cobijas',
      fecha: new Date(),
      comprobante: false,
      ...SUCIO,
    });
    const res = await http('post', '/fundacion/donaciones')
      .field('nombreDonante', ' Pedro Paz ')
      .field('tipo', 'especie')
      .field('descripcion', 'Cobijas')
      .field('fundacionId', '99')
      .field('usuarioId', '12')
      .expect(201);
    const [fundacionId, dto, buffer] = donaciones.crearManual.mock.calls[0];
    expect(fundacionId).toBe(3);
    expect(dto).toMatchObject({
      nombreDonante: 'Pedro Paz',
      tipo: 'especie',
      descripcion: 'Cobijas',
    });
    expect(dto).not.toHaveProperty('fundacionId');
    expect(dto).not.toHaveProperty('usuarioId');
    expect(buffer).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/privado\/|comprobanteUrl|a@x\.co/);
  });

  it('el registro manual exige nombre y valida el monto', async () => {
    const res = await http('post', '/fundacion/donaciones')
      .field('tipo', 'economica')
      .field('monto', '-5')
      .expect(400);
    expect(res.body.errores.map((e: { campo: string }) => e.campo).sort()).toEqual([
      'monto',
      'nombreDonante',
    ]);
    expect(donaciones.crearManual).not.toHaveBeenCalled();
  });

  it('el registro manual acepta un comprobante', async () => {
    donaciones.crearManual.mockResolvedValue({
      id: 8,
      fundacion: { id: 3, nombre: 'H' },
      tipo: 'economica',
      monto: '5.00',
      descripcionEspecie: null,
      fecha: new Date(),
      comprobante: true,
    });
    await http('post', '/fundacion/donaciones')
      .field('nombreDonante', 'Pedro')
      .field('tipo', 'economica')
      .field('monto', '5')
      .attach('comprobante', PDF, { filename: 'c.pdf' })
      .expect(201);
    expect(donaciones.crearManual.mock.calls[0][2].equals(PDF)).toBe(true);
  });

  it('la descarga entrega el tipo real con cabeceras seguras, sin la clave, y ajena es 404', async () => {
    comprobantes.leer.mockResolvedValue({
      buffer: PDF,
      tipo: 'application/pdf',
      tamano: PDF.length,
      nombreArchivo: 'comprobante-donacion-7.pdf',
    });
    const res = await http('get', '/fundacion/donaciones/7/comprobante').expect(200);
    expect(comprobantes.leer).toHaveBeenCalledWith(7, 3);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['content-disposition']).toBe(
      'inline; filename="comprobante-donacion-7.pdf"',
    );

    comprobantes.leer.mockRejectedValue(
      new NotFoundException('La donación o su comprobante no existe'),
    );
    const noExiste = await http('get', '/fundacion/donaciones/8/comprobante').expect(404);
    expect(noExiste.body.message).toBe('La donación o su comprobante no existe');
    await http('get', '/fundacion/donaciones/0/comprobante').expect(400);
  });

  it('límites por IP: 10 al registrar y 30 en la descarga', () => {
    const limite = (fn: unknown): unknown =>
      Reflect.getMetadata('THROTTLER:LIMITdefault', fn as object);
    const proto = DonacionesFundacionController.prototype;
    expect(limite(proto.crearManual)).toBe(10);
    expect(limite(proto.comprobante)).toBe(30);
  });
});
