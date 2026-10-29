import type {
  SolicitudDetalleAdoptanteDto,
  SolicitudDetalleFundacionDto,
  SolicitudResumenAdoptanteDto,
  SolicitudResumenFundacionDto,
} from './dto/respuestas.dto';
import type {
  SolicitudDetalleAdoptante,
  SolicitudDetalleFundacion,
  SolicitudResumenAdoptante,
  SolicitudResumenFundacion,
} from './solicitudes.types';

/** Mapeo explícito de salida: nunca se propaga un objeto entero, y el enlace sustituye a la clave. */
export function aResumenAdoptanteDto(s: SolicitudResumenAdoptante): SolicitudResumenAdoptanteDto {
  return {
    id: s.id,
    fechaSolicitud: s.fechaSolicitud,
    estado: s.estado,
    mascota: { id: s.mascota.id, nombre: s.mascota.nombre },
    fundacion: { nombre: s.fundacion.nombre },
  };
}

export function aDetalleAdoptanteDto(s: SolicitudDetalleAdoptante): SolicitudDetalleAdoptanteDto {
  return {
    ...aResumenAdoptanteDto(s),
    motivo: s.motivo,
    tipoVivienda: s.tipoVivienda,
    tieneOtrasMascotas: s.tieneOtrasMascotas,
    observacion: s.observacion,
    fechaRespuesta: s.fechaRespuesta,
    formulario: { url: `/api/mis-solicitudes/${s.id}/formulario` },
  };
}

export function aResumenFundacionDto(s: SolicitudResumenFundacion): SolicitudResumenFundacionDto {
  return {
    id: s.id,
    fechaSolicitud: s.fechaSolicitud,
    estado: s.estado,
    mascota: { id: s.mascota.id, nombre: s.mascota.nombre },
    adoptante: { nombreCompleto: s.adoptante.nombreCompleto },
  };
}

export function aDetalleFundacionDto(s: SolicitudDetalleFundacion): SolicitudDetalleFundacionDto {
  return {
    id: s.id,
    fechaSolicitud: s.fechaSolicitud,
    estado: s.estado,
    mascota: { id: s.mascota.id, nombre: s.mascota.nombre },
    motivo: s.motivo,
    tipoVivienda: s.tipoVivienda,
    tieneOtrasMascotas: s.tieneOtrasMascotas,
    observacion: s.observacion,
    fechaRespuesta: s.fechaRespuesta,
    adoptante: {
      nombreCompleto: s.adoptante.nombreCompleto,
      email: s.adoptante.email,
      telefono: s.adoptante.telefono,
      ciudad: s.adoptante.ciudad,
    },
    formulario: { url: `/api/fundacion/solicitudes/${s.id}/formulario` },
  };
}
