import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices de las estadísticas y los reportes: solicitudes por estado y fecha, seguimientos por
 * fecha programada (el índice parcial existente solo cubre `programado`) y adopciones por fecha
 * de entrega.
 */
export class IndicesReportes1762200000000 implements MigrationInterface {
  name = 'IndicesReportes1762200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_solicitud_estado_fecha" ON "solicitud_adopcion" ("estado", "fecha_solicitud")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_seguimiento_fecha" ON "seguimiento" ("fecha_programada", "estado")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_adopcion_fecha" ON "adopcion" ("fecha_entrega")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_adopcion_fecha"`);
    await queryRunner.query(`DROP INDEX "idx_seguimiento_fecha"`);
    await queryRunner.query(`DROP INDEX "idx_solicitud_estado_fecha"`);
  }
}
