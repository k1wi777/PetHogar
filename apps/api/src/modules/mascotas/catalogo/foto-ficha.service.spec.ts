import { Logger } from '@nestjs/common';
import { FotoFichaService } from './foto-ficha.service';

function crear() {
  const fotos = { listar: jest.fn() };
  const storage = { leer: jest.fn() };
  return { service: new FotoFichaService(fotos as never, storage as never), fotos, storage };
}

describe('FotoFichaService', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('lee la miniatura de la principal (la primera de la lista)', async () => {
    const { service, fotos, storage } = crear();
    fotos.listar.mockResolvedValue([
      { urlCatalogo: 'publico/mascotas/a-c.jpg', url: 'publico/mascotas/a.jpg' },
    ]);
    storage.leer.mockResolvedValue({ buffer: Buffer.from('x'), tipo: 'image/jpeg', tamano: 1 });
    await expect(service.leerPrincipal(5)).resolves.toEqual({
      buffer: Buffer.from('x'),
      tipo: 'image/jpeg',
    });
    expect(storage.leer).toHaveBeenCalledWith('publico/mascotas/a-c.jpg');
  });

  it('sin fotos, con clave de demo o con tipo no admitido devuelve null sin leer o sin romper', async () => {
    const { service, fotos, storage } = crear();
    fotos.listar.mockResolvedValueOnce([]);
    await expect(service.leerPrincipal(1)).resolves.toBeNull();
    fotos.listar.mockResolvedValueOnce([{ urlCatalogo: '/uploads/demo/a.jpg' }]);
    await expect(service.leerPrincipal(1)).resolves.toBeNull();
    expect(storage.leer).not.toHaveBeenCalled();
    fotos.listar.mockResolvedValueOnce([{ urlCatalogo: 'publico/mascotas/a.pdf' }]);
    storage.leer.mockResolvedValue({
      buffer: Buffer.from('x'),
      tipo: 'application/pdf',
      tamano: 1,
    });
    await expect(service.leerPrincipal(1)).resolves.toBeNull();
  });

  it('si el archivo falta o falla la lectura, devuelve null y lo registra', async () => {
    const { service, fotos, storage } = crear();
    fotos.listar.mockResolvedValue([{ urlCatalogo: 'publico/mascotas/a.jpg' }]);
    storage.leer.mockRejectedValue(new Error('no existe'));
    await expect(service.leerPrincipal(1)).resolves.toBeNull();
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });
});
