import { describe, expect, it } from 'vitest';
import {
  MENSAJE_DOCUMENTO_GRANDE,
  MENSAJE_DOCUMENTO_VACIO,
  MENSAJE_TIPO_DOCUMENTO,
} from '@/shared/lib/archivo';
import { MENSAJE_ACTA_OBLIGATORIA, esquemaActa } from './acta';

const archivo = (nombre: string, tipo: string, bytes = 10) =>
  new File([new Uint8Array(bytes)], nombre, { type: tipo });
const mensajes = (acta: unknown) => {
  const r = esquemaActa.safeParse({ acta });
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('esquema del acta', () => {
  it('exige un archivo', () => {
    expect(mensajes(undefined)).toEqual([MENSAJE_ACTA_OBLIGATORIA]);
  });
  it.each([
    ['acta.pdf', 'application/pdf'],
    ['acta.png', 'image/png'],
    ['acta.jpg', 'image/jpeg'],
  ])('acepta %s', (n, t) => expect(mensajes(archivo(n, t))).toEqual([]));
  it('rechaza tipo, vacío y más de 5 MB', () => {
    expect(mensajes(archivo('acta.gif', 'image/gif'))).toEqual([MENSAJE_TIPO_DOCUMENTO]);
    expect(mensajes(archivo('acta.pdf', 'application/pdf', 0))).toEqual([MENSAJE_DOCUMENTO_VACIO]);
    expect(mensajes(archivo('acta.pdf', 'application/pdf', 5 * 1024 * 1024 + 1))).toEqual([
      MENSAJE_DOCUMENTO_GRANDE,
    ]);
  });
});
