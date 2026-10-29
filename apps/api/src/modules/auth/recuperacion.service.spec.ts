import { BadRequestException, Logger } from '@nestjs/common';
import { hashearCodigo } from './codigo-recuperacion';
import { hashearContrasena } from './contrasena';
import {
  ENFRIAMIENTO_CODIGO_MS,
  MENSAJE_CODIGO_INVALIDO,
  MENSAJE_CONTRASENA_CAMBIADA,
  MENSAJE_RECUPERACION,
  RecuperacionService,
} from './recuperacion.service';

jest.mock('./contrasena', () => {
  const real = jest.requireActual<typeof import('./contrasena')>('./contrasena');
  return { ...real, hashearContrasena: jest.fn(real.hashearContrasena) };
});

const AHORA = new Date('2026-10-29T12:00:00Z');
const SECRETO = 'r'.repeat(32);
const MINUTO_MS = 60_000;
const MANAGER = { id: 'tx' };
const VIGENCIA_MIN = 15;
const MAX_INTENTOS = 3;

const USUARIO = {
  id: 5,
  email: 'ana@example.com',
  contrasenaHash: 'x',
  rol: 'adoptante' as const,
  activo: true,
  emailVerificado: true,
  intentosFallidos: 0,
  bloqueadoHasta: null,
  tokenVerificacionExpira: null,
};

/** Simula la fila de `usuario` que el repository real actualiza con sentencias atómicas. */
function crear() {
  const fila = {
    hash: null as string | null,
    expira: null as Date | null,
    intentos: 0,
    contrasena: 'vieja',
    sesionesRevocadas: 0,
    ultimoEnvio: null as string | null,
  };
  const usuarios = {
    buscarPorEmail: jest.fn().mockResolvedValue(USUARIO),
    obtenerPerfil: jest.fn().mockResolvedValue({ adoptante: { primerNombre: 'Ana' } }),
    guardarCodigoRecuperacion: jest
      .fn()
      .mockImplementation(async (_id: number, hash: string, expira: Date, maxima: Date) => {
        if (fila.expira && fila.expira.getTime() > maxima.getTime()) return false;
        Object.assign(fila, { hash, expira, intentos: 0 });
        return true;
      }),
    reclamarIntentoCodigo: jest
      .fn()
      .mockImplementation(async (_id: number, max: number, ahora: Date) => {
        if (!fila.hash || !fila.expira || fila.expira <= ahora || fila.intentos >= max) return null;
        fila.intentos++;
        return fila.hash;
      }),
    restablecerContrasena: jest
      .fn()
      .mockImplementation(async (_id: number, hashCodigo: string, nuevo: string) => {
        if (fila.hash !== hashCodigo) return false;
        Object.assign(fila, { hash: null, expira: null, intentos: 0, contrasena: nuevo });
        return true;
      }),
  };
  const fundaciones = { obtenerPorUsuarioId: jest.fn().mockResolvedValue({ nombre: 'Huellas' }) };
  const sesion = {
    revocarTodas: jest.fn().mockImplementation(async () => {
      fila.sesionesRevocadas++;
    }),
  };
  const mail = { enviar: jest.fn().mockResolvedValue({ enviado: true }) };
  const dataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => fn(MANAGER)),
  };
  const config = {
    get: (clave: string) =>
      ({
        JWT_REFRESH_SECRET: SECRETO,
        RESET_CODE_EXPIRA_MIN: VIGENCIA_MIN,
        RESET_CODE_MAX_INTENTOS: MAX_INTENTOS,
      })[clave],
  };
  const service = new RecuperacionService(
    dataSource as never,
    usuarios as never,
    fundaciones as never,
    sesion as never,
    mail as never,
    config as never,
  );
  const codigoEnviado = (): string =>
    (mail.enviar.mock.calls.at(-1)?.[0] as { datos: { codigo: string } }).datos.codigo;
  return { service, usuarios, fundaciones, sesion, mail, dataSource, fila, codigoEnviado };
}

const vaciar = (): Promise<void> => new Promise((r) => setImmediate(r));
const dto = (codigo: string, nueva = 'NuevaClave1') => ({
  email: USUARIO.email,
  codigo,
  nuevaContrasena: nueva,
});
const incorrecto = (codigo: string): string => (codigo === '000000' ? '000001' : '000000');

