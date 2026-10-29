import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
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
import { ReportesPdfController } from './reportes-pdf.controller';
import { ReportesPdfService } from './reportes-pdf.service';

const RUTAS = [
  ['solicitudes', 'reporte-solicitudes.pdf'],
  ['seguimientos', 'reporte-seguimientos.pdf'],
  ['donaciones', 'reporte-donaciones.pdf'],
] as const;

describe('ReportesPdfController (HTTP, servicio simulado)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const reportes = { solicitudes: jest.fn(), seguimientos: jest.fn(), donaciones: jest.fn() };
  const fundaciones = { estadoPorUsuarioId: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [ReportesPdfController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        ApprovedFoundationGuard,
        { provide: FundacionesService, useValue: fundaciones },
        { provide: ReportesPdfService, useValue: reportes },
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
    for (const f of Object.values(reportes)) f.mockResolvedValue(Buffer.from('%PDF-1.7\nfin'));
    fundaciones.estadoPorUsuarioId.mockResolvedValue({
      id: 3,
      estadoValidacion: EstadoValidacion.Aprobada,
    });
  });

  const get = (ruta: string, rol?: string) => {
    const r = request(app.getHttpServer()).get(ruta);
    return rol ? r.set('Authorization', `Bearer ${jwt.sign({ sub: 9, rol })}`) : r;
  };

  it('exige rol fundación y fundación aprobada', async () => {
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, ReportesPdfController)).toEqual(['fundacion']);
    expect(Reflect.getMetadata('__guards__', ReportesPdfController)).toContain(
      ApprovedFoundationGuard,
    );
    for (const [ruta] of RUTAS) {
      const url = `/fundacion/reportes/${ruta}.pdf`;
      await get(url).expect(401);
      await get(url, 'adoptante').expect(403);
      await get(url, 'administrador').expect(403);
    }
    fundaciones.estadoPorUsuarioId.mockResolvedValue({
      id: 3,
      estadoValidacion: EstadoValidacion.Pendiente,
    });
    await get('/fundacion/reportes/solicitudes.pdf', 'fundacion').expect(403);
    expect(reportes.solicitudes).not.toHaveBeenCalled();
  });

  it.each(RUTAS)(
    '%s.pdf responde application/pdf como adjunto, sin caché y con la fundación del token',
    async (ruta, nombre) => {
      const res = await get(
        `/fundacion/reportes/${ruta}.pdf?desde=2026-10-01&fundacionId=99`,
        'fundacion',
      ).expect(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toBe(`attachment; filename="${nombre}"`);
      expect(res.headers['cache-control']).toBe('private, no-store');
      const [fundacionId, consulta] = reportes[ruta].mock.calls[0];
      expect(fundacionId).toBe(3);
      expect(consulta.desde).toBe('2026-10-01');
      expect(consulta.fundacionId).toBeUndefined();
    },
  );

  it('valida estado, tipo y fechas con 400', async () => {
    await get('/fundacion/reportes/solicitudes.pdf?estado=otro', 'fundacion').expect(400);
    await get('/fundacion/reportes/seguimientos.pdf?estado=otro', 'fundacion').expect(400);
    await get('/fundacion/reportes/donaciones.pdf?tipo=otro', 'fundacion').expect(400);
    await get('/fundacion/reportes/donaciones.pdf?hasta=2026-02-30', 'fundacion').expect(400);
    expect(reportes.solicitudes).not.toHaveBeenCalled();
    expect(reportes.seguimientos).not.toHaveBeenCalled();
    expect(reportes.donaciones).not.toHaveBeenCalled();
  });
});
