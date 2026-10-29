import { NotFoundException } from '@nestjs/common';
import { FormularioService } from './formulario.service';

describe('FormularioService', () => {
  const repo = { claveFormularioDeFundacion: jest.fn(), claveFormularioDeAdoptante: jest.fn() };
  const usuarios = { adoptantePorUsuarioId: jest.fn() };
  const storage = { leer: jest.fn() };
  const service = new FormularioService(repo as never, usuarios as never, storage as never);
  const CLAVE = 'privado/solicitudes/aaa.bin';

  beforeEach(() => {
    jest.resetAllMocks();
    storage.leer.mockResolvedValue({
      buffer: Buffer.from('%PDF'),
      tipo: 'application/pdf',
      tamano: 4,
    });
  });

  it('la fundación dueña lo lee con la extensión del tipo real, no de la clave', async () => {
    repo.claveFormularioDeFundacion.mockResolvedValue(CLAVE);
    const r = await service.leer(11, { tipo: 'fundacion', fundacionId: 3 });
    expect(repo.claveFormularioDeFundacion).toHaveBeenCalledWith(11, 3);
    expect(storage.leer).toHaveBeenCalledWith(CLAVE);
    expect(r.nombreArchivo).toBe('formulario-solicitud-11.pdf');
    expect(JSON.stringify(r)).not.toContain(CLAVE);
  });

  it('el adoptante autor lo lee con el filtro por su adoptante', async () => {
    usuarios.adoptantePorUsuarioId.mockResolvedValue({ id: 4 });
    repo.claveFormularioDeAdoptante.mockResolvedValue(CLAVE);
    await service.leer(11, { tipo: 'adoptante', usuarioId: 9 });
    expect(repo.claveFormularioDeAdoptante).toHaveBeenCalledWith(11, 4);
  });

  it('ajena o inexistente: 404 sin leer del almacenamiento', async () => {
    repo.claveFormularioDeFundacion.mockResolvedValue(null);
    await expect(service.leer(11, { tipo: 'fundacion', fundacionId: 3 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    repo.claveFormularioDeAdoptante.mockResolvedValue(null);
    usuarios.adoptantePorUsuarioId.mockResolvedValue({ id: 4 });
    await expect(service.leer(11, { tipo: 'adoptante', usuarioId: 9 })).rejects.toThrow(
      'La solicitud no existe',
    );
    expect(storage.leer).not.toHaveBeenCalled();
  });

  it('un usuario que no es adoptante recibe 404', async () => {
    usuarios.adoptantePorUsuarioId.mockResolvedValue(null);
    await expect(service.leer(11, { tipo: 'adoptante', usuarioId: 9 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.claveFormularioDeAdoptante).not.toHaveBeenCalled();
  });
});
