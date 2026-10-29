import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo público de mascotas: clave de la miniatura de cada foto, índices de las consultas del
 * catálogo y la extensión `unaccent` (filtro de ciudad sin tildes).
 */
export class CatalogoMascotas1761800000000 implements MigrationInterface {
  name = 'CatalogoMascotas1761800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);
    // `url` guarda la clave de la versión grande y `url_catalogo` la de la miniatura. Las filas
    // existentes (seed demo) repiten la misma ruta.
    await queryRunner.query(`ALTER TABLE "foto_mascota" ADD "url_catalogo" character varying(255)`);
    await queryRunner.query(`UPDATE "foto_mascota" SET "url_catalogo" = "url"`);
    await queryRunner.query(`ALTER TABLE "foto_mascota" ALTER COLUMN "url_catalogo" SET NOT NULL`);
    await queryRunner.query(
      `CREATE INDEX "idx_mascota_catalogo" ON "mascota" ("fecha_publicacion" DESC, "id" DESC) WHERE "estado" = 'disponible'`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_foto_mascota_mascota" ON "foto_mascota" ("mascota_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_historial_mascota_fecha" ON "historial_medico" ("mascota_id", "fecha" DESC, "id" DESC)`,
    );
  }

  /** No elimina `unaccent`: es una extensión compartida que otras consultas pueden usar. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_historial_mascota_fecha"`);
    await queryRunner.query(`DROP INDEX "idx_foto_mascota_mascota"`);
    await queryRunner.query(`DROP INDEX "idx_mascota_catalogo"`);
    await queryRunner.query(`ALTER TABLE "foto_mascota" DROP COLUMN "url_catalogo"`);
  }
}
