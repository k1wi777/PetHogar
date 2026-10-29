import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Donaciones y notificaciones: referencia a la entidad relacionada y clave de deduplicación en
 * `notificacion` (única por destinatario), índice de listado y, en `donacion`, el índice de la
 * página y el agregado por fundación y periodo.
 */
export class DonacionesNotificaciones1762100000000 implements MigrationInterface {
  name = 'DonacionesNotificaciones1762100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notificacion" ADD "entidad" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "notificacion" ADD "entidad_id" integer`);
    await queryRunner.query(`ALTER TABLE "notificacion" ADD "clave" character varying(80)`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_notificacion_clave" ON "notificacion" ("usuario_id", "clave") WHERE "clave" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notificacion_usuario_fecha" ON "notificacion" ("usuario_id", "fecha_creacion" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_donacion_fundacion_fecha" ON "donacion" ("fundacion_id", "fecha" DESC, "id" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_donacion_fundacion_fecha"`);
    await queryRunner.query(`DROP INDEX "idx_notificacion_usuario_fecha"`);
    await queryRunner.query(`DROP INDEX "uq_notificacion_clave"`);
    await queryRunner.query(`ALTER TABLE "notificacion" DROP COLUMN "clave"`);
    await queryRunner.query(`ALTER TABLE "notificacion" DROP COLUMN "entidad_id"`);
    await queryRunner.query(`ALTER TABLE "notificacion" DROP COLUMN "entidad"`);
  }
}
