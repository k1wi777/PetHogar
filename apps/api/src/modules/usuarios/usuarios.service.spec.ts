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
    existeDocumento: jest.fn(),
    registrarIntentoFallido: jest.fn(),
    reiniciarIntentos: jest.fn(),
    guardarTokenVerificacion: jest.fn(),
    consumirTokenVerificacion: jest.fn(),
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
});
