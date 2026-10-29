import { Logger } from '@nestjs/common';
import type { CronJob } from 'cron';
import {
  JOB_RECORDATORIOS,
  JOB_VENCIDOS,
  SeguimientosCronRegistro,
} from './seguimientos-cron.registro';

const ENTORNO: Record<string, unknown> = {
  SEGUIMIENTOS_CRON_HABILITADO: 'true',
  SEGUIMIENTOS_CRON_VENCIDOS: '10 0 * * *',
  SEGUIMIENTOS_CRON_RECORDATORIOS: '0 7 * * *',
};

describe('SeguimientosCronRegistro', () => {
  const trabajos = new Map<string, CronJob>();
  const scheduler = {
    addCronJob: jest.fn((nombre: string, job: CronJob) => trabajos.set(nombre, job)),
    deleteCronJob: jest.fn((nombre: string) => {
      trabajos.get(nombre)?.stop();
      trabajos.delete(nombre);
    }),
  };
  const tareas = { marcarVencidos: jest.fn(), emitirRecordatorios: jest.fn() };
  let entorno: Record<string, unknown>;
  const crear = () =>
    new SeguimientosCronRegistro(
      scheduler as never,
      { get: (clave: string) => entorno[clave] } as never,
      tareas as never,
    );
  const flush = () => new Promise((resolver) => setImmediate(resolver));
  let registro: SeguimientosCronRegistro;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    entorno = { ...ENTORNO };
    trabajos.clear();
    tareas.marcarVencidos.mockResolvedValue(2);
    tareas.emitirRecordatorios.mockResolvedValue(1);
  });
  afterEach(() => registro?.onModuleDestroy());

  it('deshabilitado: no se programa ningún temporizador', () => {
    entorno.SEGUIMIENTOS_CRON_HABILITADO = 'false';
    registro = crear();
    registro.onApplicationBootstrap();
    expect(scheduler.addCronJob).not.toHaveBeenCalled();
    expect(trabajos.size).toBe(0);
  });

  it('habilitado: registra los dos jobs con la expresión configurada y zona de Bogotá, activos', () => {
    entorno.SEGUIMIENTOS_CRON_VENCIDOS = '30 1 * * *';
    registro = crear();
    registro.onApplicationBootstrap();
    expect([...trabajos.keys()]).toEqual([JOB_VENCIDOS, JOB_RECORDATORIOS]);
    const vencidos = trabajos.get(JOB_VENCIDOS)!;
    const recordatorios = trabajos.get(JOB_RECORDATORIOS)!;
    expect(vencidos.cronTime.source).toBe('30 1 * * *');
    expect(recordatorios.cronTime.source).toBe('0 7 * * *');
    expect(vencidos.nextDate().zoneName).toBe('America/Bogota');
    expect(vencidos.isActive).toBe(true);
    expect(recordatorios.isActive).toBe(true);
  });

  it('cada job dispara su tarea', async () => {
    registro = crear();
    registro.onApplicationBootstrap();
    trabajos.get(JOB_VENCIDOS)!.fireOnTick();
    trabajos.get(JOB_RECORDATORIOS)!.fireOnTick();
    await flush();
    expect(tareas.marcarVencidos).toHaveBeenCalledTimes(1);
    expect(tareas.emitirRecordatorios).toHaveBeenCalledTimes(1);
  });

  it('una expresión inválida impide registrar y falla con error (el entorno ya la valida al arrancar)', () => {
    entorno.SEGUIMIENTOS_CRON_VENCIDOS = 'no es cron';
    registro = crear();
    expect(() => registro.onApplicationBootstrap()).toThrow();
    expect(trabajos.size).toBe(0);
  });

  it('una excepción en la tarea se registra y no escapa', async () => {
    tareas.marcarVencidos.mockRejectedValue(new Error('caída de la base'));
    registro = crear();
    await expect(
      registro.ejecutar(JOB_VENCIDOS, () => tareas.marcarVencidos() as Promise<number>),
    ).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('caída de la base'),
    );
  });

  it('no solapa la misma tarea consigo misma', async () => {
    registro = crear();
    let liberar!: () => void;
    const lenta = jest.fn(() => new Promise<number>((resolver) => (liberar = () => resolver(1))));
    const primera = registro.ejecutar('t', lenta);
    await registro.ejecutar('t', lenta);
    expect(lenta).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.warn).toHaveBeenCalled();
    liberar();
    await primera;
    const tercera = registro.ejecutar('t', lenta);
    liberar();
    await tercera;
    expect(lenta).toHaveBeenCalledTimes(2);
  });

  it('al destruir el módulo quita y detiene los jobs', () => {
    registro = crear();
    registro.onApplicationBootstrap();
    const job = trabajos.get(JOB_VENCIDOS)!;
    registro.onModuleDestroy();
    expect(scheduler.deleteCronJob).toHaveBeenCalledWith(JOB_VENCIDOS);
    expect(scheduler.deleteCronJob).toHaveBeenCalledWith(JOB_RECORDATORIOS);
    expect(job.isActive).toBe(false);
  });
});
