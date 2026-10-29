import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';

/** PDF como descarga: tipo real, nombre construido por nosotros y sin interpretación del navegador. */
export function enviarPdf(
  res: Response,
  buffer: Buffer,
  nombreArchivo: string,
  opciones: { sinCache: boolean },
): StreamableFile {
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (opciones.sinCache) res.setHeader('Cache-Control', 'private, no-store');
  return new StreamableFile(buffer, { type: 'application/pdf', length: buffer.length });
}
