import { NotFoundException } from '@nestjs/common';
import { EvidenciasService } from './evidencias.service';

describe('EvidenciasService.leer', () => {
  const repo = { claveDeFoto: jest.fn() };
  const usuarios = { adoptantePorUsuarioId: jest.fn() };
  const storage = {
    leer: jest.fn(),
    guardar: jest.fn(),
    eliminar: jest.fn(),
    urlPublica: jest.fn(),
  };
  const service = new EvidenciasService(repo as never, usuarios as never, storage as never);
  const CLAVE = 'privado/seguimientos/aaa.jpg';

  beforeEach(() => {
    jest.resetAllMocks();
    usuarios.adoptantePorUsuarioId.mockResolvedValue({ id: 8 });
    repo.claveDeFoto.mockResolvedValue(CLAVE);
    storage.leer.mockResolvedValue({ buffer: Buffer.from([1, 2]), tipo: 'image/png', tamano: 2 });
  });

  it('la fundación busca con su id de fundación y recibe el tipo real con nombre propio', async () => {
    const archivo = await service.leer(5, 21, { tipo: 'fundacion', fundacionId: 3 });
    expect(repo.claveDeFoto).toHaveBeenCalledWith(5, 21, { tipo: 'fundacion', fundacionId: 3 });
    expect(storage.leer).toHaveBeenCalledWith(CLAVE);
    expect(archivo.nombreArchivo).toBe('evidencia-seguimiento-5-21.png');
    expect(archivo.tipo).toBe('image/png');
    expect(JSON.stringify({ ...archivo, buffer: undefined })).not.toContain('privado/');
  });

  it('el adoptante busca con su id de adoptante (no el de usuario)', async () => {
    await service.leer(5, 21, { tipo: 'adoptante', usuarioId: 99 });
    expect(usuarios.adoptantePorUsuarioId).toHaveBeenCalledWith(99);
    expect(repo.claveDeFoto).toHaveBeenCalledWith(5, 21, { tipo: 'adoptante', adoptanteId: 8 });
  });

  it('una foto ajena o inexistente es 404 y no toca el disco', async () => {
    repo.claveDeFoto.mockResolvedValue(null);
    await expect(service.leer(5, 21, { tipo: 'fundacion', fundacionId: 3 })).rejects.toThrow(
      new NotFoundException('La foto no existe'),
    );
    await expect(service.leer(5, 21, { tipo: 'adoptante', usuarioId: 99 })).rejects.toThrow(
      NotFoundException,
    );
    expect(storage.leer).not.toHaveBeenCalled();
  });

  it('un usuario sin perfil de adoptante recibe 404 sin consultar fotos', async () => {
    usuarios.adoptantePorUsuarioId.mockResolvedValue(null);
    await expect(service.leer(5, 21, { tipo: 'adoptante', usuarioId: 99 })).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.claveDeFoto).not.toHaveBeenCalled();
  });

  it('si el archivo falta en disco, el error del storage se propaga (404)', async () => {
    storage.leer.mockRejectedValue(new NotFoundException('El documento no está disponible'));
    await expect(service.leer(5, 21, { tipo: 'fundacion', fundacionId: 3 })).rejects.toThrow(
      NotFoundException,
    );
  });
});
