import 'reflect-metadata';
import {
  ConflictException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ROLES_PERMITIDOS } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AllExceptionsFilter } from '../../common/filters/http-exception.filter';
import { crearValidationPipe } from '../../common/pipes/validation.pipe';
import { EvidenciasService } from './evidencias.service';
import { ReporteService } from './reporte.service';
import { SeguimientosAdoptanteController } from './seguimientos-adoptante.controller';
import { SeguimientosService } from './seguimientos.service';

const SUCIO = { clave: 'privado/seguimientos/a.jpg', contrasena: 'h' };
// Lo que un descuido podría propagar: valoración interna de la fundación.
const INTERNO = {
  estadoBienestar: 'malo',
  observaciones: 'Se ve delgado',
  evidencias: [{ id: 30 }],
};
const LISTA = {
  id: 5,
  adopcionId: 9,
  tipo: 'reporte',
  fechaProgramada: '2026-12-15',
  fechaRealizada: null,
  estado: 'programado',
  vencido: false,
  tieneReporte: true,
  mascota: { id: 4, nombre: 'Luna' },
  fundacion: { nombre: 'Patitas', ...SUCIO },
  ...SUCIO,
  ...INTERNO,
};
const DETALLE = {
  ...LISTA,
  fechaEntrega: '2026-11-20',
  reporte: {
    comentarios: 'Bien',
    enviadoEn: new Date('2026-12-01T10:00:00Z'),
    fotos: [{ id: 21 }],
  },
};

