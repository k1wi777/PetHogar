import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { Adopcion } from './entities/adopcion.entity';
import { EstadoAdopcion } from './entities/adopcion.enum';
import type {
  AdopcionDeAdoptante,
  AdopcionDeFundacion,
  AdopcionParaActa,
  AdopcionParaCierre,
  FiltroAdopciones,
  SinSeguimientos,
} from './adopciones.types';

interface FilaBase {
  id: number;
  fechaEntrega: string;
  estado: EstadoAdopcion;
  solicitudId: number;
  mascotaId: number;
  mascotaNombre: string;
  tieneActa: boolean;
  motivoCierre: string | null;
  fechaCierre: Date | null;
}
type FilaAdoptante = FilaBase & { fundacionNombre: string; fundacionCiudad: string };
type FilaFundacion = FilaBase & {
  adoptanteNombre: string;
  adoptanteEmail: string;
  adoptanteTelefono: string;
  adoptanteCiudad: string;
};

const COLUMNAS_BASE = [
  'a."id" AS "id"',
  `to_char(a."fecha_entrega", 'YYYY-MM-DD') AS "fechaEntrega"`,
  'a."estado" AS "estado"',
  'a."solicitud_id" AS "solicitudId"',
  'm."id" AS "mascotaId"',
  'm."nombre" AS "mascotaNombre"',
  // Solo se informa de que hay acta: la clave de almacenamiento nunca sale del repository.
  'a."acta_url" IS NOT NULL AS "tieneActa"',
  'a."motivo_cierre" AS "motivoCierre"',
  'a."fecha_cierre" AS "fechaCierre"',
];
const COLUMNAS_ADOPTANTE = [
  ...COLUMNAS_BASE,
  'f."nombre" AS "fundacionNombre"',
  'f."ciudad" AS "fundacionCiudad"',
];
// Solo los datos mínimos del adoptante: nunca documento, fecha de nacimiento ni dirección.
const COLUMNAS_FUNDACION = [
  ...COLUMNAS_BASE,
  `concat_ws(' ', ad."primer_nombre", ad."segundo_nombre", ad."primer_apellido", ad."segundo_apellido") AS "adoptanteNombre"`,
  'u."email" AS "adoptanteEmail"',
  'u."telefono" AS "adoptanteTelefono"',
  'ad."ciudad" AS "adoptanteCiudad"',
];

const aBase = (f: FilaBase) => ({
  id: f.id,
  fechaEntrega: f.fechaEntrega,
  estado: f.estado,
  solicitudId: f.solicitudId,
  mascota: { id: f.mascotaId, nombre: f.mascotaNombre },
  tieneActa: f.tieneActa,
  motivoCierre: f.motivoCierre,
  fechaCierre: f.fechaCierre,
});

const aAdoptante = (f: FilaAdoptante): SinSeguimientos<AdopcionDeAdoptante> => ({
  ...aBase(f),
  fundacion: { nombre: f.fundacionNombre, ciudad: f.fundacionCiudad },
});

const aFundacion = (f: FilaFundacion): SinSeguimientos<AdopcionDeFundacion> => ({
  ...aBase(f),
  adoptante: {
    nombreCompleto: f.adoptanteNombre,
    email: f.adoptanteEmail,
    telefono: f.adoptanteTelefono,
    ciudad: f.adoptanteCiudad,
  },
});

/**
 * Dueño de `adopcion`. Las lecturas hacen joins de solo lectura (`adopcion → solicitud →
 * mascota → fundacion` y `adoptante → usuario`) con la propiedad del rol en la misma consulta;
 * la excepción está documentada en architecture.md. No inyecta ningún repository ajeno.
 */
@Injectable()
export class AdopcionesRepository {
  constructor(@InjectRepository(Adopcion) private readonly adopciones: Repository<Adopcion>) {}

  enTransaccion<T>(trabajo: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.adopciones.manager.transaction(trabajo);
  }

  /** El estado `activa` lo fija la columna. */
  async insertar(
    solicitudId: number,
    fechaEntrega: string,
    manager: EntityManager,
  ): Promise<number> {
    const resultado = await manager.getRepository(Adopcion).insert({ solicitudId, fechaEntrega });
    return (resultado.identifiers[0] as { id: number }).id;
  }

  private deAdoptante(adoptanteId: number): SelectQueryBuilder<Adopcion> {
    return this.adopciones
      .createQueryBuilder('a')
      .innerJoin('a.solicitud', 's')
      .innerJoin('s.mascota', 'm')
      .innerJoin('m.fundacion', 'f')
      .where('s."adoptante_id" = :adoptanteId', { adoptanteId });
  }

  private deFundacion(fundacionId: number): SelectQueryBuilder<Adopcion> {
    return this.adopciones
      .createQueryBuilder('a')
      .innerJoin('a.solicitud', 's')
      .innerJoin('s.mascota', 'm')
      .innerJoin('s.adoptante', 'ad')
      .innerJoin('ad.usuario', 'u')
      .where('m."fundacion_id" = :fundacionId', { fundacionId });
  }

