import { describe, expect, it } from 'vitest';
import { MENSAJE_DESCRIPCION, MENSAJE_NOMBRE, esquemaDonacionManual } from './donacion-manual';

const archivo = (n = 'c.pdf', tipo = 'application/pdf', bytes = 10) =>
  new File([new Uint8Array(bytes)], n, { type: tipo });
const mensajes = (e: unknown) => {
  const r = esquemaDonacionManual.safeParse(e);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};
const base = { nombreDonante: 'María Gómez' };

describe('esquema de donación manual', () => {
  it('nombre del donante de 2 a 100 caracteres', () => {
    expect(mensajes({ tipo: 'especie', descripcion: 'x', nombreDonante: 'A' })).toEqual([
      MENSAJE_NOMBRE,
    ]);
    expect(mensajes({ tipo: 'especie', descripcion: 'x', nombreDonante: ' ' })).toEqual([
      MENSAJE_NOMBRE,
    ]);
    expect(mensajes({ tipo: 'especie', descripcion: 'x', nombreDonante: 'a'.repeat(101) })).toEqual(
      [MENSAJE_NOMBRE],
    );
    expect(mensajes({ tipo: 'especie', descripcion: 'x', nombreDonante: 'Al' })).toEqual([]);
    expect(mensajes({ tipo: 'especie', descripcion: 'x' })).toEqual([MENSAJE_NOMBRE]);
  });
  it('exige elegir el tipo', () => {
    expect(mensajes({ ...base })).toEqual(['Elige el tipo de aporte']);
  });
  it.each([
    ['', 'Indica el monto de la donación económica'],
    ['0', 'El monto debe ser mayor que 0'],
    ['0,00', 'El monto debe ser mayor que 0'],
    ['1.234', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['abc', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['1000000000.01', 'El monto no puede superar $ 1.000.000.000'],
  ])('económica: monto %j', (monto, mensaje) => {
    expect(mensajes({ ...base, tipo: 'economica', monto })).toEqual([mensaje]);
  });
  it('económica: acepta el tope, decimales y coma; el monto sigue siendo cadena', () => {
    expect(mensajes({ ...base, tipo: 'economica', monto: '1000000000' })).toEqual([]);
    const r = esquemaDonacionManual.safeParse({ ...base, tipo: 'economica', monto: '50000,50' });
    expect(r.success && typeof (r.data as { monto: unknown }).monto).toBe('string');
    expect(r.success && (r.data as { monto: string }).monto).toBe('50000.50');
  });
  it('en especie exige descripción de 1 a 300 y no valida el monto', () => {
    expect(mensajes({ ...base, tipo: 'especie', descripcion: ' ' })).toEqual([MENSAJE_DESCRIPCION]);
    expect(mensajes({ ...base, tipo: 'especie', descripcion: 'a'.repeat(301) })).toEqual([
      MENSAJE_DESCRIPCION,
    ]);
    expect(
      mensajes({ ...base, tipo: 'especie', descripcion: 'a'.repeat(300), monto: 'basura' }),
    ).toEqual([]);
  });
  it('el campo que no corresponde se descarta del resultado', () => {
    const r = esquemaDonacionManual.safeParse({
      ...base,
      tipo: 'especie',
      descripcion: 'Pienso',
      monto: '5',
    });
    expect(r.success && 'monto' in r.data).toBe(false);
    const e = esquemaDonacionManual.safeParse({
      ...base,
      tipo: 'economica',
      monto: '5',
      descripcion: 'x',
    });
    expect(e.success && 'descripcion' in e.data).toBe(false);
  });
  it('comprobante opcional PDF/JPG/PNG de hasta 5 MB', () => {
    expect(
      mensajes({ ...base, tipo: 'especie', descripcion: 'x', comprobante: archivo() }),
    ).toEqual([]);
    expect(
      mensajes({
        ...base,
        tipo: 'especie',
        descripcion: 'x',
        comprobante: archivo('a.exe', 'application/x-msdownload'),
      }),
    ).toEqual(['Solo se permiten archivos JPG, PNG o PDF']);
    expect(
      mensajes({
        ...base,
        tipo: 'especie',
        descripcion: 'x',
        comprobante: archivo('g.png', 'image/png', 6 * 1024 * 1024),
      }),
    ).toEqual(['El archivo supera el tamaño máximo de 5 MB']);
  });
});
