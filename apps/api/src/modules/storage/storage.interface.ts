import type {
  CarpetaArchivo,
  CategoriaArchivo,
  TipoArchivo,
  Visibilidad,
} from './storage.constants';

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface ArchivoEntrada {
  buffer: Buffer;
  /** Solo para logs: nunca se usa para el nombre ni la extensión de destino. */
  nombreOriginal?: string;
}

export interface OpcionesGuardado {
  categoria: CategoriaArchivo;
  carpeta: CarpetaArchivo;
}

export interface ArchivoGuardado {
  /** Clave relativa (`<publico|privado>/<carpeta>/<uuid>.<ext>`); es lo que se persiste. */
  clave: string;
  visibilidad: Visibilidad;
  tipo: TipoArchivo;
  tamano: number;
}

export interface ArchivoLeido {
  buffer: Buffer;
  /** Tipo real detectado por la firma del contenido, no por la extensión de la clave. */
  tipo: TipoArchivo;
  tamano: number;
}

export interface IStorageService {
  guardar(archivo: ArchivoEntrada, opciones: OpcionesGuardado): Promise<ArchivoGuardado>;
  /**
   * Lee un archivo (público o privado) completo en memoria (máx. 5 MB). Lanza
   * `NotFoundException` si no existe o su contenido no es un tipo permitido.
   */
  leer(clave: string): Promise<ArchivoLeido>;
  /** Idempotente: no falla si el archivo no existe. */
  eliminar(clave: string): Promise<void>;
  /** Solo para claves públicas; lanza si la clave es privada. */
  urlPublica(clave: string): string;
}
