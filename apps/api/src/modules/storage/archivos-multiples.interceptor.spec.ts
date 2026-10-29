import { Controller, INestApplication, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ArchivosMultiplesInterceptor } from './archivos-multiples.interceptor';
import { MAX_BYTES } from './storage.constants';

@Controller('prueba')
class ControladorPrueba {
  @Post()
  @UseInterceptors(ArchivosMultiplesInterceptor('fotos', 2))
  subir(@UploadedFiles() archivos?: Express.Multer.File[]): { n: number } {
    return { n: archivos?.length ?? 0 };
  }
}

describe('ArchivosMultiplesInterceptor', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ controllers: [ControladorPrueba] }).compile();
    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  const enviar = () => request(app.getHttpServer() as never).post('/prueba');

  it('acepta cero, uno o el máximo de archivos', async () => {
    expect((await enviar().field('x', '1').expect(201)).body).toEqual({ n: 0 });
    expect((await enviar().attach('fotos', Buffer.from('a'), 'a.jpg').expect(201)).body).toEqual({
      n: 1,
    });
    const dos = await enviar()
      .attach('fotos', Buffer.from('a'), 'a.jpg')
      .attach('fotos', Buffer.from('b'), 'b.jpg')
      .expect(201);
    expect(dos.body).toEqual({ n: 2 });
  });

  it('rechaza con 400 en español más archivos que el máximo', async () => {
    const res = await enviar()
      .attach('fotos', Buffer.from('a'), 'a.jpg')
      .attach('fotos', Buffer.from('b'), 'b.jpg')
      .attach('fotos', Buffer.from('c'), 'c.jpg')
      .expect(400);
    expect(res.body.message).toContain('no pueden ser más de 2');
  });

  it('rechaza con 400 un campo con otro nombre', async () => {
    const res = await enviar().attach('otro', Buffer.from('a'), 'a.jpg').expect(400);
    expect(res.body.message).toContain('campo "fotos"');
  });

  it('rechaza con 413 y mensaje en español un archivo de más de 5 MB', async () => {
    const res = await enviar()
      .attach('fotos', Buffer.alloc(MAX_BYTES + 1, 1), 'grande.jpg')
      .expect(413);
    expect(res.body.message).toContain('5 MB');
  });
});
