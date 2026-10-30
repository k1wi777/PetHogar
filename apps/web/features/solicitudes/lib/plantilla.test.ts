import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_BYTES_DOCUMENTO } from '@/shared/lib/archivo';
import { NOMBRE_PLANTILLA_ADOPCION, RUTA_PLANTILLA_ADOPCION } from './plantilla';

describe('plantilla general del formulario de adopción', () => {
  const archivo = join(process.cwd(), 'public', RUTA_PLANTILLA_ADOPCION);

  it('la ruta pública apunta a un archivo versionado que existe', () => {
    expect(RUTA_PLANTILLA_ADOPCION).toMatch(
      /^\/plantillas\/formulario-adopcion-pethogar-v\d+\.pdf$/,
    );
    expect(RUTA_PLANTILLA_ADOPCION.endsWith(NOMBRE_PLANTILLA_ADOPCION)).toBe(true);
    expect(statSync(archivo).isFile()).toBe(true);
  });

  it('es un PDF (firma %PDF-) y pesa menos de 5 MB', () => {
    const contenido = readFileSync(archivo);
    expect(contenido.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(contenido.length).toBeGreaterThan(0);
    expect(contenido.length).toBeLessThan(MAX_BYTES_DOCUMENTO);
  });
});
