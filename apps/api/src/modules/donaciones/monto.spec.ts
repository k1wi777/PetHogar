import { normalizarMonto, problemaDeMonto } from './monto';

describe('problemaDeMonto', () => {
  it.each([
    '1',
    '0.01',
    '5.5',
    '50000.50',
    '007.25',
    '999999999.99',
    '1000000000',
    '1000000000.00',
  ])('acepta %s', (monto) => expect(problemaDeMonto(monto)).toBeNull());

  it.each(['0', '0.00', '00', '0.0'])('%s es cero', (monto) =>
    expect(problemaDeMonto(monto)).toBe('cero'),
  );

  it.each(['1000000000.01', '10000000000', '9999999999.99', '12345678901'])(
    '%s supera el tope',
    (monto) => expect(problemaDeMonto(monto)).toBe('maximo'),
  );

  it.each(['-1', '1.234', '1e3', '1,5', '', ' ', 'abc', '.5', '5.', '+5', '0x10'])(
    '«%s» tiene formato inválido',
    (monto) => expect(problemaDeMonto(monto)).toBe('formato'),
  );
});

describe('normalizarMonto', () => {
  it.each([
    ['5', '5.00'],
    ['5.5', '5.50'],
    ['007.25', '7.25'],
    ['0.01', '0.01'],
    ['1000000000', '1000000000.00'],
    // Valores donde un `Number` perdería exactitud al sumar o convertir.
    ['9007199254.74', '9007199254.74'],
    ['0.10', '0.10'],
  ])('%s → %s', (entrada, esperado) => expect(normalizarMonto(entrada)).toBe(esperado));

  it('rechaza un formato inválido en vez de adivinar', () => {
    expect(() => normalizarMonto('1e3')).toThrow();
  });
});
