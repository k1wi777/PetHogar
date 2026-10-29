import { NotFoundException } from '@nestjs/common';
import { CatalogosService } from './catalogos.service';

describe('CatalogosService', () => {
  const repo = {
    listarEspecies: jest.fn(),
    existeEspecie: jest.fn(),
    listarRazas: jest.fn(),
    existeRaza: jest.fn(),
  };
  const service = new CatalogosService(repo as never);

  beforeEach(() => jest.resetAllMocks());

  it('lista las especies solo con id y nombre', async () => {
    repo.listarEspecies.mockResolvedValue([{ id: 1, nombre: 'gato', extra: 'x' }]);
    await expect(service.listarEspecies()).resolves.toEqual([{ id: 1, nombre: 'gato' }]);
  });

  it('lista las razas de una especie existente', async () => {
    repo.existeEspecie.mockResolvedValue(true);
    repo.listarRazas.mockResolvedValue([{ id: 5, especieId: 1, nombre: 'Angora' }]);
    await expect(service.listarRazas(1)).resolves.toEqual([{ id: 5, nombre: 'Angora' }]);
    expect(repo.listarRazas).toHaveBeenCalledWith(1);
  });

  it('responde 404 si la especie no existe', async () => {
    repo.existeEspecie.mockResolvedValue(false);
    await expect(service.listarRazas(99)).rejects.toThrow(NotFoundException);
    await expect(service.listarRazas(99)).rejects.toThrow('La especie no existe');
    expect(repo.listarRazas).not.toHaveBeenCalled();
  });

  it('existeRaza delega en el repository', async () => {
    repo.existeRaza.mockResolvedValue(true);
    await expect(service.existeRaza(3)).resolves.toBe(true);
  });
});
