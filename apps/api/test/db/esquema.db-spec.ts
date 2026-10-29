import type { DataSource } from 'typeorm';
import { borrarBaseDePrueba, contar, crearDataSource, recrearBaseDePrueba } from './db-helper';

const SQL_TABLAS_APP = `SELECT count(*) AS n FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name <> 'migrations'`;
const SQL_ENUMS = `SELECT count(*) AS n FROM pg_type t JOIN pg_namespace s ON s.oid = t.typnamespace
  WHERE s.nspname = 'public' AND t.typtype = 'e'`;

const SQL_INDICES_CATALOGO = `SELECT count(*) AS n FROM pg_indexes WHERE schemaname = 'public'
  AND indexname IN ('idx_mascota_catalogo', 'idx_foto_mascota_mascota', 'idx_historial_mascota_fecha')`;
const SQL_INDICE_SOLICITUDES = `SELECT count(*) AS n FROM pg_indexes WHERE schemaname = 'public'
  AND indexname = 'idx_solicitud_adoptante_fecha'`;
const SQL_SEGUIMIENTO_POST = `SELECT count(*) AS n FROM pg_indexes WHERE schemaname = 'public'
  AND indexname IN ('uq_seguimiento_pendiente', 'idx_seguimiento_pendiente_fecha',
                    'idx_seguimiento_evidencia_seguimiento')`;
const SQL_COLUMNAS_SEGUIMIENTO_POST = `SELECT count(*) AS n FROM information_schema.columns
  WHERE (table_name = 'seguimiento' AND column_name IN ('recordatorio_enviado_en', 'reporte_enviado_en'))
     OR (table_name = 'seguimiento_evidencia' AND column_name = 'origen')`;
const SQL_DONACIONES_NOTIF = `SELECT count(*) AS n FROM pg_indexes WHERE schemaname = 'public'
  AND indexname IN ('uq_notificacion_clave', 'idx_notificacion_usuario_fecha',
                    'idx_donacion_fundacion_fecha')`;
const SQL_COLUMNAS_NOTIF = `SELECT count(*) AS n FROM information_schema.columns
  WHERE table_name = 'notificacion' AND column_name IN ('entidad', 'entidad_id', 'clave')`;
const SQL_INDICES_REPORTES = `SELECT count(*) AS n FROM pg_indexes WHERE schemaname = 'public'
  AND indexname IN ('idx_solicitud_estado_fecha', 'idx_seguimiento_fecha', 'idx_adopcion_fecha')`;
const SQL_URL_CATALOGO = `SELECT count(*) AS n FROM information_schema.columns
  WHERE table_name = 'foto_mascota' AND column_name = 'url_catalogo'`;

async function rechaza(promesa: Promise<unknown>, patron: RegExp): Promise<void> {
  await expect(promesa).rejects.toThrow(patron);
}

