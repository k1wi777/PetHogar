import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { SolicitudAdopcion } from './entities/solicitud-adopcion.entity';
import { EstadoSolicitud } from './entities/solicitud-adopcion.enum';
import type {
  DatosNuevaSolicitud,
  FiltroSolicitudesAdoptante,
  FiltroSolicitudesFundacion,
  SolicitudDecidida,
  SolicitudDetalleAdoptante,
  SolicitudDetalleFundacion,
  SolicitudResumenAdoptante,
  SolicitudResumenFundacion,
} from './solicitudes.types';

/** Propiedad de la fundación: la solicitud es de una mascota suya, comprobado en la misma sentencia. */
const MASCOTA_DE_FUNDACION = `"mascota_id" IN (SELECT "id" FROM "mascota" WHERE "fundacion_id" = :fundacionId)`;

const RETORNO_DECIDIDA = `"id", "mascota_id" AS "mascotaId", "adoptante_id" AS "adoptanteId"`;

interface FilaCabecera {
  id: number;
  fechaSolicitud: Date;
  estado: EstadoSolicitud;
  mascotaId: number;
  mascotaNombre: string;
}

interface FilaDatos extends FilaCabecera {
  motivo: string;
  tipoVivienda: string;
  tieneOtrasMascotas: boolean;
  observacion: string | null;
  fechaRespuesta: Date | null;
}

type FilaAdoptante = FilaCabecera & { fundacionNombre: string };
type FilaDetalleAdoptante = FilaDatos & { fundacionNombre: string };
type FilaFundacion = FilaCabecera & { adoptanteNombre: string };
type FilaDetalleFundacion = FilaDatos & {
  adoptanteNombre: string;
  adoptanteEmail: string;
  adoptanteTelefono: string;
  adoptanteCiudad: string;
};

const COLUMNAS_CABECERA = [
  's."id" AS "id"',
  's."fecha_solicitud" AS "fechaSolicitud"',
  's."estado" AS "estado"',
  'm."id" AS "mascotaId"',
  'm."nombre" AS "mascotaNombre"',
];
const COLUMNAS_DATOS = [
  ...COLUMNAS_CABECERA,
  's."motivo" AS "motivo"',
  's."tipo_vivienda" AS "tipoVivienda"',
  's."tiene_otras_mascotas" AS "tieneOtrasMascotas"',
  's."observacion" AS "observacion"',
  's."fecha_respuesta" AS "fechaRespuesta"',
];
const COLUMNAS_ADOPTANTE_RESUMEN = [...COLUMNAS_CABECERA, 'f."nombre" AS "fundacionNombre"'];
const COLUMNAS_ADOPTANTE_DETALLE = [...COLUMNAS_DATOS, 'f."nombre" AS "fundacionNombre"'];
// Solo los datos que la fundación necesita para valorar y contactar: nunca documento,
// fecha de nacimiento ni dirección.
const NOMBRE_ADOPTANTE = `concat_ws(' ', a."primer_nombre", a."segundo_nombre", a."primer_apellido", a."segundo_apellido")`;
const COLUMNAS_FUNDACION_RESUMEN = [
  ...COLUMNAS_CABECERA,
  `${NOMBRE_ADOPTANTE} AS "adoptanteNombre"`,
];
const COLUMNAS_FUNDACION_DETALLE = [
  ...COLUMNAS_DATOS,
  `${NOMBRE_ADOPTANTE} AS "adoptanteNombre"`,
  'u."email" AS "adoptanteEmail"',
  'u."telefono" AS "adoptanteTelefono"',
  'a."ciudad" AS "adoptanteCiudad"',
];

const aCabecera = (f: FilaCabecera) => ({
  id: f.id,
  fechaSolicitud: f.fechaSolicitud,
  estado: f.estado,
  mascota: { id: f.mascotaId, nombre: f.mascotaNombre },
});

const aDatos = (f: FilaDatos) => ({
  ...aCabecera(f),
  motivo: f.motivo,
  tipoVivienda: f.tipoVivienda,
  tieneOtrasMascotas: f.tieneOtrasMascotas,
  observacion: f.observacion,
  fechaRespuesta: f.fechaRespuesta,
});

/**
 * Dueño de `solicitud_adopcion`. Las lecturas hacen joins de solo lectura por las relaciones de
 * la entidad (excepción documentada en architecture.md); las escrituras de otras tablas nunca
 * pasan por aquí. Las operaciones con `manager` participan en la transacción de quien orquesta.
 */
@Injectable()
export class SolicitudesRepository {
  constructor(
    @InjectRepository(SolicitudAdopcion)
    private readonly solicitudes: Repository<SolicitudAdopcion>,
  ) {}

