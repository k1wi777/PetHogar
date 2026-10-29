import type { DataSource } from 'typeorm';
import { InstantaneaService } from './instantanea.service';

function crear() {
  const manager = { query: jest.fn() };
  const runner = {
    manager,
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const dataSource = { createQueryRunner: () => runner } as unknown as DataSource;
  return { service: new InstantaneaService(dataSource), runner, manager };
}

describe('InstantaneaService.leer', () => {
  it('abre REPEATABLE READ de solo lectura, entrega el manager, confirma y libera', async () => {
    const { service, runner, manager } = crear();
    const resultado = await service.leer(async (m) => {
      expect(m).toBe(manager);
      return 42;
    });
    expect(resultado).toBe(42);
    expect(runner.startTransaction).toHaveBeenCalledWith('REPEATABLE READ');
    expect(runner.query).toHaveBeenCalledWith('SET TRANSACTION READ ONLY');
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('si fn lanza, hace rollback, libera la conexión y propaga el error original', async () => {
    const { service, runner } = crear();
    const error = new Error('fallo');
    await expect(
      service.leer(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('libera la conexión aunque no se pueda iniciar la transacción', async () => {
    const { service, runner } = crear();
    runner.startTransaction.mockRejectedValue(new Error('sin conexión'));
    await expect(service.leer(async () => 1)).rejects.toThrow('sin conexión');
    expect(runner.release).toHaveBeenCalledTimes(1);
  });
});
