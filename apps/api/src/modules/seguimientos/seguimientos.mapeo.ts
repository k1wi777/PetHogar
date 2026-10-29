import type {
  FotoSeguimientoDto,
  ReporteAdoptanteDto,
  ResumenSeguimientoDto,
  SeguimientoDetalleAdoptanteDto,
  SeguimientoDetalleFundacionDto,
  SeguimientoListaAdoptanteDto,
  SeguimientoListaFundacionDto,
} from './dto/respuestas.dto';
import type {
  FotoSeguimiento,
  ReporteAdoptante,
  ResumenSeguimiento,
  SeguimientoBase,
  SeguimientoDetalleAdoptante,
  SeguimientoDetalleFundacion,
  SeguimientoListaAdoptante,
  SeguimientoListaFundacion,
} from './seguimientos.types';

export const RUTA_FUNDACION = '/api/fundacion/seguimientos';
export const RUTA_ADOPTANTE = '/api/mis-seguimientos';

/**
 * Mapeo explícito de salida: se copia campo a campo (nunca se propaga un objeto entero) y cada
 * foto se presenta como un enlace de descarga autenticada en lugar de su clave de almacenamiento.
 */
function aBaseDto(s: SeguimientoBase) {
  return {
    id: s.id,
    adopcionId: s.adopcionId,
    tipo: s.tipo,
    fechaProgramada: s.fechaProgramada,
    fechaRealizada: s.fechaRealizada,
    estado: s.estado,
    vencido: s.vencido,
    tieneReporte: s.tieneReporte,
    mascota: { id: s.mascota.id, nombre: s.mascota.nombre },
  };
}

const aFotoDto = (ruta: string, seguimientoId: number, f: FotoSeguimiento): FotoSeguimientoDto => ({
  id: f.id,
  url: `${ruta}/${seguimientoId}/evidencias/${f.id}`,
});

const aReporteDto = (
  ruta: string,
  seguimientoId: number,
  r: ReporteAdoptante | null,
): ReporteAdoptanteDto | null =>
  r && {
    comentarios: r.comentarios,
    enviadoEn: r.enviadoEn,
    fotos: r.fotos.map((f) => aFotoDto(ruta, seguimientoId, f)),
  };

export function aListaFundacionDto(s: SeguimientoListaFundacion): SeguimientoListaFundacionDto {
  return { ...aBaseDto(s), adoptante: { nombreCompleto: s.adoptante.nombreCompleto } };
}

export function aListaAdoptanteDto(s: SeguimientoListaAdoptante): SeguimientoListaAdoptanteDto {
  return { ...aBaseDto(s), fundacion: { nombre: s.fundacion.nombre } };
}

export function aDetalleFundacionDto(
  s: SeguimientoDetalleFundacion,
): SeguimientoDetalleFundacionDto {
  return {
    ...aListaFundacionDto(s),
    fechaEntrega: s.fechaEntrega,
    estadoBienestar: s.estadoBienestar,
    observaciones: s.observaciones,
    reporte: aReporteDto(RUTA_FUNDACION, s.id, s.reporte),
    evidencias: s.evidencias.map((f) => aFotoDto(RUTA_FUNDACION, s.id, f)),
  };
}

export function aDetalleAdoptanteDto(
  s: SeguimientoDetalleAdoptante,
): SeguimientoDetalleAdoptanteDto {
  return {
    ...aListaAdoptanteDto(s),
    fechaEntrega: s.fechaEntrega,
    reporte: aReporteDto(RUTA_ADOPTANTE, s.id, s.reporte),
  };
}

export function aResumenDto(s: ResumenSeguimiento): ResumenSeguimientoDto {
  return {
    id: s.id,
    tipo: s.tipo,
    fechaProgramada: s.fechaProgramada,
    fechaRealizada: s.fechaRealizada,
    estado: s.estado,
    vencido: s.vencido,
  };
}
