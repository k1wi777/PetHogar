import { describe, expect, it } from 'vitest';
import {
  MENSAJE_BIENESTAR,
  MENSAJE_FECHA_FUTURA,
  MENSAJE_FECHA_OBLIGATORIA,
  MENSAJE_OBSERVACIONES,
  crearEsquemaResultado,
  mensajeAnteriorAEntrega,
} from './resultado';

const esquema = crearEsquemaResultado('2026-11-20', '2026-12-10');
const foto = (n = 'a.png', tipo = 'image/png', bytes = 10) =>
  new File([new Uint8Array(bytes)], n, { type: tipo });
const valido = () => ({
  fechaRealizada: '2026-12-05',
  estadoBienestar: 'bueno',
  observaciones: 'Todo bien',
  evidencias: [],
});
const mensajes = (e: unknown) => {
  const r = esquema.safeParse(e);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('esquema de resultado', () => {
  it('acepta datos válidos y recorta las observaciones', () => {
    const r = esquema.safeParse({ ...valido(), observaciones: '  Todo bien  ' });
    expect(r.success && r.data.observaciones).toBe('Todo bien');
  });
  it('la fecha no puede ser futura ni anterior a la entrega; hoy y la entrega valen', () => {
    expect(mensajes({ ...valido(), fechaRealizada: '2026-12-11' })).toEqual([MENSAJE_FECHA_FUTURA]);
    expect(mensajes({ ...valido(), fechaRealizada: '2026-11-19' })).toEqual([
      mensajeAnteriorAEntrega('2026-11-20'),
    ]);
    expect(mensajes({ ...valido(), fechaRealizada: '2026-12-10' })).toEqual([]);
    expect(mensajes({ ...valido(), fechaRealizada: '2026-11-20' })).toEqual([]);
    expect(mensajes({ ...valido(), fechaRealizada: '' })).toEqual([MENSAJE_FECHA_OBLIGATORIA]);
  });
  it('bienestar obligatorio y solo bueno, regular o malo', () => {
    expect(mensajes({ ...valido(), estadoBienestar: undefined })).toEqual([MENSAJE_BIENESTAR]);
    expect(mensajes({ ...valido(), estadoBienestar: 'pésimo' })).toEqual([MENSAJE_BIENESTAR]);
    expect(mensajes({ ...valido(), estadoBienestar: 'malo' })).toEqual([]);
  });
  it('observaciones de 1 a 500 caracteres', () => {
    expect(mensajes({ ...valido(), observaciones: '   ' })).toEqual([MENSAJE_OBSERVACIONES]);
    expect(mensajes({ ...valido(), observaciones: 'a'.repeat(500) })).toEqual([]);
    expect(mensajes({ ...valido(), observaciones: 'a'.repeat(501) })).toEqual([
      'Las observaciones no pueden superar 500 caracteres',
    ]);
  });
  it('hasta 5 evidencias JPG o PNG de 5 MB', () => {
    const cinco = Array.from({ length: 5 }, (_, i) => foto(`f${i}.png`));
    expect(mensajes({ ...valido(), evidencias: cinco })).toEqual([]);
    expect(mensajes({ ...valido(), evidencias: [...cinco, foto('g.png')] })).toEqual([
      'Puedes adjuntar hasta 5 fotos',
    ]);
    expect(mensajes({ ...valido(), evidencias: [foto('doc.pdf', 'application/pdf')] })[0]).toMatch(
      /^doc\.pdf: /,
    );
    expect(
      mensajes({ ...valido(), evidencias: [foto('grande.png', 'image/png', 6 * 1024 * 1024)] })[0],
    ).toMatch(/^grande\.png: /);
  });
});
