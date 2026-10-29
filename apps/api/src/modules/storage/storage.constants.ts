export const MAX_BYTES = 5 * 1024 * 1024;

export type Visibilidad = 'publico' | 'privado';
export type CategoriaArchivo = 'imagen' | 'documento';
export type TipoArchivo = 'image/jpeg' | 'image/png' | 'application/pdf';

/** Carpetas permitidas; nunca texto libre del cliente. */
export const CARPETAS = [
  'mascotas',
  'fundaciones',
  'solicitudes',
  'seguimientos',
  'donaciones',
  'pruebas-publicas',
  'pruebas-privadas',
] as const;

export type CarpetaArchivo = (typeof CARPETAS)[number];

/** La visibilidad la determina la carpeta, no el cliente. */
export const VISIBILIDAD_POR_CARPETA: Record<CarpetaArchivo, Visibilidad> = {
  mascotas: 'publico',
  fundaciones: 'privado',
  solicitudes: 'privado',
  seguimientos: 'privado',
  donaciones: 'privado',
  'pruebas-publicas': 'publico',
  'pruebas-privadas': 'privado',
};

export const POLITICA_POR_CATEGORIA: Record<CategoriaArchivo, readonly TipoArchivo[]> = {
  imagen: ['image/jpeg', 'image/png'],
  documento: ['image/jpeg', 'image/png', 'application/pdf'],
};

export const EXTENSION_POR_TIPO: Record<TipoArchivo, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

export const MENSAJE_SOLO_IMAGENES = 'Solo se permiten imágenes JPG o PNG';
export const MENSAJE_SOLO_DOCUMENTOS = 'Solo se permiten archivos JPG, PNG o PDF';
export const MENSAJE_ARCHIVO_GRANDE = 'El archivo supera el tamaño máximo de 5 MB';
export const MENSAJE_ARCHIVO_VACIO = 'El archivo está vacío';