  private repo(manager?: EntityManager): Repository<SolicitudAdopcion> {
    return manager?.getRepository(SolicitudAdopcion) ?? this.solicitudes;
  }

  /** `estado`, `fecha_solicitud` y la respuesta los asigna la base de datos. */
  async insertar(datos: DatosNuevaSolicitud): Promise<number> {
    const resultado = await this.solicitudes.insert({
      adoptanteId: datos.adoptanteId,
      mascotaId: datos.mascotaId,
      motivo: datos.motivo,
      tipoVivienda: datos.tipoVivienda,
      tieneOtrasMascotas: datos.tieneOtrasMascotas,
      formularioUrl: datos.formularioClave,
    });
    return (resultado.identifiers[0] as { id: number }).id;
  }

  existePendiente(adoptanteId: number, mascotaId: number): Promise<boolean> {
    return this.solicitudes.exists({
      where: { adoptanteId, mascotaId, estado: EstadoSolicitud.Pendiente },
    });
  }

  // ---- Adoptante -------------------------------------------------------------------------

  private deAdoptante(adoptanteId: number): SelectQueryBuilder<SolicitudAdopcion> {
    return this.solicitudes
      .createQueryBuilder('s')
      .innerJoin('s.mascota', 'm')
      .innerJoin('m.fundacion', 'f')
      .where('s."adoptante_id" = :adoptanteId', { adoptanteId });
  }

  async listarDeAdoptante(
    adoptanteId: number,
    filtro: FiltroSolicitudesAdoptante,
    skip: number,
    take: number,
  ): Promise<[SolicitudResumenAdoptante[], number]> {
    const filtrada = (): SelectQueryBuilder<SolicitudAdopcion> => {
      const qb = this.deAdoptante(adoptanteId);
      if (filtro.estado) qb.andWhere('s."estado" = :estado', { estado: filtro.estado });
      return qb;
    };
    const total = await filtrada().getCount();
    // Desempate por clave primaria: la paginación es estable aunque coincida la fecha.
    const filas = await filtrada()
      .select(COLUMNAS_ADOPTANTE_RESUMEN)
      .orderBy('s."fecha_solicitud"', 'DESC')
      .addOrderBy('s."id"', 'DESC')
      .offset(skip)
      .limit(take)
      .getRawMany<FilaAdoptante>();
    return [
      filas.map((f) => ({ ...aCabecera(f), fundacion: { nombre: f.fundacionNombre } })),
      total,
    ];
  }

  async obtenerDeAdoptante(
    id: number,
    adoptanteId: number,
  ): Promise<SolicitudDetalleAdoptante | null> {
    const fila = await this.deAdoptante(adoptanteId)
      .select(COLUMNAS_ADOPTANTE_DETALLE)
      .andWhere('s."id" = :id', { id })
      .getRawOne<FilaDetalleAdoptante>();
    return fila ? { ...aDatos(fila), fundacion: { nombre: fila.fundacionNombre } } : null;
  }

  async buscarEstadoDeAdoptante(id: number, adoptanteId: number): Promise<EstadoSolicitud | null> {
    const fila = await this.solicitudes.findOne({
      where: { id, adoptanteId },
      select: { id: true, estado: true },
    });
    return fila?.estado ?? null;
  }

  /** Cancela solo si es del adoptante y sigue pendiente; de dos cambios simultáneos gana uno. */
  async cancelar(id: number, adoptanteId: number): Promise<boolean> {
    const resultado = await this.solicitudes
      .createQueryBuilder()
      .update(SolicitudAdopcion)
      .set({ estado: EstadoSolicitud.Cancelada, fechaRespuesta: () => 'now()' })
      .where('"id" = :id AND "adoptante_id" = :adoptanteId AND "estado" = :pendiente', {
        id,
        adoptanteId,
        pendiente: EstadoSolicitud.Pendiente,
      })
      .execute();
    return (resultado.affected ?? 0) > 0;
  }

  async claveFormularioDeAdoptante(id: number, adoptanteId: number): Promise<string | null> {
    const fila = await this.solicitudes.findOne({
      where: { id, adoptanteId },
      select: { id: true, formularioUrl: true },
    });
    return fila?.formularioUrl ?? null;
  }

  // ---- Fundación (propiedad vía mascota) ---------------------------------------------------

  private deFundacion(fundacionId: number): SelectQueryBuilder<SolicitudAdopcion> {
    return this.solicitudes
      .createQueryBuilder('s')
      .innerJoin('s.mascota', 'm')
      .innerJoin('s.adoptante', 'a')
      .innerJoin('a.usuario', 'u')
      .where('m."fundacion_id" = :fundacionId', { fundacionId });
  }

