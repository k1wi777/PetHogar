import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seguimiento post-adopción: marcas persistentes para las tareas programadas (`recordatorio_enviado_en`)
 * y del reporte (`reporte_enviado_en`), origen de cada foto (fundación o adoptante) e índices para el
 * cron, la unicidad de un seguimiento pendiente por adopción, tipo y fecha, y la FK de evidencias.
 */
export class SeguimientoPostAdopcion1762000000000 implements MigrationInterface {
  name = 'SeguimientoPostAdopcion1762000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "seguimiento" ADD "recordatorio_enviado_en" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "seguimiento" ADD "reporte_enviado_en" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."origen_evidencia" AS ENUM('fundacion', 'adoptante')`,
    );
    await queryRunner.query(
      `ALTER TABLE "seguimiento_evidencia" ADD "origen" "public"."origen_evidencia" NOT NULL DEFAULT 'fundacion'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_seguimiento_evidencia_seguimiento" ON "seguimiento_evidencia" ("seguimiento_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_seguimiento_pendiente_fecha" ON "seguimiento" ("fecha_programada") WHERE "estado" = 'programado'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_seguimiento_pendiente" ON "seguimiento" ("adopcion_id", "tipo", "fecha_programada") WHERE "estado" IN ('programado', 'vencido')`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_seguimiento_pendiente"`);
    await queryRunner.query(`DROP INDEX "idx_seguimiento_pendiente_fecha"`);
    await queryRunner.query(`DROP INDEX "idx_seguimiento_evidencia_seguimiento"`);
    await queryRunner.query(`ALTER TABLE "seguimiento_evidencia" DROP COLUMN "origen"`);
    await queryRunner.query(`DROP TYPE "public"."origen_evidencia"`);
    await queryRunner.query(`ALTER TABLE "seguimiento" DROP COLUMN "reporte_enviado_en"`);
    await queryRunner.query(`ALTER TABLE "seguimiento" DROP COLUMN "recordatorio_enviado_en"`);
  }
}
