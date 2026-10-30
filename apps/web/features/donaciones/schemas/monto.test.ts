import { describe, expect, it } from 'vitest';
import { esquemaDonacion } from './donacion';
import { formatearMonto, problemaDeMonto } from '@/shared/lib/monto';

const montoEsc = (monto: string) => esquemaDonacion.safeParse({ tipo: 'economica', monto });
const mensaje = (monto: string) => {
  const r = montoEsc(monto);
  return r.success ? null : r.error.issues[0]!.message;
};

describe('monto', () => {
  it.each([
    ['0', 'El monto debe ser mayor que 0'],
    ['0.00', 'El monto debe ser mayor que 0'],
    ['-5', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['1.234', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['abc', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['1e5', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['1.000', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['1000000000.01', 'El monto no puede superar $ 1.000.000.000'],
    ['', 'Indica el monto de la donación económica'],
  ])('«%s» se rechaza: %s', (monto, esperado) => {
    expect(mensaje(monto)).toBe(esperado);
  });

  it.each(['1', '0.01', '5.5', '50000.50', '1000000000', '1000000000.00'])(
    '«%s» es válido y queda como cadena',
    (monto) => {
      const r = montoEsc(monto);
      expect(r.success && (r.data as { monto: string }).monto).toBe(monto);
    },
  );

  it('acepta la coma decimal y la normaliza a punto, sin pasar por número', () => {
    const r = montoEsc('5,5');
    expect(r.success && (r.data as { monto: string }).monto).toBe('5.5');
    const largo = '123456789012345678901234567890.99';
    expect(problemaDeMonto(largo)).toBe('maximo');
    expect(problemaDeMonto('0.001')).toBe('formato');
  });

  it('formatea para mostrar', () => {
    expect(formatearMonto('50000')).toBe('$ 50.000');
    expect(formatearMonto('50000.50')).toBe('$ 50.000,50');
    expect(formatearMonto('1000000000.00')).toBe('$ 1.000.000.000');
  });
});