describe('esquema inicial (V8)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    await recrearBaseDePrueba();
    ds = await crearDataSource();
  });

  afterAll(async () => {
    await ds.destroy();
    await borrarBaseDePrueba();
  });

  it('up crea 16 tablas y los enums; down los elimina; up de nuevo funciona', async () => {
    await ds.runMigrations();
    expect(await contar(ds, SQL_TABLAS_APP)).toBe(16);
    expect(await contar(ds, SQL_ENUMS)).toBe(12);

    expect(await contar(ds, SQL_INDICE_SOLICITUDES)).toBe(1);
    expect(await contar(ds, SQL_SEGUIMIENTO_POST)).toBe(3);
    expect(await contar(ds, SQL_COLUMNAS_SEGUIMIENTO_POST)).toBe(3);
    expect(await contar(ds, SQL_DONACIONES_NOTIF)).toBe(3);
    expect(await contar(ds, SQL_COLUMNAS_NOTIF)).toBe(3);
    expect(await contar(ds, SQL_INDICES_REPORTES)).toBe(3);

    // IndicesReportes se revierte sola: solo quita sus 3 índices.
    await ds.undoLastMigration();
    expect(await contar(ds, SQL_INDICES_REPORTES)).toBe(0);
    expect(await contar(ds, SQL_DONACIONES_NOTIF)).toBe(3);

    // DonacionesNotificaciones se revierte sola: columnas e índices, sin tocar lo anterior.
    await ds.undoLastMigration();
    expect(await contar(ds, SQL_DONACIONES_NOTIF)).toBe(0);
    expect(await contar(ds, SQL_COLUMNAS_NOTIF)).toBe(0);
    expect(await contar(ds, SQL_SEGUIMIENTO_POST)).toBe(3);

    // SeguimientoPostAdopcion se revierte sola: columnas, índices y el enum nativo `origen_evidencia`.
    await ds.undoLastMigration();
    expect(await contar(ds, SQL_SEGUIMIENTO_POST)).toBe(0);
    expect(await contar(ds, SQL_COLUMNAS_SEGUIMIENTO_POST)).toBe(0);
    expect(await contar(ds, SQL_ENUMS)).toBe(11);
    expect(await contar(ds, SQL_INDICE_SOLICITUDES)).toBe(1);

    // IndiceSolicitudesAdoptante se revierte sola y deja lo anterior intacto.
    await ds.undoLastMigration();
    expect(await contar(ds, SQL_INDICE_SOLICITUDES)).toBe(0);
    expect(await contar(ds, SQL_INDICES_CATALOGO)).toBe(3);

    // CatalogoMascotas se revierte sola y deja el esquema inicial intacto.
    await ds.undoLastMigration();
    expect(await contar(ds, SQL_TABLAS_APP)).toBe(16);
    expect(await contar(ds, SQL_INDICES_CATALOGO)).toBe(0);
    expect(await contar(ds, SQL_URL_CATALOGO)).toBe(0);

    await ds.undoLastMigration();
    expect(await contar(ds, SQL_TABLAS_APP)).toBe(0);
    expect(await contar(ds, SQL_ENUMS)).toBe(0);

    await ds.runMigrations();
    expect(await contar(ds, SQL_TABLAS_APP)).toBe(16);
    expect(await contar(ds, SQL_INDICES_CATALOGO)).toBe(3);
    expect(await contar(ds, SQL_URL_CATALOGO)).toBe(1);
    expect(await contar(ds, SQL_INDICE_SOLICITUDES)).toBe(1);
    expect(await contar(ds, SQL_SEGUIMIENTO_POST)).toBe(3);
    expect(await contar(ds, SQL_DONACIONES_NOTIF)).toBe(3);
    expect(await contar(ds, SQL_COLUMNAS_NOTIF)).toBe(3);
    expect(await contar(ds, SQL_ENUMS)).toBe(12);
    expect(await contar(ds, SQL_INDICES_REPORTES)).toBe(3);
    expect(
      await contar(ds, `SELECT count(*) AS n FROM pg_extension WHERE extname = 'unaccent'`),
    ).toBe(1);
  });

  it('las entidades coinciden con la migración (sin SQL pendiente)', async () => {
    const log = await ds.driver.createSchemaBuilder().log();
    expect(log.upQueries.map((q) => q.query)).toEqual([]);
  });

  describe('restricciones', () => {
    let fundacionId: number;
    let razaId: number;
    let adoptanteId: number;

    const mascota = (nombre: string, edad = 12) =>
      ds.query(
        `INSERT INTO mascota (fundacion_id, raza_id, nombre, sexo, edad_meses, tamano, estado_salud)
         VALUES ($1, $2, $3, 'macho', $4, 'pequeño', 'Sano') RETURNING id`,
        [fundacionId, razaId, nombre, edad],
      ) as Promise<{ id: number }[]>;

    beforeAll(async () => {
      await ds.query(`INSERT INTO rol (nombre) VALUES ('fundacion'), ('adoptante')`);
      await ds.query(`INSERT INTO usuario (rol_id, email, contrasena, telefono)
        SELECT id, nombre || '@x.co', 'h', '1' FROM rol`);
      const [u1] = await ds.query(`SELECT id FROM usuario WHERE email = 'fundacion@x.co'`);
      const [u2] = await ds.query(`SELECT id FROM usuario WHERE email = 'adoptante@x.co'`);
      [{ id: fundacionId }] = await ds.query(
        `INSERT INTO fundacion (usuario_id, nombre, nit, direccion, ciudad, documento_url)
         VALUES ($1, 'F', '1', 'd', 'Bogotá', 'u') RETURNING id`,
        [u1.id],
      );
      await ds.query(`INSERT INTO especie (nombre) VALUES ('perro')`);
      [{ id: razaId }] = await ds.query(
        `INSERT INTO raza (especie_id, nombre) SELECT id, 'Mestizo' FROM especie RETURNING id`,
      );
      [{ id: adoptanteId }] = await ds.query(
        `INSERT INTO adoptante (usuario_id, primer_nombre, primer_apellido, tipo_documento,
           numero_documento, fecha_nacimiento, direccion, ciudad)
         VALUES ($1, 'A', 'B', 'CC', '123', '1990-01-01', 'd', 'Bogotá') RETURNING id`,
        [u2.id],
      );
    });

    it('rechaza edad_meses negativa y monto negativo', async () => {
      await rechaza(mascota('Neg', -1), /ck_mascota_edad_meses/);
      await rechaza(
        ds.query(`INSERT INTO donacion (fundacion_id, tipo, monto) VALUES ($1, 'economica', -1)`, [
          fundacionId,
        ]),
        /ck_donacion_monto/,
      );
    });

    it('rechaza una segunda solicitud pendiente pero permite otra no pendiente', async () => {
      const [{ id: mascotaId }] = await mascota('Sol');
      const insertar = (estado: string) =>
        ds.query(
          `INSERT INTO solicitud_adopcion (adoptante_id, mascota_id, motivo, tipo_vivienda,
             tiene_otras_mascotas, formulario_url, estado)
           VALUES ($1, $2, 'm', 'casa', false, 'u', $3)`,
          [adoptanteId, mascotaId, estado],
        );
      await insertar('pendiente');
      await rechaza(insertar('pendiente'), /uq_solicitud_pendiente/);
      await insertar('rechazada');
      await insertar('rechazada');
    });

    it('rechaza una segunda foto principal y borra fotos en cascada', async () => {
      const [{ id: mascotaId }] = await mascota('Foto');
      const foto = (principal: boolean) =>
        ds.query(
          `INSERT INTO foto_mascota (mascota_id, url, url_catalogo, es_principal) VALUES ($1, 'u', 'c', $2)`,
          [mascotaId, principal],
        );
      await foto(true);
      await foto(false);
      await rechaza(foto(true), /uq_foto_principal/);
      await ds.query(`DELETE FROM mascota WHERE id = $1`, [mascotaId]);
      expect(
        await contar(ds, `SELECT count(*) AS n FROM foto_mascota WHERE mascota_id = ${mascotaId}`),
      ).toBe(0);
    });

    it('no cascadea otras relaciones: borrar una mascota con solicitudes falla', async () => {
      const [{ id: mascotaId }] = await mascota('Ref');
      await ds.query(
        `INSERT INTO solicitud_adopcion (adoptante_id, mascota_id, motivo, tipo_vivienda,
           tiene_otras_mascotas, formulario_url) VALUES ($1, $2, 'm', 'casa', false, 'u')`,
        [adoptanteId, mascotaId],
      );
      await rechaza(ds.query(`DELETE FROM mascota WHERE id = $1`, [mascotaId]), /fk_solicitud/);
    });

    it('admite los estados de B-32: adopcion revocada y seguimiento cancelado', async () => {
      const [{ id: mascotaId }] = await mascota('B32');
      const [{ id: solicitudId }] = await ds.query(
        `INSERT INTO solicitud_adopcion (adoptante_id, mascota_id, motivo, tipo_vivienda,
           tiene_otras_mascotas, formulario_url, estado)
         VALUES ($1, $2, 'm', 'casa', false, 'u', 'aprobada') RETURNING id`,
        [adoptanteId, mascotaId],
      );
      const [{ id: adopcionId }] = await ds.query(
        `INSERT INTO adopcion (solicitud_id, fecha_entrega, estado, motivo_cierre, fecha_cierre)
         VALUES ($1, '2026-01-01', 'revocada', 'incumplimiento', now()) RETURNING id`,
        [solicitudId],
      );
      await ds.query(
        `INSERT INTO seguimiento (adopcion_id, tipo, fecha_programada, estado)
         VALUES ($1, 'visita', '2026-02-01', 'cancelado')`,
        [adopcionId],
      );
      await ds.query(`UPDATE adopcion SET estado = 'finalizada' WHERE id = $1`, [adopcionId]);
    });

    it('permite un solo seguimiento pendiente por adopción, tipo y fecha', async () => {
      const [{ id: mascotaId }] = await mascota('Seg');
      const [{ id: solicitudId }] = await ds.query(
        `INSERT INTO solicitud_adopcion (adoptante_id, mascota_id, motivo, tipo_vivienda,
           tiene_otras_mascotas, formulario_url, estado)
         VALUES ($1, $2, 'm', 'casa', false, 'u', 'aprobada') RETURNING id`,
        [adoptanteId, mascotaId],
      );
      const [{ id: adopcionId }] = await ds.query(
        `INSERT INTO adopcion (solicitud_id, fecha_entrega) VALUES ($1, '2026-01-01') RETURNING id`,
        [solicitudId],
      );
      const insertar = (tipo: string, fecha: string, estado: string) =>
        ds.query(
          `INSERT INTO seguimiento (adopcion_id, tipo, fecha_programada, estado)
           VALUES ($1, $2, $3, $4)`,
          [adopcionId, tipo, fecha, estado],
        );
      await insertar('visita', '2026-02-01', 'programado');
      await rechaza(insertar('visita', '2026-02-01', 'programado'), /uq_seguimiento_pendiente/);
      await rechaza(insertar('visita', '2026-02-01', 'vencido'), /uq_seguimiento_pendiente/);
      await insertar('reporte', '2026-02-01', 'programado');
      await insertar('visita', '2026-02-02', 'programado');
      // Los terminales no cuentan: se puede repetir la fecha de uno cancelado o realizado.
      await insertar('visita', '2026-02-01', 'cancelado');
      await insertar('visita', '2026-02-01', 'realizado');
      const [{ id }] = await ds.query(
        `INSERT INTO seguimiento_evidencia (seguimiento_id, url)
         SELECT id, 'k' FROM seguimiento LIMIT 1 RETURNING id`,
      );
      const [{ origen }] = await ds.query(
        `SELECT origen FROM seguimiento_evidencia WHERE id = $1`,
        [id],
      );
      expect(origen).toBe('fundacion');
      await rechaza(
        ds.query(`UPDATE seguimiento_evidencia SET origen = 'otro' WHERE id = $1`, [id]),
        /origen_evidencia/,
      );
    });

    it('notificacion: la clave es única por destinatario solo cuando existe', async () => {
      const [{ id: usuarioId }] = await ds.query(`SELECT id FROM usuario LIMIT 1`);
      const [{ id: otroId }] = await ds.query(`SELECT id FROM usuario OFFSET 1 LIMIT 1`);
      const insertar = (usuario: number, clave: string | null) =>
        ds.query(
          `INSERT INTO notificacion (usuario_id, tipo, titulo, mensaje, clave)
           VALUES ($1, 'solicitud', 't', 'm', $2)`,
          [usuario, clave],
        );
      await insertar(usuarioId, 'adoption.approved:1');
      await rechaza(insertar(usuarioId, 'adoption.approved:1'), /uq_notificacion_clave/);
      await insertar(otroId, 'adoption.approved:1');
      await insertar(usuarioId, null);
      await insertar(usuarioId, null);
    });

    it('mascota no tiene columna de ciudad', async () => {
      expect(
        await contar(
          ds,
          `SELECT count(*) AS n FROM information_schema.columns
           WHERE table_name = 'mascota' AND column_name = 'ciudad'`,
        ),
      ).toBe(0);
    });
  });
});
