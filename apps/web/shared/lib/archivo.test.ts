import { describe, expect, it } from 'vitest';
import {
  MAX_BYTES_DOCUMENTO,
  formatearTamano,
  SOLO_IMAGENES,
  tipoDeDocumento,
  validarDocumento,
} from './archivo';

const archivo = (name: string, type: string, size: number) => ({ name, type, size });

describe('validarDocumento', () => {
  it('acepta JPG, PNG y PDF', () => {
    expect(validarDocumento(archivo('a.jpg', 'image/jpeg', 10))).toEqual({
      ok: true,
      tipo: 'image/jpeg',
    });
    expect(validarDocumento(archivo('a.png', 'image/png', 10)).ok).toBe(true);
    expect(validarDocumento(archivo('a.pdf', 'application/pdf', 10)).ok).toBe(true);
  });

  it('rechaza otros tipos aunque la extensión parezca válida', () => {
    const r = validarDocumento(archivo('a.pdf', 'text/plain', 10));
    expect(r).toEqual({ ok: false, mensaje: 'Solo se permiten archivos JPG, PNG o PDF' });
    expect(validarDocumento(archivo('a.gif', 'image/gif', 10)).ok).toBe(false);
  });

  it('usa la extensión solo cuando el navegador no informa el tipo', () => {
    expect(tipoDeDocumento({ name: 'Doc.JPEG', type: '' })).toBe('image/jpeg');
    expect(tipoDeDocumento({ name: 'doc.exe', type: '' })).toBeNull();
    expect(tipoDeDocumento({ name: 'sin-extension', type: '' })).toBeNull();
  });

  it('el límite es 5 MB exactos: 5 MB pasa, 5 MB + 1 byte no', () => {
    expect(validarDocumento(archivo('a.png', 'image/png', MAX_BYTES_DOCUMENTO)).ok).toBe(true);
    expect(validarDocumento(archivo('a.png', 'image/png', MAX_BYTES_DOCUMENTO + 1))).toEqual({
      ok: false,
      mensaje: 'El archivo supera el tamaño máximo de 5 MB',
    });
  });

  it('rechaza archivos vacíos', () => {
    expect(validarDocumento(archivo('a.png', 'image/png', 0))).toEqual({
      ok: false,
      mensaje: 'El archivo está vacío',
    });
  });
});

describe('validarDocumento solo imágenes', () => {
  it('rechaza el PDF cuando solo se permiten imágenes', () => {
    expect(validarDocumento(archivo('a.pdf', 'application/pdf', 10), SOLO_IMAGENES)).toEqual({
      ok: false,
      mensaje: 'Solo se permiten fotos JPG o PNG',
    });
    expect(validarDocumento(archivo('a.png', 'image/png', 10), SOLO_IMAGENES).ok).toBe(true);
  });
});

describe('formatearTamano', () => {
  it('es legible', () => {
    expect(formatearTamano(512)).toBe('512 B');
    expect(formatearTamano(2048)).toBe('2 KB');
    expect(formatearTamano(2.5 * 1024 * 1024)).toBe('2,5 MB');
  });
});
