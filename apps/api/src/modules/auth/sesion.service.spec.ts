import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { UsuarioCredenciales } from '../usuarios/usuarios.types';
import type { PerfilService } from './perfil.service';
import type { RefreshToken } from './entities/refresh-token.entity';
import type { RefreshTokenRepository } from './refresh-token.repository';
import { SesionService } from './sesion.service';
import { hashHmac } from './tokens.util';

const AHORA = new Date('2026-10-29T12:00:00Z');
const SECRETO = 'r'.repeat(32);
const DIA_MS = 86_400_000;
const MANAGER = { id: 'tx' };
const PERFIL = { id: 5, email: 'ana@example.com' };

const USUARIO: UsuarioCredenciales = {
  id: 5,
  email: 'ana@example.com',
  contrasenaHash: 'x',
  rol: 'adoptante',
  activo: true,
  emailVerificado: true,
  intentosFallidos: 0,
  bloqueadoHasta: null,
  tokenVerificacionExpira: null,
};

const registro = (parcial: Partial<RefreshToken> = {}): RefreshToken =>
  ({
    id: 10,
    usuarioId: 5,
    tokenHash: 'h',
    expiraEn: new Date(AHORA.getTime() + DIA_MS),
    revocado: false,
    ...parcial,
  }) as RefreshToken;

function crear() {
  const repo = {
    crear: jest.fn().mockResolvedValue(undefined),
    buscarPorHash: jest.fn(),
    revocarSiActivo: jest.fn().mockResolvedValue(true),
    revocarPorHash: jest.fn().mockResolvedValue(undefined),
    revocarTodosDeUsuario: jest.fn().mockResolvedValue(undefined),
  };
  const usuarios = { buscarPorId: jest.fn().mockResolvedValue(USUARIO) };
  const perfil = { obtener: jest.fn().mockResolvedValue(PERFIL) };
  const jwt = new JwtService({
    secret: 'a'.repeat(32),
    signOptions: { algorithm: 'HS256', expiresIn: 900 },
  });
  const dataSource = {
    transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) => cb(MANAGER)),
  };
  const config = {
    get: (c: string) =>
      ({ JWT_REFRESH_SECRET: SECRETO, JWT_REFRESH_EXPIRES_DAYS: 7, JWT_ACCESS_EXPIRES_MIN: 15 })[c],
  };
  const service = new SesionService(
    dataSource as never,
    repo as unknown as RefreshTokenRepository,
    jwt,
    config as never,
    usuarios as unknown as UsuariosService,
    perfil as unknown as PerfilService,
  );
  return { service, repo, usuarios, jwt, dataSource };
}

describe('SesionService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(AHORA);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('abrir', () => {
    it('emite un access token de 15 min y guarda solo el HMAC del refresh de 7 días', async () => {
      const { service, repo, jwt } = crear();
      const s = await service.abrir({ id: 5, rol: 'adoptante' }, AHORA);

      expect(s.respuesta.expiresIn).toBe(900);
      expect(s.respuesta.usuario).toBe(PERFIL);
      const payload = await jwt.verifyAsync<{ sub: number; rol: string; exp: number; iat: number }>(
        s.respuesta.accessToken,
      );
      expect(payload).toMatchObject({ sub: 5, rol: 'adoptante' });
      expect(payload.exp - payload.iat).toBe(900);

      const [usuarioId, hash, expira] = repo.crear.mock.calls[0];
      expect(usuarioId).toBe(5);
      expect(hash).toBe(hashHmac(SECRETO, s.refreshToken));
      expect(hash).not.toContain(s.refreshToken);
      expect(expira.getTime()).toBe(AHORA.getTime() + 7 * DIA_MS);
      expect(s.refreshVigenciaMs).toBe(7 * DIA_MS);
      expect(JSON.stringify(s.respuesta)).not.toContain(s.refreshToken);
    });
  });

  describe('renovar', () => {
    it('rota: revoca el token presentado y crea el sucesor en la misma transacción', async () => {
      const { service, repo, dataSource } = crear();
      repo.buscarPorHash.mockResolvedValue(registro());
      const s = await service.renovar('token-viejo');

      expect(repo.buscarPorHash).toHaveBeenCalledWith(hashHmac(SECRETO, 'token-viejo'));
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(repo.revocarSiActivo).toHaveBeenCalledWith(10, MANAGER);
      expect(repo.crear.mock.calls[0][3]).toBe(MANAGER);
      expect(s.refreshToken).not.toBe('token-viejo');
      expect(repo.crear.mock.calls[0][1]).toBe(hashHmac(SECRETO, s.refreshToken));
      expect(s.respuesta.accessToken).toEqual(expect.any(String));
    });

    it('un token revocado o ya rotado cuenta como reutilización: 401 y revoca todas las sesiones', async () => {
      const { service, repo } = crear();
      repo.buscarPorHash.mockResolvedValue(registro({ revocado: true }));
      await expect(service.renovar('viejo')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repo.revocarTodosDeUsuario).toHaveBeenCalledWith(5);
      expect(repo.revocarSiActivo).not.toHaveBeenCalled();
    });

    it('si pierde la carrera con otra rotación del mismo token, también es reutilización', async () => {
      const { service, repo } = crear();
      repo.buscarPorHash.mockResolvedValue(registro());
      repo.revocarSiActivo.mockResolvedValue(false);
      await expect(service.renovar('t')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repo.crear).not.toHaveBeenCalled();
      expect(repo.revocarTodosDeUsuario).toHaveBeenCalledWith(5);
    });

    it('un token desconocido da 401 sin otros efectos', async () => {
      const { service, repo } = crear();
      repo.buscarPorHash.mockResolvedValue(null);
      await expect(service.renovar('x')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repo.revocarTodosDeUsuario).not.toHaveBeenCalled();
      expect(repo.crear).not.toHaveBeenCalled();
    });

    it('un token vencido da 401 sin rotar ni revocar sesiones', async () => {
      const { service, repo } = crear();
      repo.buscarPorHash.mockResolvedValue(registro({ expiraEn: new Date(AHORA.getTime() - 1) }));
      await expect(service.renovar('x')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repo.revocarSiActivo).not.toHaveBeenCalled();
      expect(repo.revocarTodosDeUsuario).not.toHaveBeenCalled();
    });

    it('si el usuario está inactivo o ya no existe da 401', async () => {
      const a = crear();
      a.repo.buscarPorHash.mockResolvedValue(registro());
      a.usuarios.buscarPorId.mockResolvedValue({ ...USUARIO, activo: false });
      await expect(a.service.renovar('x')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(a.repo.revocarSiActivo).not.toHaveBeenCalled();

      const b = crear();
      b.repo.buscarPorHash.mockResolvedValue(registro());
      b.usuarios.buscarPorId.mockResolvedValue(null);
      await expect(b.service.renovar('x')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('revocar', () => {
    it('revoca por el HMAC del token', async () => {
      const { service, repo } = crear();
      await service.revocar('tok');
      expect(repo.revocarPorHash).toHaveBeenCalledWith(hashHmac(SECRETO, 'tok'));
    });
  });

  describe('revocarTodas', () => {
    it('revoca todas las sesiones, dentro de la transacción del llamador si se pasa su manager', async () => {
      const { service, repo } = crear();
      await service.revocarTodas(5, MANAGER as never);
      expect(repo.revocarTodosDeUsuario).toHaveBeenCalledWith(5, MANAGER);
    });
  });
});
