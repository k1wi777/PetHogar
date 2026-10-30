/** Ayuda previa al envío: el backend valida el tipo real por firma binaria y es la autoridad. */
export const MAX_BYTES_DOCUMENTO = 5 * 1024 * 1024;

export const MENSAJE_TIPO_DOCUMENTO = 'Solo se permiten archivos JPG, PNG o PDF';
export const MENSAJE_DOCUMENTO_GRANDE = 'El archivo supera el tamaño máximo de 5 MB';
export const MENSAJE_DOCUMENTO_VACIO = 'El archivo está vacío';

export type TipoDocumento = 'image/jpeg' | 'image/png' | 'application/pdf';

const TIPOS_POR_EXTENSION: Readonly<Record<string, TipoDocumento>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};
const TIPOS_ACEPTADOS: readonly string[] = Object.values(TIPOS_POR_EXTENSION);

/** Tipo según `file.type` y, si el navegador no lo informa, según la extensión del nombre. */
export function tipoDeDocumento(archivo: Pick<File, 'name' | 'type'>): TipoDocumento | null {
  if (archivo.type) {
    return TIPOS_ACEPTADOS.includes(archivo.type) ? (archivo.type as TipoDocumento) : null;
  }
  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
  return TIPOS_POR_EXTENSION[extension] ?? null;
}

export type ResultadoDocumento = { ok: true; tipo: TipoDocumento } | { ok: false; mensaje: string };

/** Tipos de imagen (las fotos del reporte de seguimiento no admiten PDF). */
export const SOLO_IMAGENES: readonly TipoDocumento[] = ['image/jpeg', 'image/png'];
export const MENSAJE_TIPO_IMAGEN = 'Solo se permiten fotos JPG o PNG';

export function validarDocumento(
  archivo: Pick<File, 'name' | 'type' | 'size'>,
  permitidos?: readonly TipoDocumento[],
): ResultadoDocumento {
  const tipo = tipoDeDocumento(archivo);
  if (!tipo || (permitidos && !permitidos.includes(tipo))) {
    return {
      ok: false,
      mensaje: permitidos ? MENSAJE_TIPO_IMAGEN : MENSAJE_TIPO_DOCUMENTO,
    };
  }
  if (archivo.size === 0) return { ok: false, mensaje: MENSAJE_DOCUMENTO_VACIO };
  if (archivo.size > MAX_BYTES_DOCUMENTO) return { ok: false, mensaje: MENSAJE_DOCUMENTO_GRANDE };
  return { ok: true, tipo };
}

export function esImagen(tipo: TipoDocumento): boolean {
  return tipo !== 'application/pdf';
}

/** Tamaño legible para personas: «850 KB», «2,4 MB». */
export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
