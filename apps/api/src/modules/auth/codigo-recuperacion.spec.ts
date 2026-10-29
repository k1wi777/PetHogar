import { randomInt } from 'node:crypto';
import { generarCodigo, hashearCodigo, hashesIguales } from './codigo-recuperacion';

jest.mock('node:crypto', () => {
  const real = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return { ...real, randomInt: jest.fn(real.randomInt) };
});

const SECRETO = 's'.repeat(32);

describe('codigo-recuperacion', () => {
  it('genera siempre 6 dígitos, también con ceros a la izquierda', () => {
    for (let i = 0; i < 500; i++) expect(generarCodigo()).toMatch(/^\d{6}$/);
    (randomInt as unknown as jest.Mock).mockReturnValueOnce(42).mockReturnValueOnce(0);
    expect(generarCodigo()).toBe('000042');
    expect(generarCodigo()).toBe('000000');
    expect(randomInt).toHaveBeenLastCalledWith(0, 1_000_000);
  });

  it('el hash es un HMAC hex de 64 caracteres que depende del usuario y del secreto', () => {
    const h = hashearCodigo(SECRETO, 1, '123456');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashearCodigo(SECRETO, 1, '123456')).toBe(h);
    expect(hashearCodigo(SECRETO, 2, '123456')).not.toBe(h);
    expect(hashearCodigo('t'.repeat(32), 1, '123456')).not.toBe(h);
    expect(hashearCodigo(SECRETO, 1, '123457')).not.toBe(h);
    expect(h).not.toContain('123456');
  });

  it('compara hashes sin lanzar ante longitudes distintas', () => {
    const h = hashearCodigo(SECRETO, 1, '000000');
    expect(hashesIguales(h, h)).toBe(true);
    expect(hashesIguales(h, hashearCodigo(SECRETO, 1, '000001'))).toBe(false);
    expect(hashesIguales(h, 'corto')).toBe(false);
    expect(hashesIguales(h, '')).toBe(false);
  });
});
