import 'reflect-metadata';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { crearOpcionesTypeOrm } from '../../../database/typeorm.options';
import { Mascota } from '../entities/mascota.entity';
import { TamanoMascota } from '../entities/mascota.enum';
import { CatalogoMascotasRepository } from './catalogo-mascotas.repository';

// Sin base de datos: se construyen los metadatos y se captura el SQL en lugar de ejecutarlo.
describe('CatalogoMascotasRepository (SQL generado)', () => {
  let repo: CatalogoMascotasRepository;
  let capturado: { sql: string; parametros: unknown[] };

  beforeAll(async () => {
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
    repo = new CatalogoMascotasRepository(ds.getRepository(Mascota));
  });

  beforeEach(() => {
    const guardar = function (this: SelectQueryBuilder<Mascota>) {
      const [sql, parametros] = this.getQueryAndParameters();
      capturado = { sql, parametros };
      return Promise.resolve([] as never);
    };
    jest.spyOn(SelectQueryBuilder.prototype, 'getRawMany').mockImplementation(guardar as never);
    jest.spyOn(SelectQueryBuilder.prototype, 'getRawOne').mockImplementation(guardar as never);
    jest.spyOn(SelectQueryBuilder.prototype, 'getCount').mockImplementation(function (
      this: SelectQueryBuilder<Mascota>,
    ) {
      const [sql, parametros] = this.getQueryAndParameters();
      capturado = { sql, parametros };
      return Promise.resolve(0);
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('sin filtros: solo disponibles de fundaciones aprobadas, orden estable, foto principal por left join', async () => {
    await repo.listar({}, 20, 10);
    expect(capturado.sql).toContain('"m"."estado" = $1');
    expect(capturado.sql).toContain('"f"."estado_validacion" = $2');
    expect(capturado.sql).toMatch(/LEFT JOIN "foto_mascota" "fp" ON .*"es_principal" = true/);
    expect(capturado.sql).toMatch(
      /ORDER BY "m"\."fecha_publicacion" DESC, "m"\."id" DESC LIMIT 10 OFFSET 20/,
    );
    expect(capturado.parametros).toEqual(['disponible', 'aprobada']);
  });

  it('selecciona solo columnas concretas: nunca datos sensibles de la fundación', async () => {
    await repo.listar({}, 0, 12);
    expect(capturado.sql).not.toMatch(
      /"f"\."(nit|documento_url|direccion|logo|usuario_id|observacion_validacion)"/,
    );
    expect(capturado.sql).not.toMatch(/contrasena|"email"/);
    expect(capturado.sql).not.toMatch(/SELECT\s+"?m"?\.\*/);
  });

  it('enlaza todos los filtros como parámetros, incluida la ciudad con unaccent', async () => {
    const ciudad = "Bogotá'; DROP TABLE mascota; --%_";
    await repo.listar(
      {
        especieId: 2,
        tamano: TamanoMascota.Pequeno,
        edadMinMeses: 6,
        edadMaxMeses: 24,
        ciudad,
      },
      0,
      12,
    );
    expect(capturado.sql).toContain('"r"."especie_id" = $3');
    expect(capturado.sql).toContain('"m"."tamano" = $4');
    expect(capturado.sql).toContain('"m"."edad_meses" >= $5');
    expect(capturado.sql).toContain('"m"."edad_meses" <= $6');
    expect(capturado.sql).toContain('unaccent(lower("f"."ciudad")) = unaccent(lower($7))');
    expect(capturado.sql).not.toContain('DROP TABLE');
    expect(capturado.sql).not.toMatch(/\bLIKE\b/i);
    expect(capturado.parametros).toEqual(['disponible', 'aprobada', 2, 'pequeño', 6, 24, ciudad]);
  });

  it('el conteo usa las mismas condiciones sin el join de fotos', async () => {
    await repo.contar({ ciudad: 'Cali' });
    expect(capturado.sql).toContain('unaccent(lower("f"."ciudad"))');
    expect(capturado.sql).not.toContain('foto_mascota');
  });

  it('la ficha y la visibilidad exigen disponible + fundación aprobada + id', async () => {
    await repo.buscarFicha(5);
    expect(capturado.sql).toContain('"m"."estado" = $1');
    expect(capturado.sql).toContain('"f"."estado_validacion" = $2');
    expect(capturado.sql).toContain('"m"."id" = $3');
    expect(capturado.sql).not.toMatch(/"f"\."(nit|direccion|documento_url|logo|usuario_id)"/);
    await repo.existeVisible(5);
    expect(capturado.parametros).toEqual(['disponible', 'aprobada', 5]);
  });
});
