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
import { DonacionesController } from './donaciones.controller';
import { DonacionesService } from './donaciones.service';

const PDF = Buffer.from('%PDF-1.7\nxx');
const RESUMEN = {
  id: 55,
  fundacion: { id: 3, nombre: 'Huellas', usuarioId: 20, documentoUrl: 'privado/fundaciones/x.pdf' },
  tipo: 'economica',
  monto: '50000.00',
  descripcionEspecie: null,
  fecha: new Date('2026-10-29T15:00:00Z'),
  comprobante: true,
  // Datos «sucios» que no deben salir.
  comprobanteUrl: 'privado/donaciones/a.pdf',
  clave: 'privado/donaciones/a.pdf',
  usuarioId: 9,
};

describe('DonacionesController (HTTP, servicio simulado)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const donaciones = { crear: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [DonacionesController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: DonacionesService, useValue: donaciones },
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

  const enviar = (campos: Record<string, string>, rol = 'adoptante') => {
    const r = request(app.getHttpServer())
      .post('/donaciones')
      .set('Authorization', `Bearer ${jwt.sign({ sub: 9, rol })}`);
    for (const [k, v] of Object.entries(campos)) r.field(k, v);
    return r;
  };
  const CAMPOS = { fundacionId: '3', tipo: 'economica', monto: '50000.00' };

  it('adoptante y fundación pueden donar; el administrador 403 y el anónimo 401', async () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, DonacionesController)).toEqual([
      'adoptante',
      'fundacion',
    ]);
    donaciones.crear.mockResolvedValue(RESUMEN);
    await enviar(CAMPOS, 'adoptante').expect(201);
    await enviar(CAMPOS, 'fundacion').expect(201);
    await enviar(CAMPOS, 'administrador').expect(403);
    await request(app.getHttpServer()).post('/donaciones').field('tipo', 'economica').expect(401);
    expect(donaciones.crear).toHaveBeenCalledTimes(2);
  });

  it('el donante es el del token: lo que el cuerpo diga de usuarioId se descarta', async () => {
    donaciones.crear.mockResolvedValue(RESUMEN);
    await enviar({ ...CAMPOS, usuarioId: '77' }).expect(201);
    const [usuario, dto, buffer] = donaciones.crear.mock.calls[0];
    expect(usuario).toEqual({ id: 9, rol: 'adoptante' });
    expect(dto).toMatchObject({ fundacionId: 3, tipo: 'economica', monto: '50000.00' });
    expect(dto).not.toHaveProperty('usuarioId');
    expect(buffer).toBeUndefined();
  });

  it('entrega el comprobante al servicio y responde un resumen sin claves ni datos internos', async () => {
    donaciones.crear.mockResolvedValue(RESUMEN);
    const res = await enviar(CAMPOS).attach('comprobante', PDF, { filename: 'c.pdf' }).expect(201);
    expect(donaciones.crear.mock.calls[0][2].equals(PDF)).toBe(true);
    expect(Object.keys(res.body).sort()).toEqual([
      'comprobante',
      'descripcionEspecie',
      'fecha',
      'fundacion',
      'id',
      'monto',
      'tipo',
    ]);
    expect(res.body.fundacion).toEqual({ id: 3, nombre: 'Huellas' });
    expect(res.body.monto).toBe('50000.00');
    expect(JSON.stringify(res.body)).not.toMatch(
      /privado\/|comprobanteUrl|clave|usuarioId|documento/,
    );
  });

  it('datos inválidos dan 400 por campo sin llegar al servicio', async () => {
    const res = await enviar({ fundacionId: 'x', tipo: 'economica', monto: '0' }).expect(400);
    expect(res.body.errores.map((e: { campo: string }) => e.campo).sort()).toEqual([
      'fundacionId',
      'monto',
    ]);
    await enviar({ fundacionId: '3', tipo: 'especie' }).expect(400);
    expect(donaciones.crear).not.toHaveBeenCalled();
  });

  it('campo de archivo equivocado 400 y más de 5 MB 413, sin llegar al servicio', async () => {
    await enviar(CAMPOS).attach('otro', PDF, { filename: 'c.pdf' }).expect(400);
    const res = await enviar(CAMPOS)
      .attach('comprobante', Buffer.alloc(5 * 1024 * 1024 + 1, 1), { filename: 'c.pdf' })
      .expect(413);
    expect(res.body.message).toContain('5 MB');
    expect(donaciones.crear).not.toHaveBeenCalled();
  });

  it('una fundación inexistente o no aprobada responde 404 con el mensaje uniforme', async () => {
    donaciones.crear.mockRejectedValue(
      new NotFoundException('La fundación no existe o no recibe donaciones'),
    );
    const res = await enviar(CAMPOS).expect(404);
    expect(res.body.message).toBe('La fundación no existe o no recibe donaciones');
  });

  it('limita a 10 peticiones por minuto por IP', () => {
    expect(
      Reflect.getMetadata('THROTTLER:LIMITdefault', DonacionesController.prototype.crear),
    ).toBe(10);
  });
});