  async listarDeAdoptante(
    adoptanteId: number,
    filtro: FiltroAdopciones,
    skip: number,
    take: number,
  ): Promise<[SinSeguimientos<AdopcionDeAdoptante>[], number]> {
    const filtrada = (): SelectQueryBuilder<Adopcion> => {
      const qb = this.deAdoptante(adoptanteId);
      if (filtro.estado) qb.andWhere('a."estado" = :estado', { estado: filtro.estado });
      return qb;
    };
    const total = await filtrada().getCount();
    const filas = await filtrada()
      .select(COLUMNAS_ADOPTANTE)
      .orderBy('a."fecha_entrega"', 'DESC')
      .addOrderBy('a."id"', 'DESC')
      .offset(skip)
      .limit(take)
      .getRawMany<FilaAdoptante>();
    return [filas.map(aAdoptante), total];
  }

  async listarDeFundacion(
    fundacionId: number,
    filtro: FiltroAdopciones,
    skip: number,
    take: number,
  ): Promise<[SinSeguimientos<AdopcionDeFundacion>[], number]> {
    const filtrada = (): SelectQueryBuilder<Adopcion> => {
      const qb = this.deFundacion(fundacionId);
      if (filtro.estado) qb.andWhere('a."estado" = :estado', { estado: filtro.estado });
      return qb;
    };
    const total = await filtrada().getCount();
    const filas = await filtrada()
      .select(COLUMNAS_FUNDACION)
      .orderBy('a."fecha_entrega"', 'DESC')
      .addOrderBy('a."id"', 'DESC')
      .offset(skip)
      .limit(take)
      .getRawMany<FilaFundacion>();
    return [filas.map(aFundacion), total];
  }

  async obtenerDeFundacion(
    id: number,
    fundacionId: number,
  ): Promise<SinSeguimientos<AdopcionDeFundacion> | null> {
    const fila = await this.deFundacion(fundacionId)
      .select(COLUMNAS_FUNDACION)
      .andWhere('a."id" = :id', { id })
      .getRawOne<FilaFundacion>();
    return fila ? aFundacion(fila) : null;
  }

  async buscarEstadoDeFundacion(id: number, fundacionId: number): Promise<EstadoAdopcion | null> {
    const fila = await this.deFundacion(fundacionId)
      .select('a."estado"', 'estado')
      .andWhere('a."id" = :id', { id })
      .getRawOne<{ estado: EstadoAdopcion }>();
    return fila?.estado ?? null;
  }

  /** Clave del acta con el filtro de propiedad del rol: `undefined` si la adopción no es suya. */
  async claveActaDeFundacion(id: number, fundacionId: number): Promise<string | null | undefined> {
    const fila = await this.deFundacion(fundacionId)
      .select('a."acta_url"', 'clave')
      .andWhere('a."id" = :id', { id })
      .getRawOne<{ clave: string | null }>();
    return fila ? fila.clave : undefined;
  }

  async claveActaDeAdoptante(id: number, adoptanteId: number): Promise<string | null | undefined> {
    const fila = await this.deAdoptante(adoptanteId)
      .select('a."acta_url"', 'clave')
      .andWhere('a."id" = :id', { id })
      .getRawOne<{ clave: string | null }>();
    return fila ? fila.clave : undefined;
  }

  /** Bloquea la adopción (con la propiedad por join) hasta el fin de la transacción. */
  async bloquearParaActa(
    manager: EntityManager,
    id: number,
    fundacionId: number,
  ): Promise<AdopcionParaActa | null> {
    const filas: { estado: EstadoAdopcion; actaClave: string | null }[] = await manager.query(
      `SELECT a."estado" AS "estado", a."acta_url" AS "actaClave"
         FROM "adopcion" a
         JOIN "solicitud_adopcion" s ON s."id" = a."solicitud_id"
         JOIN "mascota" m ON m."id" = s."mascota_id"
        WHERE a."id" = $1 AND m."fundacion_id" = $2
          FOR UPDATE OF a`,
      [id, fundacionId],
    );
    return filas[0] ?? null;
  }

  async actualizarActa(manager: EntityManager, id: number, clave: string): Promise<void> {
    await manager.getRepository(Adopcion).update({ id }, { actaUrl: clave });
  }

  /**
   * Bloquea la adopción para cerrarla (`FOR UPDATE OF a`), con la propiedad por join en la misma
   * sentencia. Serializa el cierre contra «programar» (que toma `FOR SHARE`) y contra otro cierre.
   */
  async bloquearParaCierre(
    manager: EntityManager,
    id: number,
    fundacionId: number,
  ): Promise<AdopcionParaCierre | null> {
    const filas: AdopcionParaCierre[] = await manager.query(
      `SELECT a."id" AS "id", a."estado" AS "estado", s."mascota_id" AS "mascotaId",
            s."adoptante_id" AS "adoptanteId"
         FROM "adopcion" a
         JOIN "solicitud_adopcion" s ON s."id" = a."solicitud_id"
         JOIN "mascota" m ON m."id" = s."mascota_id"
        WHERE a."id" = $1 AND m."fundacion_id" = $2
          FOR UPDATE OF a`,
      [id, fundacionId],
    );
    return filas[0] ?? null;
  }

  /** `UPDATE` condicionado a `activa`: `false` si otro la cerró antes. */
  async cerrar(
    manager: EntityManager,
    id: number,
    estado: EstadoAdopcion.Finalizada | EstadoAdopcion.Revocada,
    motivo: string,
  ): Promise<boolean> {
    const resultado = await manager
      .getRepository(Adopcion)
      .createQueryBuilder()
      .update(Adopcion)
      .set({ estado, motivoCierre: motivo, fechaCierre: () => 'now()' })
      .where('"id" = :id AND "estado" = :activa', { id, activa: EstadoAdopcion.Activa })
      .execute();
    return (resultado.affected ?? 0) > 0;
  }
}
