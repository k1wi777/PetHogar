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
import { EvidenciasService } from './evidencias.service';
import { ResultadoService } from './resultado.service';
import { SeguimientosFundacionController } from './seguimientos-fundacion.controller';
import { SeguimientosService } from './seguimientos.service';

const SUCIO = { clave: 'privado/seguimientos/a.jpg', numeroDocumento: '1', contrasena: 'h' };
const DETALLE = {
  id: 5,
  adopcionId: 9,
  tipo: 'reporte',
  fechaProgramada: '2026-12-15',
  fechaRealizada: null,
  estado: 'programado',
  vencido: false,
  tieneReporte: true,
  mascota: { id: 4, nombre: 'Luna' },
  adoptante: { nombreCompleto: 'Ana Pérez', ...SUCIO },
  fechaEntrega: '2026-11-20',
  estadoBienestar: null,
  observaciones: null,
  reporte: {
    comentarios: 'Bien',
    enviadoEn: new Date('2026-12-01T10:00:00Z'),
    fotos: [{ id: 21 }],
  },
  evidencias: [],
  ...SUCIO,
};

describe('SeguimientosFundacionController (HTTP, servicios simulados)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const seguimientos = {
    programar: jest.fn(),
    listarDeFundacion: jest.fn(),
    obtenerDeFundacion: jest.fn(),
  };
  const resultados = { registrar: jest.fn() };
  const evidencias = { leer: jest.fn() };
  const fundaciones = { estadoPorUsuarioId: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [SeguimientosFundacionController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        ApprovedFoundationGuard,
        { provide: FundacionesService, useValue: fundaciones },
        { provide: SeguimientosService, useValue: seguimientos },
        { provide: ResultadoService, useValue: resultados },
        { provide: EvidenciasService, useValue: evidencias },
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

  const token = (rol: string) => `Bearer ${jwt.sign({ sub: 9, rol })}`;
  const http = (metodo: 'get' | 'post' | 'patch', ruta: string, rol = 'fundacion') =>
    request(app.getHttpServer())[metodo](ruta).set('Authorization', token(rol));

  it('exige rol fundación y fundación aprobada en todas las rutas', async () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, SeguimientosFundacionController)).toEqual([
      'fundacion',
    ]);
    expect(Reflect.getMetadata('__guards__', SeguimientosFundacionController)).toContain(
      ApprovedFoundationGuard,
    );
    const rutas: ['get' | 'post' | 'patch', string][] = [
      ['post', '/adopciones/1/seguimientos'],
      ['get', '/fundacion/seguimientos'],
      ['get', '/fundacion/seguimientos/1'],
      ['patch', '/seguimientos/1/resultado'],
      ['get', '/fundacion/seguimientos/1/evidencias/2'],
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
    await http('post', '/adopciones/1/seguimientos')
      .send({ tipo: 'visita', fechaProgramada: '2026-12-15' })
      .expect(403);
    await http('get', '/fundacion/seguimientos').expect(403);
    expect(seguimientos.programar).not.toHaveBeenCalled();
    expect(seguimientos.listarDeFundacion).not.toHaveBeenCalled();
  });

  describe('POST /adopciones/:id/seguimientos', () => {
    it('programa con la fundación del guard (nunca del cuerpo) y responde 201 sin claves', async () => {
      seguimientos.programar.mockResolvedValue(DETALLE);
      const res = await http('post', '/adopciones/9/seguimientos')
        .send({ tipo: 'reporte', fechaProgramada: '2026-12-15' })
        .expect(201);
      expect(seguimientos.programar).toHaveBeenCalledTimes(1);
      const [fundacionId, adopcionId, dto] = seguimientos.programar.mock.calls[0] as [
        number,
        number,
        object,
      ];
      expect([fundacionId, adopcionId]).toEqual([3, 9]);
      expect(dto).toMatchObject({ tipo: 'reporte', fechaProgramada: '2026-12-15' });
      expect(res.body.id).toBe(5);
      expect(JSON.stringify(res.body)).not.toMatch(/privado\/|clave|numeroDocumento|contrasena/);
    });

    it('descarta una fundacionId del cuerpo (whitelist) y rechaza datos inválidos con 400', async () => {
      seguimientos.programar.mockResolvedValue(DETALLE);
      await http('post', '/adopciones/9/seguimientos')
        .send({ tipo: 'visita', fechaProgramada: '2026-12-15', fundacionId: 99 })
        .expect(201);
      const [fundacionId, , dto] = seguimientos.programar.mock.calls[0] as [number, number, object];
      expect(fundacionId).toBe(3);
      expect(dto).not.toHaveProperty('fundacionId');
      seguimientos.programar.mockClear();
      for (const cuerpo of [
        { tipo: 'x', fechaProgramada: '2026-12-15' },
        { tipo: 'visita', fechaProgramada: '2026-02-30' },
        { tipo: 'visita' },
      ]) {
        await http('post', '/adopciones/9/seguimientos').send(cuerpo).expect(400);
      }
      await http('post', '/adopciones/0/seguimientos')
        .send({ tipo: 'visita', fechaProgramada: '2026-12-15' })
        .expect(400);
      expect(seguimientos.programar).not.toHaveBeenCalled();
    });

    it('propaga 404 y 409 del service', async () => {
      seguimientos.programar.mockRejectedValueOnce(new NotFoundException('La adopción no existe'));
      const noExiste = await http('post', '/adopciones/9/seguimientos')
        .send({ tipo: 'visita', fechaProgramada: '2026-12-15' })
        .expect(404);
      expect(noExiste.body.message).toBe('La adopción no existe');
      seguimientos.programar.mockRejectedValueOnce(
        new ConflictException('La adopción ya está revocada'),
      );
      await http('post', '/adopciones/9/seguimientos')
        .send({ tipo: 'visita', fechaProgramada: '2026-12-15' })
        .expect(409);
    });
  });

  describe('lecturas', () => {
    it('listar usa la fundación del guard y valida estado, tipo, adopción y paginación', async () => {
      seguimientos.listarDeFundacion.mockResolvedValue({
        data: [DETALLE],
        total: 1,
        page: 1,
        limit: 10,
      });
      const res = await http(
        'get',
        '/fundacion/seguimientos?estado=vencido&tipo=reporte&adopcionId=9',
      ).expect(200);
      expect(seguimientos.listarDeFundacion.mock.calls[0][0]).toBe(3);
      expect(seguimientos.listarDeFundacion.mock.calls[0][1]).toEqual({
        estado: 'vencido',
        tipo: 'reporte',
        adopcionId: 9,
      });
      expect(res.body.data[0].adoptante).toEqual({ nombreCompleto: 'Ana Pérez' });
      expect(res.body.data[0]).not.toHaveProperty('reporte');
      expect(JSON.stringify(res.body)).not.toMatch(/privado\/|clave|numeroDocumento|contrasena/);
      for (const mala of [
        'estado=x',
        'tipo=x',
        'adopcionId=0',
        'adopcionId=abc',
        'limit=101',
        'page=0',
      ]) {
        await http('get', `/fundacion/seguimientos?${mala}`).expect(400);
      }
    });

    it('el detalle trae resultado, reporte y enlaces de descarga; ajeno es 404', async () => {
      seguimientos.obtenerDeFundacion.mockResolvedValue(DETALLE);
      const res = await http('get', '/fundacion/seguimientos/5').expect(200);
      expect(seguimientos.obtenerDeFundacion).toHaveBeenCalledWith(3, 5);
      expect(res.body.reporte.fotos).toEqual([
        { id: 21, url: '/api/fundacion/seguimientos/5/evidencias/21' },
      ]);
      expect(JSON.stringify(res.body)).not.toMatch(/privado\/|clave|numeroDocumento|contrasena/);

      seguimientos.obtenerDeFundacion.mockRejectedValue(
        new NotFoundException('El seguimiento no existe'),
      );
      const ajeno = await http('get', '/fundacion/seguimientos/99').expect(404);
      expect(ajeno.body.message).toBe('El seguimiento no existe');
      await http('get', '/fundacion/seguimientos/0').expect(400);
    });
  });

  describe('PATCH /seguimientos/:id/resultado', () => {
    const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const cerrar = () =>
      http('patch', '/seguimientos/5/resultado')
        .field('fechaRealizada', '2026-12-14')
        .field('estadoBienestar', 'malo')
        .field('observaciones', '  Se ve delgado  ');

    it('limita a 10 por minuto', () => {
      expect(
        Reflect.getMetadata(
          'THROTTLER:LIMITdefault',
          SeguimientosFundacionController.prototype.registrarResultado,
        ),
      ).toBe(10);
    });

    it('usa la fundación del guard, recorta y entrega los buffers de las evidencias', async () => {
      resultados.registrar.mockResolvedValue(DETALLE);
      const res = await cerrar()
        .attach('evidencias', JPG, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(200);
      const [id, fundacionId, dto, evidencias] = resultados.registrar.mock.calls[0] as [
        number,
        number,
        Record<string, string>,
        Buffer[],
      ];
      expect([id, fundacionId]).toEqual([5, 3]);
      expect(dto).toMatchObject({
        fechaRealizada: '2026-12-14',
        estadoBienestar: 'malo',
        observaciones: 'Se ve delgado',
      });
      expect(evidencias).toHaveLength(1);
      expect(evidencias[0].equals(JPG)).toBe(true);
      expect(JSON.stringify(res.body)).not.toMatch(/privado\/|clave|numeroDocumento|contrasena/);
    });

    it('acepta el cierre sin evidencias', async () => {
      resultados.registrar.mockResolvedValue(DETALLE);
      await cerrar().expect(200);
      expect(resultados.registrar.mock.calls[0][3]).toEqual([]);
    });

    it('rechaza con 400 campos ausentes o inválidos', async () => {
      const base = () => http('patch', '/seguimientos/5/resultado');
      await base().field('estadoBienestar', 'malo').field('observaciones', 'x').expect(400);
      await base().field('fechaRealizada', '2026-12-14').field('observaciones', 'x').expect(400);
      await base()
        .field('fechaRealizada', '2026-12-14')
        .field('estadoBienestar', 'malo')
        .expect(400);
      await base()
        .field('fechaRealizada', '2026-12-14')
        .field('estadoBienestar', 'pésimo')
        .field('observaciones', 'x')
        .expect(400);
      await base()
        .field('fechaRealizada', '2026-02-30')
        .field('estadoBienestar', 'bueno')
        .field('observaciones', 'x')
        .expect(400);
      await base()
        .field('fechaRealizada', '2026-12-14')
        .field('estadoBienestar', 'bueno')
        .field('observaciones', 'a'.repeat(501))
        .expect(400);
      await http('patch', '/seguimientos/0/resultado')
        .field('fechaRealizada', '2026-12-14')
        .field('estadoBienestar', 'bueno')
        .field('observaciones', 'x')
        .expect(400);
      expect(resultados.registrar).not.toHaveBeenCalled();
    });

    it('rechaza con 400 más de 5 evidencias y con 413 una de más de 5 MB', async () => {
      let r = cerrar();
      for (let i = 0; i < 6; i++) r = r.attach('evidencias', JPG, `f${i}.jpg`);
      await r.expect(400);
      await cerrar()
        .attach('evidencias', Buffer.alloc(5 * 1024 * 1024 + 1, 1), 'grande.jpg')
        .expect(413);
      expect(resultados.registrar).not.toHaveBeenCalled();
    });

    it('propaga 404 y 409 del service', async () => {
      resultados.registrar.mockRejectedValueOnce(new NotFoundException('El seguimiento no existe'));
      await cerrar().expect(404);
      resultados.registrar.mockRejectedValueOnce(
        new ConflictException('El seguimiento ya fue registrado como realizado'),
      );
      const res = await cerrar().expect(409);
      expect(res.body.message).toBe('El seguimiento ya fue registrado como realizado');
    });
  });

  describe('descarga de fotos', () => {
    const RUTA = '/fundacion/seguimientos/5/evidencias/21';
    const get = (ruta = RUTA) =>
      request(app.getHttpServer())
        .get(ruta)
        .set('Authorization', `Bearer ${jwt.sign({ sub: 9, rol: 'fundacion' })}`);

    it('entrega el tipo real con cabeceras seguras y límite de 30 por minuto', async () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
      evidencias.leer.mockResolvedValue({
        buffer,
        tipo: 'image/jpeg',
        tamano: buffer.length,
        nombreArchivo: 'evidencia-seguimiento-5-21.jpg',
      });
      const res = await get().expect(200);
      expect(evidencias.leer).toHaveBeenCalledWith(5, 21, { tipo: 'fundacion', fundacionId: 3 });
      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(res.headers['content-disposition']).toBe(
        'inline; filename="evidencia-seguimiento-5-21.jpg"',
      );
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
      expect(
        Reflect.getMetadata(
          'THROTTLER:LIMITdefault',
          SeguimientosFundacionController.prototype.descargarFoto,
        ),
      ).toBe(30);
    });

    it('una foto ajena es 404 JSON y no entrega nada; ids inválidos, 400', async () => {
      evidencias.leer.mockRejectedValue(new NotFoundException('La foto no existe'));
      const res = await get().expect(404);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body.message).toBe('La foto no existe');
      evidencias.leer.mockClear();
      await get(RUTA.replace('/21', '/0')).expect(400);
      expect(evidencias.leer).not.toHaveBeenCalled();
    });
  });
});