describe('SeguimientosAdoptanteController (HTTP, servicios simulados)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const seguimientos = { listarMios: jest.fn(), obtenerMio: jest.fn() };
  const reportes = { enviar: jest.fn() };
  const evidencias = { leer: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [SeguimientosAdoptanteController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: SeguimientosService, useValue: seguimientos },
        { provide: ReporteService, useValue: reportes },
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
  beforeEach(() => jest.resetAllMocks());

  const http = (ruta: string, rol = 'adoptante') =>
    request(app.getHttpServer())
      .get(ruta)
      .set('Authorization', `Bearer ${jwt.sign({ sub: 21, rol })}`);

  it('exige rol adoptante en todas las rutas', async () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, SeguimientosAdoptanteController)).toEqual([
      'adoptante',
    ]);
    for (const ruta of [
      '/mis-seguimientos',
      '/mis-seguimientos/1',
      '/mis-seguimientos/1/evidencias/2',
    ]) {
      await request(app.getHttpServer()).get(ruta).expect(401);
      await http(ruta, 'fundacion').expect(403);
      await http(ruta, 'administrador').expect(403);
    }
    expect(seguimientos.listarMios).not.toHaveBeenCalled();
  });

  it('la lista usa el usuario del token y nunca expone la valoración de la fundación', async () => {
    seguimientos.listarMios.mockResolvedValue({ data: [LISTA], total: 1, page: 1, limit: 10 });
    const res = await http('/mis-seguimientos?estado=programado&adopcionId=9').expect(200);
    expect(seguimientos.listarMios.mock.calls[0][0]).toBe(21);
    expect(seguimientos.listarMios.mock.calls[0][1]).toEqual({
      estado: 'programado',
      tipo: undefined,
      adopcionId: 9,
    });
    expect(res.body.data[0].fundacion).toEqual({ nombre: 'Patitas' });
    expect(JSON.stringify(res.body)).not.toMatch(
      /malo|delgado|estadoBienestar|observaciones|evidencias|privado\/|clave|contrasena/,
    );
    await http('/mis-seguimientos?estado=x').expect(400);
    await http('/mis-seguimientos?limit=101').expect(400);
  });

  it('el detalle muestra solo el reporte propio con enlaces del adoptante', async () => {
    seguimientos.obtenerMio.mockResolvedValue(DETALLE);
    const res = await http('/mis-seguimientos/5').expect(200);
    expect(seguimientos.obtenerMio).toHaveBeenCalledWith(21, 5);
    expect(res.body.reporte.fotos).toEqual([
      { id: 21, url: '/api/mis-seguimientos/5/evidencias/21' },
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(
      /malo|delgado|estadoBienestar|observaciones|evidencias"|\/api\/fundacion|privado\/|clave/,
    );
  });

  it('uno ajeno es el mismo 404 que uno inexistente; sin perfil de adoptante, 403', async () => {
    seguimientos.obtenerMio.mockRejectedValueOnce(
      new NotFoundException('El seguimiento no existe'),
    );
    const res = await http('/mis-seguimientos/99').expect(404);
    expect(res.body.message).toBe('El seguimiento no existe');
    seguimientos.listarMios.mockRejectedValueOnce(
      new ForbiddenException('Esta acción es exclusiva de adoptantes'),
    );
    await http('/mis-seguimientos').expect(403);
    await http('/mis-seguimientos/0').expect(400);
  });

  describe('POST /seguimientos/:id/reporte', () => {
    const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const enviar = (rol = 'adoptante') =>
      request(app.getHttpServer())
        .post('/seguimientos/5/reporte')
        .set('Authorization', `Bearer ${jwt.sign({ sub: 21, rol })}`);

    it('exige rol adoptante y limita a 10 por minuto', async () => {
      await request(app.getHttpServer())
        .post('/seguimientos/5/reporte')
        .field('comentarios', 'x')
        .expect(401);
      await enviar('fundacion').field('comentarios', 'x').expect(403);
      await enviar('administrador').field('comentarios', 'x').expect(403);
      expect(
        Reflect.getMetadata(
          'THROTTLER:LIMITdefault',
          SeguimientosAdoptanteController.prototype.enviarReporte,
        ),
      ).toBe(10);
      expect(reportes.enviar).not.toHaveBeenCalled();
    });

    it('entrega usuario, id, comentarios recortados y los buffers de las fotos', async () => {
      reportes.enviar.mockResolvedValue(DETALLE);
      const res = await enviar()
        .field('comentarios', '  Come bien  ')
        .attach('fotos', JPG, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .attach('fotos', JPG, { filename: 'b.jpg', contentType: 'image/jpeg' })
        .expect(201);
      const [usuarioId, id, comentarios, fotos] = reportes.enviar.mock.calls[0] as [
        number,
        number,
        string,
        Buffer[],
      ];
      expect([usuarioId, id, comentarios]).toEqual([21, 5, 'Come bien']);
      expect(fotos).toHaveLength(2);
      expect(fotos[0].equals(JPG)).toBe(true);
      expect(JSON.stringify(res.body)).not.toMatch(/malo|delgado|estadoBienestar|privado\/|clave/);
    });

    it('acepta un reporte sin fotos', async () => {
      reportes.enviar.mockResolvedValue(DETALLE);
      await enviar().field('comentarios', 'Todo bien').expect(201);
      expect(reportes.enviar.mock.calls[0][3]).toEqual([]);
    });

    it('rechaza con 400 comentarios ausentes, vacíos o de más de 500 caracteres', async () => {
      await enviar().attach('fotos', JPG, 'a.jpg').expect(400);
      await enviar().field('comentarios', '   ').expect(400);
      const largo = await enviar().field('comentarios', 'a'.repeat(501)).expect(400);
      expect(JSON.stringify(largo.body)).toContain('500');
      expect(reportes.enviar).not.toHaveBeenCalled();
    });

    it('rechaza con 400 más de 5 fotos y con 413 una de más de 5 MB, en español', async () => {
      let r = enviar().field('comentarios', 'x');
      for (let i = 0; i < 6; i++) r = r.attach('fotos', JPG, `f${i}.jpg`);
      const demasiadas = await r.expect(400);
      expect(demasiadas.body.message).toContain('no pueden ser más de 5');
      const grande = await enviar()
        .field('comentarios', 'x')
        .attach('fotos', Buffer.alloc(5 * 1024 * 1024 + 1, 1), 'grande.jpg')
        .expect(413);
      expect(grande.body.message).toContain('5 MB');
      expect(reportes.enviar).not.toHaveBeenCalled();
    });

    it('propaga 404 y 409 del service', async () => {
      reportes.enviar.mockRejectedValueOnce(new NotFoundException('El seguimiento no existe'));
      await enviar().field('comentarios', 'x').expect(404);
      reportes.enviar.mockRejectedValueOnce(
        new ConflictException('Este seguimiento es una visita y no admite reporte'),
      );
      await enviar().field('comentarios', 'x').expect(409);
      await request(app.getHttpServer())
        .post('/seguimientos/0/reporte')
        .set('Authorization', `Bearer ${jwt.sign({ sub: 21, rol: 'adoptante' })}`)
        .field('comentarios', 'x')
        .expect(400);
    });
  });

  describe('descarga de fotos', () => {
    const RUTA = '/mis-seguimientos/5/evidencias/21';
    const get = (ruta = RUTA) =>
      request(app.getHttpServer())
        .get(ruta)
        .set('Authorization', `Bearer ${jwt.sign({ sub: 21, rol: 'adoptante' })}`);

    it('entrega el tipo real con cabeceras seguras y límite de 30 por minuto', async () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
      evidencias.leer.mockResolvedValue({
        buffer,
        tipo: 'image/jpeg',
        tamano: buffer.length,
        nombreArchivo: 'evidencia-seguimiento-5-21.jpg',
      });
      const res = await get().expect(200);
      expect(evidencias.leer).toHaveBeenCalledWith(5, 21, { tipo: 'adoptante', usuarioId: 21 });
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
          SeguimientosAdoptanteController.prototype.descargarFoto,
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
