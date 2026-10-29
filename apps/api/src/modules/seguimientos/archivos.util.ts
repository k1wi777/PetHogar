import { Logger } from '@nestjs/common';
import type { IStorageService } from '../storage/storage.interface';

/** Borra archivos sin ocultar nunca el error original: un fallo al limpiar solo se registra. */
export async function eliminarArchivos(
  storage: IStorageService,
  claves: readonly string[],
  logger: Logger,
): Promise<void> {
  for (const clave of claves) {
    try {
      await storage.eliminar(clave);
    } catch (error) {
      logger.warn(
        `No se pudo eliminar el archivo ${clave}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Guarda las fotos en la carpeta privada de seguimientos. Si una falla, borra las ya guardadas y
 * propaga el error, de modo que una petición rechazada nunca deja archivos huérfanos.
 */
export async function guardarFotos(
  storage: IStorageService,
  buffers: readonly Buffer[],
  logger: Logger,
): Promise<string[]> {
  const claves: string[] = [];
  try {
    for (const buffer of buffers) {
      const guardado = await storage.guardar(
        { buffer },
        { categoria: 'imagen', carpeta: 'seguimientos' },
      );
      claves.push(guardado.clave);
    }
    return claves;
  } catch (error) {
    await eliminarArchivos(storage, claves, logger);
    throw error;
  }
}
