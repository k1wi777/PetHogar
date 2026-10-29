import { aResumenDto } from '../seguimientos/seguimientos.mapeo';
import type { AdopcionDeAdoptante, AdopcionDeFundacion } from './adopciones.types';
import type { AdopcionAdoptanteDto, AdopcionFundacionDto } from './dto/respuestas.dto';

/** Mapeo explícito de salida: el acta es un enlace y los seguimientos, un resumen sin datos sensibles. */
export function aAdopcionAdoptanteDto(
  a: AdopcionDeAdoptante,
  rutaActa: string,
): AdopcionAdoptanteDto {
  return {
    id: a.id,
    fechaEntrega: a.fechaEntrega,
    estado: a.estado,
    solicitudId: a.solicitudId,
    mascota: { id: a.mascota.id, nombre: a.mascota.nombre },
    acta: a.tieneActa ? { url: `${rutaActa}/${a.id}/acta` } : null,
    motivoCierre: a.motivoCierre,
    fechaCierre: a.fechaCierre,
    seguimientos: a.seguimientos.map(aResumenDto),
    fundacion: { nombre: a.fundacion.nombre, ciudad: a.fundacion.ciudad },
  };
}

export function aAdopcionFundacionDto(
  a: AdopcionDeFundacion,
  rutaActa: string,
): AdopcionFundacionDto {
  return {
    id: a.id,
    fechaEntrega: a.fechaEntrega,
    estado: a.estado,
    solicitudId: a.solicitudId,
    mascota: { id: a.mascota.id, nombre: a.mascota.nombre },
    acta: a.tieneActa ? { url: `${rutaActa}/${a.id}/acta` } : null,
    motivoCierre: a.motivoCierre,
    fechaCierre: a.fechaCierre,
    seguimientos: a.seguimientos.map(aResumenDto),
    adoptante: {
      nombreCompleto: a.adoptante.nombreCompleto,
      email: a.adoptante.email,
      telefono: a.adoptante.telefono,
      ciudad: a.adoptante.ciudad,
    },
  };
}

export const RUTA_ACTA_ADOPTANTE = '/api/mis-adopciones';
export const RUTA_ACTA_FUNDACION = '/api/fundacion/adopciones';
