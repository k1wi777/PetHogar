import { describe, expect, it } from 'vitest';
import { esquemaDonacion } from './donacion';

const archivo = (n = 'c.pdf', t = 'application/pdf', b = 10) =>
  new File([new Uint8Array(b)], n, { type: t });
const msgs = (e: unknown) => {
  const r = esquemaDonacion.safeParse(e);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('esquemaDonacion', () => {
  it('exige elegir el tipo', () => {
    expect(msgs({})).toContain('Elige el tipo de donación');
    expect(msgs({ tipo: 'otra' })).toContain('Elige el tipo de donación');
  });
  it('en especie pide descripción de 1 a 300 caracteres y no valida el monto', () => {
    expect(msgs({ tipo: 'especie', descripcion: '  ' })).toContain(
      'Describe lo que donas (entre 1 y 300 caracteres)',
    );
    expect(msgs({ tipo: 'especie', descripcion: 'a'.repeat(301) })).toHaveLength(1);
    expect(msgs({ tipo: 'especie', descripcion: 'a'.repeat(300), monto: '0' })).toEqual([]);
  });
  it('económica no valida la descripción', () => {
    expect(msgs({ tipo: 'economica', monto: '10', descripcion: '' })).toEqual([]);
  });
  it('el comprobante es opcional y se valida si existe', () => {
    expect(msgs({ tipo: 'economica', monto: '10' })).toEqual([]);
    expect(msgs({ tipo: 'economica', monto: '10', comprobante: archivo() })).toEqual([]);
    expect(
      msgs({ tipo: 'economica', monto: '10', comprobante: archivo('a.gif', 'image/gif') }),
    ).toContain('Solo se permiten archivos JPG, PNG o PDF');
    expect(
      msgs({
        tipo: 'economica',
        monto: '10',
        comprobante: archivo('a.png', 'image/png', 5 * 1024 * 1024 + 1),
      })[0],
    ).toMatch(/supera/);
  });
});
