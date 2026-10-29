import type { AdopcionDeAdoptante, AdopcionDeFundacion } from './adopciones.types';
import type { AdopcionAdoptanteDto, AdopcionFundacionDto } from './dto/respuestas.dto';

/** `seguimientos` es siempre `[]` hasta la Fase 4; la clave existe para no cambiar el contrato. */
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
    seguimientos: [],
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
    seguimientos: [],
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
