import { describe, expect, it } from 'vitest';
import { ErrorApi, MENSAJES } from '@/shared/api/errores';
import { MENSAJE_LIMITE, aplicarError, traducirError } from './errores-servidor';

const CAMPOS = ['email', 'numeroDocumento', 'nit', 'fechaNacimiento', 'documento', 'telefono'];
const http = (estado: number, mensaje: string, errores?: ErrorApi['errores']) =>
  new ErrorApi({ tipo: 'http', estado, mensaje, errores });

describe('traducirError', () => {
  it('400 con errores por campo se asigna a cada campo con su primer mensaje', () => {
    const r = traducirError(
      http(400, 'Los datos enviados no son válidos', [
        { campo: 'telefono', mensajes: ['El teléfono debe tener entre 7 y 14 dígitos', 'otro'] },
        { campo: 'raro', mensajes: ['Mensaje de un campo que el formulario no tiene'] },
      ]),
      CAMPOS,
    );
    expect(r).toEqual({
      tipo: 'campos',
      campos: [{ campo: 'telefono', mensaje: 'El teléfono debe tener entre 7 y 14 dígitos' }],
      aviso: 'Mensaje de un campo que el formulario no tiene',
    });
  });

  it.each([
    ['Ya existe una cuenta registrada con este correo', 'email'],
    ['Ya existe una cuenta registrada con este número de documento', 'numeroDocumento'],
    ['Ya existe una fundación registrada con este NIT', 'nit'],
  ])('409 «%s» va al campo %s', (mensaje, campo) => {
    expect(traducirError(http(409, mensaje), CAMPOS)).toEqual({
      tipo: 'campos',
      campos: [{ campo, mensaje }],
    });
  });

  it('un 409 hacia un campo que el formulario no tiene queda como aviso', () => {
    expect(
      traducirError(http(409, 'Ya existe una fundación registrada con este NIT'), ['email']),
    ).toEqual({
      tipo: 'aviso',
      mensaje: 'Ya existe una fundación registrada con este NIT',
    });
  });

  it('el menor de edad se asocia a la fecha de nacimiento', () => {
    expect(
      traducirError(http(400, 'Debes ser mayor de 18 años para registrarte'), CAMPOS),
    ).toMatchObject({ tipo: 'campos', campos: [{ campo: 'fechaNacimiento' }] });
  });

  it('los errores del archivo se asocian al documento', () => {
    expect(
      traducirError(
        http(400, 'Debes adjuntar el documento legal de la fundación (JPG, PNG o PDF)'),
        CAMPOS,
      ),
    ).toMatchObject({ campos: [{ campo: 'documento' }] });
    expect(
      traducirError(http(400, 'El archivo supera el tamaño máximo de 5 MB'), CAMPOS),
    ).toMatchObject({
      campos: [{ campo: 'documento' }],
    });
  });

  it('otro 4xx se muestra como aviso con el texto del servidor', () => {
    expect(
      traducirError(http(400, 'El código no es válido o ya venció. Solicita uno nuevo.'), CAMPOS),
    ).toEqual({
      tipo: 'aviso',
      mensaje: 'El código no es válido o ya venció. Solicita uno nuevo.',
    });
  });

  it('429 y red son transitorios, no errores del usuario', () => {
    expect(traducirError(http(429, 'Demasiadas solicitudes'), CAMPOS)).toEqual({
      tipo: 'transitorio',
      mensaje: MENSAJE_LIMITE,
    });
    expect(traducirError(new ErrorApi({ tipo: 'red', mensaje: 'x' }), CAMPOS)).toEqual({
      tipo: 'transitorio',
      mensaje: MENSAJES.red,
    });
  });

  it('5xx y errores desconocidos dan un mensaje amable', () => {
    expect(traducirError(http(500, MENSAJES.servidor), CAMPOS)).toEqual({
      tipo: 'aviso',
      mensaje: MENSAJES.servidor,
    });
    expect(traducirError(new TypeError('x'), CAMPOS)).toEqual({
      tipo: 'aviso',
      mensaje: MENSAJES.generico,
    });
  });
});

describe('aplicarError', () => {
  it('enfoca solo el primer campo y limpia el aviso', () => {
    const marcados: Array<[string, boolean]> = [];
    const avisos: Array<string | null> = [];
    aplicarError(
      http(400, 'x', [
        { campo: 'email', mensajes: ['a'] },
        { campo: 'telefono', mensajes: ['b'] },
      ]),
      CAMPOS,
      {
        marcarCampo: (c, _m, enfocar) => marcados.push([c, enfocar]),
        mostrarAviso: (m) => avisos.push(m),
      },
    );
    expect(marcados).toEqual([
      ['email', true],
      ['telefono', false],
    ]);
    expect(avisos).toEqual([null]);
  });
});
