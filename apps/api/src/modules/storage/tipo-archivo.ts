import type { TipoArchivo } from './storage.constants';

const FIRMA_JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FIRMA_PDF = Buffer.from('%PDF-', 'latin1');

function empiezaPor(buffer: Buffer, firma: Buffer): boolean {
  return buffer.length >= firma.length && buffer.subarray(0, firma.length).equals(firma);
}

/** Detecta el tipo real por la firma binaria; ignora extensión y Content-Type declarados. */
export function detectarTipo(buffer: Buffer): TipoArchivo | null {
  if (empiezaPor(buffer, FIRMA_JPEG)) return 'image/jpeg';
  if (empiezaPor(buffer, FIRMA_PNG)) return 'image/png';
  if (empiezaPor(buffer, FIRMA_PDF)) return 'application/pdf';
  return null;
}
