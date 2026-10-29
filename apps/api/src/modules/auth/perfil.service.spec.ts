import { UnauthorizedException } from '@nestjs/common';
import type { FundacionesService } from '../fundaciones/fundaciones.service';
import type { UsuariosService } from '../usuarios/usuarios.service';
import { PerfilService } from './perfil.service';

function crear() {
  const usuarios = { obtenerPerfil: jest.fn() };
  const fundaciones = { obtenerPorUsuarioId: jest.fn() };
  const service = new PerfilService(
    usuarios as unknown as UsuariosService,
    fundaciones as unknown as FundacionesService,
  );
  return { service, usuarios, fundaciones };
}

describe('PerfilService', () => {
  it('incluye el estado de validación y la observación de una fundación rechazada', async () => {
    const { service, usuarios, fundaciones } = crear();
    usuarios.obtenerPerfil.mockResolvedValue({
      id: 9,
      email: 'f@example.com',
      telefono: '3000000000',
      rol: 'fundacion',
      adoptante: null,
    });
    fundaciones.obtenerPorUsuarioId.mockResolvedValue({
      id: 2,
      nombre: 'Huellas',
      estadoValidacion: 'rechazada',
      observacionValidacion: 'Documento ilegible',
      documentoUrl: 'privado/fundaciones/x.pdf',
    });
    const perfil = await service.obtener(9);
    expect(perfil.fundacion).toEqual({
      id: 2,
      nombre: 'Huellas',
      estadoValidacion: 'rechazada',
      observacionValidacion: 'Documento ilegible',
    });
  });

  it('no consulta fundaciones para otros roles y no filtra campos extra', async () => {
    const { service, usuarios, fundaciones } = crear();
    usuarios.obtenerPerfil.mockResolvedValue({
      id: 1,
      email: 'a@example.com',
      telefono: '3',
      rol: 'adoptante',
      adoptante: {
        primerNombre: 'Ana',
        segundoNombre: null,
        primerApellido: 'P',
        segundoApellido: null,
      },
      contrasena: 'no-debe-salir',
    });
    const perfil = await service.obtener(1);
    expect(fundaciones.obtenerPorUsuarioId).not.toHaveBeenCalled();
    expect(perfil.fundacion).toBeNull();
    expect(Object.keys(perfil).sort()).toEqual([
      'adoptante',
      'email',
      'fundacion',
      'id',
      'rol',
      'telefono',
    ]);
  });

  it('responde 401 si el usuario ya no existe', async () => {
    const { service, usuarios } = crear();
    usuarios.obtenerPerfil.mockResolvedValue(null);
    await expect(service.obtener(1)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
