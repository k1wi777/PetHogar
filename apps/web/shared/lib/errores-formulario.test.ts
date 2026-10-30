import { describe, expect, it } from 'vitest';
import { ErrorApi, MENSAJES } from '@/shared/api/errores';
import { MENSAJE_LIMITE, aplicarError, traducirError } from './errores-formulario';

const http = (estado: number, mensaje: string, errores?: ErrorApi['errores']) =>
  new ErrorApi({ tipo: 'http', estado, mensaje, errores });

describe('traducirError (genérico)', () => {
  it('asigna el 400 por campo y sube lo desconocido al aviso', () => {
    expect(
      traducirError(
        http(400, 'x', [
          { campo: 'monto', mensajes: ['El monto debe ser mayor que cero'] },
          { campo: 'otro', mensajes: ['Algo más'] },
        ]),
        ['monto'],
      ),
    ).toEqual({
      tipo: 'campos',
      campos: [{ campo: 'monto', mensaje: 'El monto debe ser mayor que cero' }],
      aviso: 'Algo más',
    });
  });

  it('sin función de campo, un 4xx es un aviso; con ella va al campo', () => {
    const e = http(404, 'La fundación no existe');
    expect(traducirError(e, ['fundacion'])).toEqual({
      tipo: 'aviso',
      mensaje: 'La fundación no existe',
    });
    expect(traducirError(e, ['fundacion'], () => 'fundacion')).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'fundacion' }],
    });
  });

  it('429 y red son transitorios; lo desconocido es un aviso amable', () => {
    expect(traducirError(http(429, 'x'), [])).toEqual({
      tipo: 'transitorio',
      mensaje: MENSAJE_LIMITE,
    });
    expect(traducirError(new ErrorApi({ tipo: 'red', mensaje: 'x' }), [])).toEqual({
      tipo: 'transitorio',
      mensaje: MENSAJES.red,
    });
    expect(traducirError(new TypeError('x'), [])).toEqual({
      tipo: 'aviso',
      mensaje: MENSAJES.generico,
    });
  });
});

describe('aplicarError (genérico)', () => {
  it('enfoca solo el primer campo', () => {
    const marcados: Array<[string, boolean]> = [];
    aplicarError(
      http(400, 'x', [
        { campo: 'a', mensajes: ['1'] },
        { campo: 'b', mensajes: ['2'] },
      ]),
      ['a', 'b'],
      { marcarCampo: (c, _m, f) => marcados.push([c, f]), mostrarAviso: () => undefined },
    );
    expect(marcados).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });
});
