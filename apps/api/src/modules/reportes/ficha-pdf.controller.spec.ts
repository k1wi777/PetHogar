import 'reflect-metadata';
import { INestApplication, NotFoundException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AllExceptionsFilter } from '../../common/filters/http-exception.filter';
import { FichaPdfController } from './ficha-pdf.controller';
import { ReportesPdfService } from './reportes-pdf.service';

describe('FichaPdfController (HTTP, servicio simulado)', () => {
  let app: INestApplication;
  const reportes = { fichaMascota: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secreto-de-prueba-con-mas-de-32-caracteres' })],
      controllers: [FichaPdfController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: ReportesPdfService, useValue: reportes },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  it('es pública y responde un PDF como descarga', async () => {
    reportes.fichaMascota.mockResolvedValue(Buffer.from('%PDF-1.7\nfin'));
    const res = await request(app.getHttpServer()).get('/mascotas/7/ficha.pdf').expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="ficha-mascota-7.pdf"');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(reportes.fichaMascota).toHaveBeenCalledWith(7);
  });

  it('una mascota no visible es 404 en español y un id inválido 400', async () => {
    reportes.fichaMascota.mockRejectedValue(new NotFoundException('La mascota no existe'));
    const res = await request(app.getHttpServer()).get('/mascotas/8/ficha.pdf').expect(404);
    expect(JSON.stringify(res.body)).toContain('La mascota no existe');
    await request(app.getHttpServer()).get('/mascotas/abc/ficha.pdf').expect(400);
  });
});
