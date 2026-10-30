import { describe, expect, it } from 'vitest';
import { esquemaReporte } from './reporte';

const foto = (n = 'a.png', t = 'image/png', b = 10) =>
  new File([new Uint8Array(b)], n, { type: t });
const msgs = (e: unknown) => {
  const r = esquemaReporte.safeParse(e);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('esquemaReporte', () => {
  it('comentarios obligatorios (recortados) y de hasta 500', () => {
    expect(msgs({ comentarios: '  ' })).toContain('Cuéntanos cómo está la mascota');
    expect(msgs({ comentarios: 'a'.repeat(500) })).toEqual([]);
    expect(msgs({ comentarios: 'a'.repeat(501) })).toContain(
      'Los comentarios no pueden superar 500 caracteres',
    );
  });
  it('las fotos son opcionales, hasta 5, solo JPG o PNG de hasta 5 MB', () => {
    expect(msgs({ comentarios: 'bien' })).toEqual([]);
    expect(msgs({ comentarios: 'bien', fotos: [foto(), foto('b.jpg', 'image/jpeg')] })).toEqual([]);
    expect(msgs({ comentarios: 'bien', fotos: Array.from({ length: 6 }, () => foto()) })).toContain(
      'Puedes adjuntar hasta 5 fotos',
    );
    expect(msgs({ comentarios: 'bien', fotos: [foto('a.pdf', 'application/pdf')] })).toContain(
      'a.pdf: Solo se permiten fotos JPG o PNG',
    );
    expect(
      msgs({ comentarios: 'bien', fotos: [foto('g.png', 'image/png', 5 * 1024 * 1024 + 1)] })[0],
    ).toMatch(/supera/);
  });
});
