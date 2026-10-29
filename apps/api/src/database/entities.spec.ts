import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { crearOpcionesTypeOrm } from './typeorm.options';

const TABLAS = [
  'adopcion',
  'adoptante',
  'donacion',
  'especie',
  'foto_mascota',
  'fundacion',
  'historial_medico',
  'mascota',
  'notificacion',
  'raza',
  'refresh_token',
  'rol',
  'seguimiento',
  'seguimiento_evidencia',
  'solicitud_adopcion',
  'usuario',
];

// Construye los metadatos sin abrir conexión: no requiere base de datos.
async function metadatos() {
  const ds = new DataSource(
    crearOpcionesTypeOrm({
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: 5432,
      DATABASE_USER: 'u',
      DATABASE_PASSWORD: 'p',
      DATABASE_NAME: 'd',
    }),
  );
  await (ds as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  return ds.entityMetadatas;
}

describe('metadatos de entidades', () => {
  it('define las 16 tablas esperadas', async () => {
    const nombres = (await metadatos()).map((m) => m.tableName).sort();
    expect(nombres).toEqual(TABLAS);
  });

  it('usa identity y columnas snake_case', async () => {
    for (const meta of await metadatos()) {
      const pk = meta.primaryColumns[0];
      expect(pk.databaseName).toBe('id');
      expect(pk.generationStrategy).toBe('identity');
      expect(pk.generatedIdentity).toBe('ALWAYS');
      for (const col of meta.columns) {
        expect(col.databaseName).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });

  it('declara los índices únicos parciales', async () => {
    const metas = await metadatos();
    const solicitud = metas.find((m) => m.tableName === 'solicitud_adopcion')!;
    const foto = metas.find((m) => m.tableName === 'foto_mascota')!;
    const pendiente = solicitud.indices.find((i) => i.name === 'uq_solicitud_pendiente')!;
    const principal = foto.indices.find((i) => i.name === 'uq_foto_principal')!;
    expect(pendiente.isUnique).toBe(true);
    expect(pendiente.where).toContain('pendiente');
    expect(principal.isUnique).toBe(true);
    expect(principal.where).toContain('es_principal');
  });

  it('no tiene ciudad en mascota (la ubicación sale de fundacion)', async () => {
    const metas = await metadatos();
    const mascota = metas.find((m) => m.tableName === 'mascota')!;
    const fundacion = metas.find((m) => m.tableName === 'fundacion')!;
    expect(mascota.columns.map((c) => c.databaseName)).not.toContain('ciudad');
    expect(fundacion.columns.map((c) => c.databaseName)).toContain('ciudad');
  });

  it('solo foto_mascota tiene borrado en cascada', async () => {
    for (const meta of await metadatos()) {
      for (const fk of meta.foreignKeys) {
        const esperado = meta.tableName === 'foto_mascota' ? 'CASCADE' : 'NO ACTION';
        expect(fk.onDelete).toBe(esperado);
      }
    }
  });
});
