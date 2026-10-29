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
import { MascotasFundacionController } from './mascotas-fundacion.controller';
import { FotosMascotaService } from './fotos/fotos-mascota.service';
import { HistorialService } from './historial/historial.service';
import { MascotasService } from './mascotas.service';

describe('MascotasFundacionController (HTTP, servicios simulados)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const mascotas = {
    crear: jest.fn(),
    editar: jest.fn(),
    darDeBaja: jest.fn(),
    listarDeFundacion: jest.fn(),
    obtenerDetalleDeFundacion: jest.fn(),
  };
  const historial = { registrar: jest.fn() };
  const fotos = { subir: jest.fn(), marcarPrincipal: jest.fn(), eliminar: jest.fn() };
  const fundaciones = { estadoPorUsuarioId: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [MascotasFundacionController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        ApprovedFoundationGuard,
        { provide: FundacionesService, useValue: fundaciones },
        { provide: MascotasService, useValue: mascotas },
        { provide: FotosMascotaService, useValue: fotos },
        { provide: HistorialService, useValue: historial },
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

  const token = (rol = 'fundacion'): string => `Bearer ${jwt.sign({ sub: 9, rol })}`;
  const http = (metodo: 'get' | 'post' | 'patch' | 'delete', ruta: string, rol = 'fundacion') =>
    request(app.getHttpServer())[metodo](ruta).set('Authorization', token(rol));

  const VALIDA = {
    nombre: 'Luna',
    razaId: 2,
    sexo: 'hembra',
    edadMeses: 12,
    tamano: 'mediano',
    estadoSalud: 'Sana',
  };

  it('toda la clase exige rol fundación y todas las rutas son privadas', async () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, MascotasFundacionController)).toEqual([
      'fundacion',
    ]);
    const rutas: [string, string][] = [
      ['post', '/mascotas'],
      ['patch', '/mascotas/1'],
      ['patch', '/mascotas/1/baja'],
      ['get', '/fundacion/mascotas'],
      ['get', '/fundacion/mascotas/1'],
      ['post', '/mascotas/1/fotos'],
      ['post', '/mascotas/1/historial'],
      ['patch', '/mascotas/1/fotos/2/principal'],
      ['delete', '/mascotas/1/fotos/2'],
    ];
    for (const [metodo, ruta] of rutas) {
      await request(app.getHttpServer())[metodo as 'get'](ruta).expect(401);
      await http(metodo as 'get', ruta, 'adoptante').expect(403);
    }
    expect(fundaciones.estadoPorUsuarioId).not.toHaveBeenCalled();
  });

  it('una fundación pendiente recibe 403 en la gestión', async () => {
    fundaciones.estadoPorUsuarioId.mockResolvedValue({
      id: 3,
      estadoValidacion: EstadoValidacion.Pendiente,
    });
    await http('post', '/mascotas').send(VALIDA).expect(403);
    expect(mascotas.crear).not.toHaveBeenCalled();
  });

  it('POST /mascotas usa la fundación del guard y nunca la del cuerpo', async () => {
    mascotas.crear.mockResolvedValue({ id: 1 });
    await http('post', '/mascotas')
      .send({ ...VALIDA, fundacionId: 99, estado: 'adoptada' })
      .expect(201);
    const [fundacionId, dto] = mascotas.crear.mock.calls[0];
    expect(fundacionId).toBe(3);
    expect(dto).not.toHaveProperty('fundacionId');
    expect(dto).not.toHaveProperty('estado');
  });

  it('POST /mascotas con datos inválidos da 400 con mensajes por campo en español', async () => {
    const res = await http('post', '/mascotas').send({ nombre: '', edadMeses: -1 }).expect(400);
    expect(res.body.errores.map((e: { campo: string }) => e.campo)).toEqual(
      expect.arrayContaining(['nombre', 'edadMeses', 'razaId']),
    );
    expect(mascotas.crear).not.toHaveBeenCalled();
  });

  it('PATCH /mascotas/:id descarta estado y pasa fundación e id', async () => {
    mascotas.editar.mockResolvedValue({ id: 4 });
    await http('patch', '/mascotas/4').send({ nombre: 'Nuevo', estado: 'disponible' }).expect(200);
    const [id, fundacionId, dto] = mascotas.editar.mock.calls[0];
    expect([id, fundacionId]).toEqual([4, 3]);
    expect(dto).toEqual({ nombre: 'Nuevo' });
  });

  it('propaga 404 y 409 del servicio con su mensaje', async () => {
    mascotas.darDeBaja.mockRejectedValueOnce(new NotFoundException('La mascota no existe'));
    const nf = await http('patch', '/mascotas/4/baja').expect(404);
    expect(nf.body.message).toBe('La mascota no existe');
    mascotas.darDeBaja.mockRejectedValueOnce(new ConflictException('La mascota está adoptada'));
    await http('patch', '/mascotas/4/baja').expect(409);
  });

  it('rechaza ids no válidos con 400', async () => {
    await http('patch', '/mascotas/0/baja').expect(400);
    await http('get', '/fundacion/mascotas/99999999999').expect(400);
    await http('get', '/fundacion/mascotas/abc').expect(400);
  });

  describe('fotos', () => {
    const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);

    it('POST /mascotas/:id/fotos entrega el archivo y la fundación del guard', async () => {
      fotos.subir.mockResolvedValue({ id: 1, esPrincipal: true, urlCatalogo: 'c', url: 'g' });
      await http('post', '/mascotas/4/fotos')
        .attach('foto', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(201);
      const [id, fundacionId, buffer] = fotos.subir.mock.calls[0];
      expect([id, fundacionId]).toEqual([4, 3]);
      expect(Buffer.isBuffer(buffer) && buffer.equals(JPEG)).toBe(true);
    });

    it('sin archivo o con campo equivocado el servicio recibe undefined o 400 del interceptor', async () => {
      fotos.subir.mockResolvedValue({ id: 1 });
      await http('post', '/mascotas/4/fotos').expect(201);
      expect(fotos.subir.mock.calls[0][2]).toBeUndefined();
      await http('post', '/mascotas/4/fotos')
        .attach('otro', JPEG, { filename: 'a.jpg' })
        .expect(400);
    });

    it('rechaza con 413 un archivo de más de 5 MB', async () => {
      const res = await http('post', '/mascotas/4/fotos')
        .attach('foto', Buffer.alloc(5 * 1024 * 1024 + 1, 1), { filename: 'a.jpg' })
        .expect(413);
      expect(res.body.message).toContain('5 MB');
      expect(fotos.subir).not.toHaveBeenCalled();
    });

    it('PATCH principal y DELETE usan ids válidos y responden 200 y 204', async () => {
      fotos.marcarPrincipal.mockResolvedValue([]);
      await http('patch', '/mascotas/4/fotos/9/principal').expect(200);
      expect(fotos.marcarPrincipal).toHaveBeenCalledWith(4, 9, 3);
      fotos.eliminar.mockResolvedValue(undefined);
      await http('delete', '/mascotas/4/fotos/9').expect(204);
      expect(fotos.eliminar).toHaveBeenCalledWith(4, 9, 3);
      await http('delete', '/mascotas/4/fotos/0').expect(400);
    });

    it('la subida lleva un límite por IP más estricto que el global', () => {
      const claves = Reflect.getMetadataKeys(MascotasFundacionController.prototype.subirFoto);
      expect(claves.some((k) => String(k).includes('THROTTLER:LIMIT'))).toBe(true);
    });
  });

  it('POST /mascotas/:id/historial valida el cuerpo y entrega fundación e id', async () => {
    historial.registrar.mockResolvedValue({ id: 1 });
    await http('post', '/mascotas/4/historial')
      .send({ tipo: 'vacuna', fecha: '2026-02-01', descripcion: ' Rabia ', veterinario: '' })
      .expect(201);
    const [id, fundacionId, dto] = historial.registrar.mock.calls[0];
    expect([id, fundacionId]).toEqual([4, 3]);
    expect(dto).toMatchObject({ descripcion: 'Rabia', veterinario: null });

    const res = await http('post', '/mascotas/4/historial')
      .send({ tipo: 'otro', fecha: '2026-02-30', descripcion: '' })
      .expect(400);
    expect(res.body.errores.map((e: { campo: string }) => e.campo).sort()).toEqual([
      'descripcion',
      'fecha',
      'tipo',
    ]);
    expect(historial.registrar).toHaveBeenCalledTimes(1);
  });

  it('GET /fundacion/mascotas pasa el filtro de estado y valida su valor', async () => {
    mascotas.listarDeFundacion.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });
    await http('get', '/fundacion/mascotas?estado=inactiva&page=2').expect(200);
    const [fundacionId, filtro, paginacion] = mascotas.listarDeFundacion.mock.calls[0];
    expect(fundacionId).toBe(3);
    expect(filtro).toEqual({ estado: 'inactiva' });
    expect(paginacion).toMatchObject({ page: 2, limit: 10 });
    await http('get', '/fundacion/mascotas?estado=zzz').expect(400);
  });
});