describe('RecuperacionService', () => {
  let logError: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(AHORA);
    (hashearContrasena as unknown as jest.Mock).mockClear();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('solicitar (forgot-password)', () => {
    it('cuenta activa y verificada: guarda el HMAC del código, la expiración, y lo envía', async () => {
      const { service, usuarios, mail, fila, codigoEnviado } = crear();
      expect(await service.solicitar(USUARIO.email)).toEqual({ mensaje: MENSAJE_RECUPERACION });
      await vaciar();

      const codigo = codigoEnviado();
      expect(codigo).toMatch(/^\d{6}$/);
      expect(fila.hash).toBe(hashearCodigo(SECRETO, 5, codigo));
      expect(fila.hash).not.toContain(codigo);
      expect(fila.expira?.getTime()).toBe(AHORA.getTime() + VIGENCIA_MIN * MINUTO_MS);
      expect(fila.intentos).toBe(0);
      expect(mail.enviar).toHaveBeenCalledWith({
        para: USUARIO.email,
        plantilla: 'recuperacion-contrasena',
        datos: { nombre: 'Ana', codigo, minutosVigencia: VIGENCIA_MIN },
      });
      expect(usuarios.guardarCodigoRecuperacion).toHaveBeenCalledTimes(1);
    });

    it('responde exactamente igual si el correo no existe, sin escribir ni enviar', async () => {
      const a = crear();
      const existente = await a.service.solicitar(USUARIO.email);
      const b = crear();
      b.usuarios.buscarPorEmail.mockResolvedValue(null);
      const inexistente = await b.service.solicitar('nadie@example.com');
      await vaciar();
      expect(inexistente).toEqual(existente);
      expect(b.usuarios.guardarCodigoRecuperacion).not.toHaveBeenCalled();
      expect(b.mail.enviar).not.toHaveBeenCalled();
    });

    it('responde antes de escribir o enviar: solo hubo el SELECT (sin diferencia de tiempo)', async () => {
      const { service, usuarios, mail } = crear();
      let liberar!: () => void;
      usuarios.guardarCodigoRecuperacion.mockReturnValue(
        new Promise((r) => (liberar = () => r(true))),
      );
      const r = await service.solicitar(USUARIO.email);
      expect(r.mensaje).toBe(MENSAJE_RECUPERACION);
      expect(mail.enviar).not.toHaveBeenCalled();
      liberar();
      await vaciar();
      expect(mail.enviar).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['inactiva', { activo: false }],
      ['sin verificar', { emailVerificado: false }],
    ])('cuenta %s: misma respuesta y silencio total', async (_n, cambio) => {
      const { service, usuarios, mail } = crear();
      usuarios.buscarPorEmail.mockResolvedValue({ ...USUARIO, ...cambio });
      expect(await service.solicitar(USUARIO.email)).toEqual({ mensaje: MENSAJE_RECUPERACION });
      await vaciar();
      expect(usuarios.guardarCodigoRecuperacion).not.toHaveBeenCalled();
      expect(mail.enviar).not.toHaveBeenCalled();
    });

    it('una fundación recibe el código con el nombre de la fundación', async () => {
      const { service, usuarios, mail } = crear();
      usuarios.buscarPorEmail.mockResolvedValue({ ...USUARIO, rol: 'fundacion' });
      await service.solicitar(USUARIO.email);
      await vaciar();
      expect(mail.enviar.mock.calls[0][0].datos.nombre).toBe('Huellas');
    });

    it.each([
      ['fundación sin registro', { ...USUARIO, rol: 'fundacion' as const }],
      ['adoptante sin perfil', USUARIO],
    ])('%s: el correo se envía igual con un nombre genérico', async (_n, usuario) => {
      const { service, usuarios, fundaciones, mail } = crear();
      usuarios.buscarPorEmail.mockResolvedValue(usuario);
      fundaciones.obtenerPorUsuarioId.mockResolvedValue(null);
      usuarios.obtenerPerfil.mockResolvedValue(null);
      await service.solicitar(USUARIO.email);
      await vaciar();
      expect(mail.enviar.mock.calls[0][0].datos.nombre).toBe('usuario');
    });

    it('enfriamiento: no emite otro código hasta pasados 5 minutos del anterior', async () => {
      const { service, mail, fila, codigoEnviado } = crear();
      await service.solicitar(USUARIO.email);
      await vaciar();
      const primero = codigoEnviado();

      jest.setSystemTime(AHORA.getTime() + ENFRIAMIENTO_CODIGO_MS - 1);
      await service.solicitar(USUARIO.email);
      await vaciar();
      expect(mail.enviar).toHaveBeenCalledTimes(1);

      jest.setSystemTime(AHORA.getTime() + ENFRIAMIENTO_CODIGO_MS);
      await service.solicitar(USUARIO.email);
      await vaciar();
      expect(mail.enviar).toHaveBeenCalledTimes(2);
      // El nuevo invalida al anterior y reinicia intentos.
      expect(fila.hash).toBe(hashearCodigo(SECRETO, 5, codigoEnviado()));
      expect(fila.hash).not.toBe(hashearCodigo(SECRETO, 5, primero));
      expect(fila.intentos).toBe(0);
    });

    it('si falla la escritura no rompe la respuesta y no registra el código en el log', async () => {
      const { service, usuarios, mail } = crear();
      usuarios.guardarCodigoRecuperacion.mockRejectedValue(new Error('conexión perdida'));
      expect(await service.solicitar(USUARIO.email)).toEqual({ mensaje: MENSAJE_RECUPERACION });
      await vaciar();
      expect(mail.enviar).not.toHaveBeenCalled();
      expect(logError).toHaveBeenCalledWith(expect.stringContaining('conexión perdida'));
    });

    it('nunca escribe el código en los logs', async () => {
      const { service, codigoEnviado } = crear();
      const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((m) =>
        jest.spyOn(Logger.prototype, m).mockImplementation(() => undefined),
      );
      await service.solicitar(USUARIO.email);
      await vaciar();
      const codigo = codigoEnviado();
      for (const spy of spies) {
        expect(JSON.stringify(spy.mock.calls)).not.toContain(codigo);
      }
    });
  });

  describe('restablecer (reset-password)', () => {
    async function conCodigo() {
      const ctx = crear();
      await ctx.service.solicitar(USUARIO.email);
      await vaciar();
      return { ...ctx, codigo: ctx.codigoEnviado() };
    }

    it('éxito: cambia la contraseña con bcrypt, consume el código y revoca sesiones en la misma transacción', async () => {
      const { service, usuarios, sesion, fila, codigo, dataSource } = await conCodigo();
      expect(await service.restablecer(dto(codigo))).toEqual({
        mensaje: MENSAJE_CONTRASENA_CAMBIADA,
      });
      expect(fila.contrasena).toMatch(/^\$2[aby]\$10\$/);
      expect(fila.contrasena).not.toContain('NuevaClave1');
      expect(fila.hash).toBeNull();
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(usuarios.restablecerContrasena.mock.calls[0][3]).toBe(MANAGER);
      expect(sesion.revocarTodas).toHaveBeenCalledWith(5, MANAGER);
    });

    it('un código ya usado se rechaza con el mismo mensaje genérico', async () => {
      const { service, codigo, sesion } = await conCodigo();
      await service.restablecer(dto(codigo));
      await expect(service.restablecer(dto(codigo))).rejects.toThrow(MENSAJE_CODIGO_INVALIDO);
      expect(sesion.revocarTodas).toHaveBeenCalledTimes(1);
    });

    it('código incorrecto: 400 genérico y el intento queda contado', async () => {
      const { service, codigo, fila, sesion } = await conCodigo();
      const err = await service.restablecer(dto(incorrecto(codigo))).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toBe(MENSAJE_CODIGO_INVALIDO);
      expect(fila.intentos).toBe(1);
      expect(fila.contrasena).toBe('vieja');
      expect(sesion.revocarTodas).not.toHaveBeenCalled();
    });

    it('vencido: se rechaza aunque sea correcto', async () => {
      const { service, codigo } = await conCodigo();
      jest.setSystemTime(AHORA.getTime() + VIGENCIA_MIN * MINUTO_MS);
      await expect(service.restablecer(dto(codigo))).rejects.toThrow(MENSAJE_CODIGO_INVALIDO);
    });

    it('justo antes de vencer todavía sirve', async () => {
      const { service, codigo } = await conCodigo();
      jest.setSystemTime(AHORA.getTime() + VIGENCIA_MIN * MINUTO_MS - 1);
      await expect(service.restablecer(dto(codigo))).resolves.toBeDefined();
    });

    it('agotados los intentos, rechaza el código correcto', async () => {
      const { service, codigo, fila, sesion } = await conCodigo();
      for (let i = 0; i < MAX_INTENTOS; i++) {
        await expect(service.restablecer(dto(incorrecto(codigo)))).rejects.toThrow(
          MENSAJE_CODIGO_INVALIDO,
        );
      }
      await expect(service.restablecer(dto(codigo))).rejects.toThrow(MENSAJE_CODIGO_INVALIDO);
      expect(fila.intentos).toBe(MAX_INTENTOS);
      expect(fila.contrasena).toBe('vieja');
      expect(sesion.revocarTodas).not.toHaveBeenCalled();
    });

    it('el último intento permitido todavía puede acertar', async () => {
      const { service, codigo } = await conCodigo();
      for (let i = 0; i < MAX_INTENTOS - 1; i++) {
        await service.restablecer(dto(incorrecto(codigo))).catch(() => undefined);
      }
      await expect(service.restablecer(dto(codigo))).resolves.toBeDefined();
    });

    it('peticiones paralelas no superan el máximo de intentos reclamados', async () => {
      const { service, codigo, usuarios } = await conCodigo();
      const intentos = Array.from({ length: 10 }, () =>
        service.restablecer(dto(incorrecto(codigo))).catch(() => undefined),
      );
      await Promise.all(intentos);
      const reclamos = (await Promise.all(
        usuarios.reclamarIntentoCodigo.mock.results.map((r) => r.value),
      )) as (string | null)[];
      expect(reclamos.filter((h) => h !== null)).toHaveLength(MAX_INTENTOS);
    });

    it('dos peticiones simultáneas con el código correcto: solo una cambia la contraseña', async () => {
      const { service, codigo, sesion } = await conCodigo();
      const resultados = await Promise.allSettled([
        service.restablecer(dto(codigo, 'ClaveUno123')),
        service.restablecer(dto(codigo, 'ClaveDos123')),
      ]);
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const fallo = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect((fallo.reason as BadRequestException).message).toBe(MENSAJE_CODIGO_INVALIDO);
      expect(sesion.revocarTodas).toHaveBeenCalledTimes(1);
    });

    it('si el UPDATE final ya no encuentra el código (otra petición lo consumió), 400 sin revocar', async () => {
      const { service, codigo, usuarios, sesion } = await conCodigo();
      usuarios.restablecerContrasena.mockResolvedValue(false);
      await expect(service.restablecer(dto(codigo))).rejects.toThrow(MENSAJE_CODIGO_INVALIDO);
      expect(sesion.revocarTodas).not.toHaveBeenCalled();
    });

    it.each([
      [
        'cuenta inexistente',
        (u: ReturnType<typeof crear>['usuarios']) => u.buscarPorEmail.mockResolvedValue(null),
      ],
      [
        'cuenta inactiva o sin código',
        (u: ReturnType<typeof crear>['usuarios']) =>
          u.reclamarIntentoCodigo.mockResolvedValue(null),
      ],
    ])('%s: el mismo 400 genérico', async (_n, preparar) => {
      const { service, usuarios } = crear();
      preparar(usuarios);
      await expect(service.restablecer(dto('123456'))).rejects.toThrow(MENSAJE_CODIGO_INVALIDO);
    });

    it('cuenta que nunca pidió código: genérico', async () => {
      const { service } = crear();
      await expect(service.restablecer(dto('123456'))).rejects.toThrow(MENSAJE_CODIGO_INVALIDO);
    });

    it('hashea la contraseña antes de consultar nada (todos los caminos cuestan lo mismo)', async () => {
      const { service, usuarios } = crear();
      usuarios.buscarPorEmail.mockResolvedValue(null);
      await expect(service.restablecer(dto('123456'))).rejects.toThrow(MENSAJE_CODIGO_INVALIDO);
      const hash = (hashearContrasena as unknown as jest.Mock).mock.invocationCallOrder[0];
      expect(hash).toBeLessThan(usuarios.buscarPorEmail.mock.invocationCallOrder[0]);
    });
  });
});
