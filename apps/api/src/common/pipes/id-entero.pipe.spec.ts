import { BadRequestException } from '@nestjs/common';
import { IdEnteroPipe } from './id-entero.pipe';

describe('IdEnteroPipe', () => {
  const pipe = new IdEnteroPipe();

  it.each([
    ['1', 1],
    ['42', 42],
    ['2147483647', 2147483647],
  ])('acepta %s', (entrada, esperado) => {
    expect(pipe.transform(entrada)).toBe(esperado);
  });

  it.each(['0', '-1', '2147483648', '99999999999', '1.5', 'abc', '', '1e3', ' 1', '0x10'])(
    'rechaza %p con 400 en español',
    (entrada) => {
      expect(() => pipe.transform(entrada)).toThrow(BadRequestException);
      expect(() => pipe.transform(entrada)).toThrow('El identificador no es válido');
    },
  );
});
