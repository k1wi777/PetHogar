import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

/**
 * Lectura consistente: todas las consultas de `fn` ven el mismo estado de la base (un único
 * snapshot `REPEATABLE READ`). Al ser `READ ONLY` no hay fallos de serialización ni reintentos.
 */
@Injectable()
export class InstantaneaService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Las consultas de `fn` deben ejecutarse en serie: una transacción es una sola conexión. La
   * conexión se libera al terminar, así que `fn` no debe conservar el `EntityManager`.
   */
  async leer<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction('REPEATABLE READ');
      await runner.query('SET TRANSACTION READ ONLY');
      try {
        const resultado = await fn(runner.manager);
        await runner.commitTransaction();
        return resultado;
      } catch (error) {
        await runner.rollbackTransaction();
        throw error;
      }
    } finally {
      await runner.release();
    }
  }
}
