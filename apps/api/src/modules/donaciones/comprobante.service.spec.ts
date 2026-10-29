import { NotFoundException } from '@nestjs/common';
import { ComprobanteService } from './comprobante.service';

describe('ComprobanteService', () => {
  const repo = { claveComprobanteDeFundacion: jest.fn() };
  const storage = { leer: jest.fn() };
  const service = new ComprobanteService(repo as never, storage as never);

  beforeEach(() => jest.resetAllMocks());

  it('busca la clave con la fundación dueña y construye el nombre con el tipo real', async () => {
    repo.claveComprobanteDeFundacion.mockResolvedValue('privado/donaciones/x.png');
    storage.leer.mockResolvedValue({
      buffer: Buffer.from('x'),
      tipo: 'application/pdf',
      tamano: 1,
    });
    const archivo = await service.leer(7, 3);
    expect(repo.claveComprobanteDeFundacion).toHaveBeenCalledWith(7, 3);
    expect(storage.leer).toHaveBeenCalledWith('privado/donaciones/x.png');
    expect(archivo.nombreArchivo).toBe('comprobante-donacion-7.pdf');
    expect(archivo).not.toHaveProperty('clave');
  });

  it('ajena, inexistente o sin comprobante: el mismo 404 y no lee el storage', async () => {
    repo.claveComprobanteDeFundacion.mockResolvedValue(null);
    await expect(service.leer(7, 3)).rejects.toThrow(
      new NotFoundException('La donación o su comprobante no existe'),
    );
    expect(storage.leer).not.toHaveBeenCalled();
  });
});
