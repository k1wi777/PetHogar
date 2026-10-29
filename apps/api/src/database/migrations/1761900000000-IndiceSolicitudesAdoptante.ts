import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índice de «mis solicitudes», «mis adopciones» y del duplicado histórico: `uq_solicitud_pendiente`
 * es parcial (solo `pendiente`) y Postgres no indexa las claves foráneas.
 */
export class IndiceSolicitudesAdoptante1761900000000 implements MigrationInterface {
  name = 'IndiceSolicitudesAdoptante1761900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_solicitud_adoptante_fecha" ON "solicitud_adopcion" ("adoptante_id", "fecha_solicitud" DESC, "id" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_solicitud_adoptante_fecha"`);
  }
}