  async listarDeFundacion(
    fundacionId: number,
    filtro: FiltroSolicitudesFundacion,
    skip: number,
    take: number,
  ): Promise<[SolicitudResumenFundacion[], number]> {
    const filtrada = (): SelectQueryBuilder<SolicitudAdopcion> => {
      const qb = this.deFundacion(fundacionId);
      if (filtro.estado) qb.andWhere('s."estado" = :estado', { estado: filtro.estado });
      if (filtro.mascotaId !== undefined) {
        qb.andWhere('s."mascota_id" = :mascotaId', { mascotaId: filtro.mascotaId });
      }
      return qb;
    };
    const total = await filtrada().getCount();
    const filas = await filtrada()
      .select(COLUMNAS_FUNDACION_RESUMEN)
      .orderBy('s."fecha_solicitud"', 'DESC')
      .addOrderBy('s."id"', 'DESC')
      .offset(skip)
      .limit(take)
      .getRawMany<FilaFundacion>();
    return [
      filas.map((f) => ({ ...aCabecera(f), adoptante: { nombreCompleto: f.adoptanteNombre } })),
      total,
    ];
  }

  async obtenerDeFundacion(
    id: number,
    fundacionId: number,
  ): Promise<SolicitudDetalleFundacion | null> {
    const fila = await this.deFundacion(fundacionId)
      .select(COLUMNAS_FUNDACION_DETALLE)
      .andWhere('s."id" = :id', { id })
      .getRawOne<FilaDetalleFundacion>();
    return fila
      ? {
          ...aDatos(fila),
          adoptante: {
            nombreCompleto: fila.adoptanteNombre,
            email: fila.adoptanteEmail,
            telefono: fila.adoptanteTelefono,
            ciudad: fila.adoptanteCiudad,
          },
        }
      : null;
  }

  async buscarEstadoDeFundacion(
    id: number,
    fundacionId: number,
    manager?: EntityManager,
  ): Promise<EstadoSolicitud | null> {
    const fila = await this.repo(manager)
      .createQueryBuilder('s')
      .select('s."estado"', 'estado')
      .where(`s."id" = :id AND s.${MASCOTA_DE_FUNDACION}`, { id, fundacionId })
      .getRawOne<{ estado: EstadoSolicitud }>();
    return fila?.estado ?? null;
  }

  async claveFormularioDeFundacion(id: number, fundacionId: number): Promise<string | null> {
    const fila = await this.solicitudes
      .createQueryBuilder('s')
      .select('s."formulario_url"', 'clave')
      .where(`s."id" = :id AND s.${MASCOTA_DE_FUNDACION}`, { id, fundacionId })
      .getRawOne<{ clave: string }>();
    return fila?.clave ?? null;
  }

  // ---- Decisión: UPDATE condicionados al estado `pendiente` -----------------------------------

  /** Pasa a `rechazada`/`aprobada` solo si sigue `pendiente` y es de una mascota de la fundación. */
  async decidir(
    id: number,
    fundacionId: number,
    estado: EstadoSolicitud.Aprobada | EstadoSolicitud.Rechazada,
    observacion: string | null,
    manager?: EntityManager,
  ): Promise<SolicitudDecidida | null> {
    const resultado = await this.repo(manager)
      .createQueryBuilder()
      .update(SolicitudAdopcion)
      .set({ estado, observacion, fechaRespuesta: () => 'now()' })
      .where(`"id" = :id AND "estado" = :pendiente AND ${MASCOTA_DE_FUNDACION}`, {
        id,
        fundacionId,
        pendiente: EstadoSolicitud.Pendiente,
      })
      .returning(RETORNO_DECIDIDA)
      .execute();
    return (resultado.raw as SolicitudDecidida[])[0] ?? null;
  }

  /** Rechaza todas las pendientes de la mascota y devuelve las afectadas (para sus eventos). */
  async rechazarPendientesDeMascota(
    mascotaId: number,
    observacion: string,
    manager: EntityManager,
  ): Promise<SolicitudDecidida[]> {
    const resultado = await manager
      .getRepository(SolicitudAdopcion)
      .createQueryBuilder()
      .update(SolicitudAdopcion)
      .set({
        estado: EstadoSolicitud.Rechazada,
        observacion,
        fechaRespuesta: () => 'now()',
      })
      .where('"mascota_id" = :mascotaId AND "estado" = :pendiente', {
        mascotaId,
        pendiente: EstadoSolicitud.Pendiente,
      })
      .returning(RETORNO_DECIDIDA)
      .execute();
    return resultado.raw as SolicitudDecidida[];
  }
}
