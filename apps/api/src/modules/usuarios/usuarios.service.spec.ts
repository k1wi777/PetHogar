import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsuariosRepository } from './usuarios.repository';
import { UsuariosService } from './usuarios.service';
import type { DatosNuevoAdoptante } from './usuarios.types';
import type { Usuario } from './entities/usuario.entity';

const FILA = {
  id: 7,
  email: 'ana@example.com',
  contrasena: '$2b$10$hash',
  telefono: '3001234567',
  activo: true,
  emailVerificado: true,
  intentosFallidos: 2,
  bloqueadoHasta: null,
  tokenVerificacionExpira: null,
  rol: { id: 3, nombre: 'adoptante' },
} as unknown as Usuario;

function crear(): { service: UsuariosService; repo: jest.Mocked<UsuariosRepository> } {
  const repo = {
    buscarPorEmail: jest.fn(),
    buscarPorId: jest.fn(),
    buscarAdoptantePorUsuarioId: jest.fn(),
    crearAdoptante: jest.fn(),
    crearUsuarioFundacion: jest.fn(),
    existeEmail: jest.fn(),
    estaActiva: jest.fn(),
    listarParaAdmin: jest.fn(),
    obtenerParaAdmin: jest.fn(),
    actualizarActivo: jest.fn(),
    bloquearAdministradores: jest.fn(),
    contarAdministradoresActivosExcepto: jest.fn(),
    existeDocumento: jest.fn(),
    registrarIntentoFallido: jest.fn(),
    reiniciarIntentos: jest.fn(),
    guardarTokenVerificacion: jest.fn(),
    consumirTokenVerificacion: jest.fn(),
    guardarCodigoRecuperacion: jest.fn(),
    reclamarIntentoCodigo: jest.fn(),
    restablecerContrasena: jest.fn(),
  } as unknown as jest.Mocked<UsuariosRepository>;
  return { service: new UsuariosService(repo), repo };
}

