import { applyDecorators, Header, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { EXTENSION_POR_TIPO, type TipoArchivo } from './storage.constants';

/** Archivo privado listo para entregar: su nombre lo construimos nosotros, nunca sale la clave. */
export interface ArchivoDescargable {
  buffer: Buffer;
  tipo: TipoArchivo;
  tamano: number;
  nombreArchivo: string;
}

/** `<prefijo>-<id>.<ext>` con la extensión del tipo real detectado, no de datos del cliente. */
export function nombreDescarga(prefijo: string, id: number, tipo: TipoArchivo): string {
  return `${prefijo}-${id}.${EXTENSION_POR_TIPO[tipo]}`;
}

/** Mismas cabeceras que el documento legal de admin: sin sniffing, sin caché y sin contenido activo. */
export const CabecerasDescargaSegura = (): MethodDecorator =>
  applyDecorators(
    Header('X-Content-Type-Options', 'nosniff'),
    Header('Cache-Control', 'private, no-store'),
    Header('Content-Security-Policy', "default-src 'none'; sandbox"),
  );

export function enviarDescarga(res: Response, archivo: ArchivoDescargable): StreamableFile {
  res.setHeader('Content-Disposition', `inline; filename="${archivo.nombreArchivo}"`);
  return new StreamableFile(archivo.buffer, { type: archivo.tipo, length: archivo.tamano });
}
