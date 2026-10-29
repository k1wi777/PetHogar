import 'reflect-metadata';
import { ConflictException, INestApplication, Logger, NotFoundException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { FoundationValidated } from '../../common/events';
import { AllExceptionsFilter } from '../../common/filters/http-exception.filter';
import { crearValidationPipe } from '../../common/pipes/validation.pipe';
import { EstadoValidacion } from '../fundaciones/entities/fundacion.enum';
import { FundacionesService } from '../fundaciones/fundaciones.service';
import type { FundacionAdminDetalle } from '../fundaciones/fundaciones.types';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AdminFundacionesController } from './admin-fundaciones.controller';
import { AdminFundacionesService } from './admin-fundaciones.service';

const CLAVE = 'privado/fundaciones/11111111-1111-1111-1111-111111111111.pdf';
const PDF = Buffer.from('%PDF-1.7\ncontenido\n%%EOF');

const DETALLE: FundacionAdminDetalle = {
  id: 3,
  usuarioId: 9,
  nombre: 'Huellas',
  nit: '900123456-7',
  ciudad: 'Montería',
  direccion: 'Calle 1',
  descripcion: null,
  estadoValidacion: EstadoValidacion.Pendiente,
  observacionValidacion: null,
  fechaValidacion: null,
};

describe('AdminFundacionesController (HTTP, dependencias simuladas)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let eventos: EventEmitter2;
  const fundaciones = {
    listarPorEstado: jest.fn(),
    obtenerDetalle: jest.fn(),
    obtenerClaveDocumento: jest.fn(),
    decidirValidacion: jest.fn(),
  };
  const usuarios = { obtenerPerfil: jest.fn() };
  const storage = { leer: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [AdminFundacionesController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        AdminFundacionesService,
        EventEmitter2,
        { provide: FundacionesService, useValue: fundaciones },
        { provide: UsuariosService, useValue: usuarios },
        { provide: STORAGE_SERVICE, useValue: storage },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(crearValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    jwt = modulo.get(JwtService);
    eventos = modulo.get(EventEmitter2);
  });

  afterAll(() => app.close());
  beforeEach(() => {
    jest.resetAllMocks();
    eventos.removeAllListeners();
    usuarios.obtenerPerfil.mockResolvedValue({
      email: 'huellas@example.com',
      telefono: '3109876543',
    });
  });

  const admin = (): string => `Bearer ${jwt.sign({ sub: 1, rol: 'administrador' })}`;
  const http = (metodo: 'get' | 'patch', ruta: string, auth: string | null = admin()) => {
    const r = request(app.getHttpServer())[metodo](ruta);
    return auth ? r.set('Authorization', auth) : r;
  };

  describe('control de acceso', () => {
    it.each([
      ['get', '/admin/fundaciones'],
      ['get', '/admin/fundaciones/3'],
      ['get', '/admin/fundaciones/3/documento'],
      ['patch', '/admin/fundaciones/3/validacion'],
    ] as const)('%s %s: 401 sin token y 403 para fundación y adoptante', async (metodo, ruta) => {
      await http(metodo, ruta, null).expect(401);
      for (const rol of ['fundacion', 'adoptante']) {
        await http(metodo, ruta, `Bearer ${jwt.sign({ sub: 5, rol })}`).expect(403);
      }
      expect(fundaciones.obtenerDetalle).not.toHaveBeenCalled();
      expect(storage.leer).not.toHaveBeenCalled();
    });
  });

  describe('GET /admin/fundaciones', () => {
    it('lista las pendientes por defecto, paginadas, sin clave de documento', async () => {
      fundaciones.listarPorEstado.mockResolvedValue({
        data: [DETALLE],
        total: 1,
        page: 1,
        limit: 10,
      });
      const res = await http('get', '/admin/fundaciones').expect(200);
      expect(fundaciones.listarPorEstado).toHaveBeenCalledWith('pendiente', {
        page: 1,
        limit: 10,
        estado: 'pendiente',
      });
      expect(res.body).toMatchObject({ total: 1, page: 1, limit: 10 });
      expect(res.body.data[0]).toEqual({
        id: 3,
        nombre: 'Huellas',
        nit: '900123456-7',
        ciudad: 'Montería',
        estadoValidacion: 'pendiente',
        fechaValidacion: null,
      });
    });

    it('acepta el estado indicado y la paginación', async () => {
      fundaciones.listarPorEstado.mockResolvedValue({ data: [], total: 0, page: 2, limit: 5 });
      await http('get', '/admin/fundaciones?estado=rechazada&page=2&limit=5').expect(200);
      expect(fundaciones.listarPorEstado.mock.calls[0][0]).toBe('rechazada');
    });

    it('un estado inválido es 400', async () => {
      const res = await http('get', '/admin/fundaciones?estado=otro').expect(400);
      expect(JSON.stringify(res.body)).toContain('El estado debe ser');
      expect(fundaciones.listarPorEstado).not.toHaveBeenCalled();
    });
  });

  describe('GET /admin/fundaciones/:id', () => {
    it('devuelve datos, NIT, contacto y la ruta del documento; nunca la clave ni usuarioId', async () => {
      fundaciones.obtenerDetalle.mockResolvedValue(DETALLE);
      const res = await http('get', '/admin/fundaciones/3').expect(200);
      expect(res.body).toMatchObject({
        id: 3,
        nit: '900123456-7',
        direccion: 'Calle 1',
        contacto: { email: 'huellas@example.com', telefono: '3109876543' },
        documento: { url: '/api/admin/fundaciones/3/documento' },
      });
      const texto = JSON.stringify(res.body);
      expect(texto).not.toContain('privado');
      expect(res.body).not.toHaveProperty('usuarioId');
      expect(res.body).not.toHaveProperty('documentoUrl');
    });

    it('inexistente: 404; id no numérico: 400', async () => {
      fundaciones.obtenerDetalle.mockRejectedValue(new NotFoundException('La fundación no existe'));
      await http('get', '/admin/fundaciones/99').expect(404);
      await http('get', '/admin/fundaciones/abc').expect(400);
    });
  });

  describe('GET /admin/fundaciones/:id/documento', () => {
    it('entrega el archivo con el tipo real y las cabeceras que impiden ejecutarlo o cachearlo', async () => {
      fundaciones.obtenerClaveDocumento.mockResolvedValue(CLAVE);
      storage.leer.mockResolvedValue({ buffer: PDF, tipo: 'application/pdf', tamano: PDF.length });
      const res = await http('get', '/admin/fundaciones/3/documento').expect(200);
      expect(storage.leer).toHaveBeenCalledWith(CLAVE);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toBe(
        'inline; filename="documento-fundacion-3.pdf"',
      );
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
      expect(res.headers['content-length']).toBe(String(PDF.length));
      expect(Buffer.from(res.body as Buffer).equals(PDF)).toBe(true);
      expect(JSON.stringify(res.headers)).not.toContain(CLAVE);
    });

    it('el tipo detectado manda sobre la extensión de la clave', async () => {
      fundaciones.obtenerClaveDocumento.mockResolvedValue(CLAVE);
      storage.leer.mockResolvedValue({ buffer: Buffer.from('x'), tipo: 'image/png', tamano: 1 });
      const res = await http('get', '/admin/fundaciones/3/documento').expect(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['content-disposition']).toContain('documento-fundacion-3.png');
    });

    it('archivo no disponible o fundación inexistente: 404 sin ruta ni clave', async () => {
      fundaciones.obtenerClaveDocumento.mockResolvedValue(CLAVE);
      storage.leer.mockRejectedValue(new NotFoundException('El documento no está disponible'));
      const res = await http('get', '/admin/fundaciones/3/documento').expect(404);
      expect(JSON.stringify(res.body)).not.toContain('privado');
      fundaciones.obtenerClaveDocumento.mockRejectedValue(
        new NotFoundException('La fundación no existe'),
      );
      await http('get', '/admin/fundaciones/99/documento').expect(404);
    });
  });

  describe('PATCH /admin/fundaciones/:id/validacion', () => {
    const aprobada = { ...DETALLE, estadoValidacion: EstadoValidacion.Aprobada };

    it('aprueba sin observación: la guarda como null, devuelve el detalle y emite el evento', async () => {
      fundaciones.decidirValidacion.mockResolvedValue(aprobada);
      const recibido = jest.fn();
      eventos.on(FoundationValidated.eventName, recibido);
      const res = await http('patch', '/admin/fundaciones/3/validacion')
        .send({ decision: 'aprobada' })
        .expect(200);
      expect(fundaciones.decidirValidacion).toHaveBeenCalledWith(3, 'aprobada', null);
      expect(res.body.estadoValidacion).toBe('aprobada');
      expect(recibido).toHaveBeenCalledTimes(1);
      expect(recibido).toHaveBeenCalledWith(new FoundationValidated(3, 'aprobada', null));
    });

    it('aprobar con observación en blanco la trata como ausente', async () => {
      fundaciones.decidirValidacion.mockResolvedValue(aprobada);
      await http('patch', '/admin/fundaciones/3/validacion')
        .send({ decision: 'aprobada', observacion: '   ' })
        .expect(200);
      expect(fundaciones.decidirValidacion).toHaveBeenCalledWith(3, 'aprobada', null);
    });

    it('rechaza con el motivo recortado', async () => {
      fundaciones.decidirValidacion.mockResolvedValue({
        ...DETALLE,
        estadoValidacion: EstadoValidacion.Rechazada,
        observacionValidacion: 'Documento ilegible',
      });
      await http('patch', '/admin/fundaciones/3/validacion')
        .send({ decision: 'rechazada', observacion: '  Documento ilegible  ' })
        .expect(200);
      expect(fundaciones.decidirValidacion).toHaveBeenCalledWith(
        3,
        'rechazada',
        'Documento ilegible',
      );
    });

    it.each([
      ['sin observación', { decision: 'rechazada' }],
      ['observación vacía', { decision: 'rechazada', observacion: '' }],
      ['observación solo espacios', { decision: 'rechazada', observacion: '    ' }],
      ['observación de 301 caracteres', { decision: 'rechazada', observacion: 'a'.repeat(301) }],
      [
        'aprobar con observación de 301 caracteres',
        { decision: 'aprobada', observacion: 'a'.repeat(301) },
      ],
      ['decisión inválida', { decision: 'pendiente' }],
      ['sin decisión', {}],
    ])('%s: 400 sin modificar ni emitir', async (_n, cuerpo) => {
      const recibido = jest.fn();
      eventos.on(FoundationValidated.eventName, recibido);
      await http('patch', '/admin/fundaciones/3/validacion').send(cuerpo).expect(400);
      expect(fundaciones.decidirValidacion).not.toHaveBeenCalled();
      expect(recibido).not.toHaveBeenCalled();
    });

    it('acepta exactamente 300 caracteres de observación', async () => {
      fundaciones.decidirValidacion.mockResolvedValue(aprobada);
      await http('patch', '/admin/fundaciones/3/validacion')
        .send({ decision: 'rechazada', observacion: 'a'.repeat(300) })
        .expect(200);
    });

    it('transición inválida: 409 y no se emite evento', async () => {
      fundaciones.decidirValidacion.mockRejectedValue(new ConflictException('ya está'));
      const recibido = jest.fn();
      eventos.on(FoundationValidated.eventName, recibido);
      await http('patch', '/admin/fundaciones/3/validacion')
        .send({ decision: 'aprobada' })
        .expect(409);
      expect(recibido).not.toHaveBeenCalled();
    });

    it('fundación inexistente: 404', async () => {
      fundaciones.decidirValidacion.mockRejectedValue(new NotFoundException('no existe'));
      await http('patch', '/admin/fundaciones/99/validacion')
        .send({ decision: 'aprobada' })
        .expect(404);
    });

    it('un listener que lanza no deshace ni rompe la operación (queda en el log)', async () => {
      fundaciones.decidirValidacion.mockResolvedValue(aprobada);
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      eventos.on(FoundationValidated.eventName, () => {
        throw new Error('el correo falló');
      });
      await http('patch', '/admin/fundaciones/3/validacion')
        .send({ decision: 'aprobada' })
        .expect(200);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('el correo falló'));
      error.mockRestore();
    });
  });
});