describe('UsuariosService', () => {
  it('devuelve credenciales de dominio con el nombre del rol, no la entidad', async () => {
    const { service, repo } = crear();
    repo.buscarPorEmail.mockResolvedValue(FILA);
    const r = await service.buscarPorEmail('ana@example.com');
    expect(r).toEqual({
      id: 7,
      email: 'ana@example.com',
      contrasenaHash: '$2b$10$hash',
      rol: 'adoptante',
      activo: true,
      emailVerificado: true,
      intentosFallidos: 2,
      bloqueadoHasta: null,
      tokenVerificacionExpira: null,
    });
    expect(r).not.toHaveProperty('contrasena');
  });

  it('devuelve null si el usuario no existe', async () => {
    const { service, repo } = crear();
    repo.buscarPorEmail.mockResolvedValue(null);
    repo.buscarPorId.mockResolvedValue(null);
    expect(await service.buscarPorEmail('x@example.com')).toBeNull();
    expect(await service.buscarPorId(1)).toBeNull();
    expect(await service.obtenerPerfil(1)).toBeNull();
  });

  it('el perfil no incluye contraseña ni datos de seguridad', async () => {
    const { service, repo } = crear();
    repo.buscarPorId.mockResolvedValue(FILA);
    repo.buscarAdoptantePorUsuarioId.mockResolvedValue({
      primerNombre: 'Ana',
      segundoNombre: null,
      primerApellido: 'Pérez',
      segundoApellido: null,
      numeroDocumento: '123',
    } as never);
    const perfil = await service.obtenerPerfil(7);
    expect(perfil).toEqual({
      id: 7,
      email: 'ana@example.com',
      telefono: '3001234567',
      rol: 'adoptante',
      adoptante: {
        primerNombre: 'Ana',
        segundoNombre: null,
        primerApellido: 'Pérez',
        segundoApellido: null,
      },
    });
  });

  it('crea un adoptante pasando el EntityManager de la transacción y devuelve solo id y correo', async () => {
    const { service, repo } = crear();
    repo.crearAdoptante.mockResolvedValue(FILA);
    const manager = {} as never;
    const datos = { email: 'ana@example.com' } as DatosNuevoAdoptante;
    expect(await service.crearAdoptante(datos, manager)).toEqual({
      id: 7,
      email: 'ana@example.com',
    });
    expect(repo.crearAdoptante).toHaveBeenCalledWith(datos, manager);
  });

  it('delega los contadores y tokens atómicos en el repository', async () => {
    const { service, repo } = crear();
    const ahora = new Date();
    repo.registrarIntentoFallido.mockResolvedValue(undefined);
    repo.consumirTokenVerificacion.mockResolvedValue(true);
    await service.registrarIntentoFallido(7, 5, 900_000, ahora);
    expect(repo.registrarIntentoFallido).toHaveBeenCalledWith(7, 5, 900_000, ahora);
    expect(await service.consumirTokenVerificacion('h', ahora)).toBe(true);
    await service.reiniciarIntentos(7);
    expect(repo.reiniciarIntentos).toHaveBeenCalledWith(7);
  });

  it('delega la recuperación de contraseña, pasando el manager de la transacción', async () => {
    const { service, repo } = crear();
    const hasta = new Date();
    const manager = {} as never;
    repo.guardarCodigoRecuperacion.mockResolvedValue(true);
    repo.reclamarIntentoCodigo.mockResolvedValue('hash-vigente');
    repo.restablecerContrasena.mockResolvedValue(true);

    expect(await service.guardarCodigoRecuperacion(7, 'h', hasta, hasta)).toBe(true);
    expect(repo.guardarCodigoRecuperacion).toHaveBeenCalledWith(7, 'h', hasta, hasta);
    expect(await service.reclamarIntentoCodigo(7, 5, hasta)).toBe('hash-vigente');
    expect(await service.restablecerContrasena(7, 'h', 'nuevo', manager)).toBe(true);
    expect(repo.restablecerContrasena).toHaveBeenCalledWith(7, 'h', 'nuevo', manager);
  });

  it('estaActiva delega en la consulta por clave primaria', async () => {
    const { service, repo } = crear();
    repo.estaActiva.mockResolvedValue(false);
    expect(await service.estaActiva(7)).toBe(false);
    expect(repo.estaActiva).toHaveBeenCalledWith(7);
  });

  it('listar convierte la paginación en skip/take y devuelve el formato estándar', async () => {
    const { service, repo } = crear();
    repo.listarParaAdmin.mockResolvedValue([[], 42]);
    const r = await service.listar({ nombre: 'a' }, { page: 3, limit: 10 });
    expect(repo.listarParaAdmin).toHaveBeenCalledWith({ nombre: 'a' }, 20, 10);
    expect(r).toEqual({ data: [], total: 42, page: 3, limit: 10 });
  });

  describe('cambiarEstado', () => {
    const MANAGER = {} as never;
    const admin = { id: 1, rol: 'administrador', activo: true };
    const adoptante = { id: 7, rol: 'adoptante', activo: true };

    it('usuario inexistente: 404 y no escribe', async () => {
      const { service, repo } = crear();
      repo.obtenerParaAdmin.mockResolvedValue(null);
      await expect(service.cambiarEstado(9, false, MANAGER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.actualizarActivo).not.toHaveBeenCalled();
    });

    it('desactivar a un no administrador no toma el bloqueo ni cuenta administradores', async () => {
      const { service, repo } = crear();
      repo.obtenerParaAdmin.mockResolvedValue(adoptante as never);
      const r = await service.cambiarEstado(7, false, MANAGER);
      expect(r).toMatchObject({ id: 7, activo: false });
      expect(repo.actualizarActivo).toHaveBeenCalledWith(7, false, MANAGER);
      expect(repo.bloquearAdministradores).not.toHaveBeenCalled();
    });

    it('desactivar a un administrador toma el bloqueo ANTES de contar a los demás', async () => {
      const { service, repo } = crear();
      repo.obtenerParaAdmin.mockResolvedValue(admin as never);
      repo.contarAdministradoresActivosExcepto.mockResolvedValue(1);
      await service.cambiarEstado(1, false, MANAGER);
      expect(repo.bloquearAdministradores).toHaveBeenCalledWith(MANAGER);
      expect(repo.bloquearAdministradores.mock.invocationCallOrder[0]).toBeLessThan(
        repo.contarAdministradoresActivosExcepto.mock.invocationCallOrder[0],
      );
      expect(repo.contarAdministradoresActivosExcepto).toHaveBeenCalledWith(1, MANAGER);
      expect(repo.actualizarActivo).toHaveBeenCalledWith(1, false, MANAGER);
    });

    it('el último administrador activo no se puede desactivar (409, sin escribir)', async () => {
      const { service, repo } = crear();
      repo.obtenerParaAdmin.mockResolvedValue(admin as never);
      repo.contarAdministradoresActivosExcepto.mockResolvedValue(0);
      await expect(service.cambiarEstado(1, false, MANAGER)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.actualizarActivo).not.toHaveBeenCalled();
    });

    it('activar no exige nada; marcar el estado que ya tiene es válido', async () => {
      const { service, repo } = crear();
      repo.obtenerParaAdmin.mockResolvedValue(admin as never);
      expect(await service.cambiarEstado(1, true, MANAGER)).toMatchObject({ activo: true });
      repo.obtenerParaAdmin.mockResolvedValue({ ...admin, activo: false } as never);
      expect(await service.cambiarEstado(1, false, MANAGER)).toMatchObject({ activo: false });
      expect(repo.bloquearAdministradores).not.toHaveBeenCalled();
    });
  });

  describe('adoptantePorUsuarioId', () => {
    it('devuelve id y nombre completo sin documento ni dirección', async () => {
      const { service, repo } = crear();
      repo.buscarAdoptantePorUsuarioId.mockResolvedValue({
        id: 4,
        primerNombre: 'Ana',
        segundoNombre: null,
        primerApellido: 'Pérez',
        segundoApellido: 'Gil',
        numeroDocumento: '123',
        direccion: 'Calle 1',
      } as never);
      const r = await service.adoptantePorUsuarioId(7);
      expect(r).toEqual({ id: 4, usuarioId: 7, nombreCompleto: 'Ana Pérez Gil' });
    });

    it('un usuario que no es adoptante devuelve null', async () => {
      const { service, repo } = crear();
      repo.buscarAdoptantePorUsuarioId.mockResolvedValue(null);
      expect(await service.adoptantePorUsuarioId(9)).toBeNull();
    });
  });
});
