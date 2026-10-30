import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esquemaAdoptante, esMayorDeEdad, esFechaValida, fechaMaximaNacimiento } from './adoptante';
import { esquemaFundacion } from './fundacion';
import { esquemaLogin } from './login';
import { esquemaCodigo, esquemaNuevaContrasena, esquemaSolicitudCodigo } from './recuperacion';

function mensajes(resultado: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  const m: Record<string, string> = {};
  for (const i of resultado.error?.issues ?? []) m[String(i.path[0])] ??= i.message;
  return m;
}

const adoptanteValido = {
  primerNombre: 'Ana',
  primerApellido: 'Pérez',
  tipoDocumento: 'CC' as const,
  numeroDocumento: 'ABC1234',
  fechaNacimiento: '1990-05-10',
  telefono: '+573001234567',
  email: 'ana@correo.co',
  direccion: 'Calle 1 # 2-3',
  ciudad: 'Montería',
  contrasena: 'Clave1234',
  aceptaPoliticaDatos: true,
};

describe('mayoría de edad', () => {
  const ahora = new Date('2026-06-15T12:00:00Z');
  it('el borde es el cumpleaños 18', () => {
    expect(esMayorDeEdad('2008-06-15', ahora)).toBe(true);
    expect(esMayorDeEdad('2008-06-16', ahora)).toBe(false);
    expect(esMayorDeEdad('2008-07-01', ahora)).toBe(false);
    expect(esMayorDeEdad('2000-01-01', ahora)).toBe(true);
  });
  it('fechaMaximaNacimiento es hoy menos 18 años', () => {
    expect(fechaMaximaNacimiento(ahora)).toBe('2008-06-15');
  });
  it('detecta fechas inexistentes', () => {
    expect(esFechaValida('2001-02-30')).toBe(false);
    expect(esFechaValida('2000-02-29')).toBe(true);
    expect(esFechaValida('01/02/2000')).toBe(false);
  });
});

describe('esquemaAdoptante', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('acepta un registro válido y normaliza correo y espacios', () => {
    const r = esquemaAdoptante.safeParse({
      ...adoptanteValido,
      email: '  ANA@Correo.CO ',
      primerNombre: '  Ana ',
      segundoNombre: '',
    });
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe('ana@correo.co');
    expect(r.data?.primerNombre).toBe('Ana');
  });

  it('usa los mismos textos que el backend', () => {
    const m = mensajes(
      esquemaAdoptante.safeParse({
        ...adoptanteValido,
        primerNombre: '  ',
        tipoDocumento: undefined,
        numeroDocumento: 'a b',
        telefono: '12',
        email: 'malo',
        contrasena: 'corta',
        aceptaPoliticaDatos: false,
      }),
    );
    expect(m).toMatchObject({
      primerNombre: 'El primer nombre es obligatorio',
      tipoDocumento: 'El tipo de documento debe ser CC, CE o PA',
      numeroDocumento:
        'El número de documento debe tener entre 4 y 20 letras o números, sin espacios',
      telefono: 'El teléfono debe tener entre 7 y 14 dígitos (puede iniciar con +)',
      email: 'Ingresa un correo electrónico válido',
      contrasena: 'La contraseña debe tener entre 8 y 64 caracteres',
      aceptaPoliticaDatos: 'Debes aceptar la política de tratamiento de datos personales',
    });
  });

  it('límites de longitud', () => {
    expect(
      esquemaAdoptante.safeParse({ ...adoptanteValido, primerNombre: 'a'.repeat(40) }).success,
    ).toBe(true);
    expect(
      mensajes(esquemaAdoptante.safeParse({ ...adoptanteValido, primerNombre: 'a'.repeat(41) }))
        .primerNombre,
    ).toBe('El primer nombre no puede superar los 40 caracteres');
    expect(
      esquemaAdoptante.safeParse({
        ...adoptanteValido,
        direccion: 'a'.repeat(150),
        ciudad: 'a'.repeat(60),
      }).success,
    ).toBe(true);
    expect(
      esquemaAdoptante.safeParse({ ...adoptanteValido, direccion: 'a'.repeat(151) }).success,
    ).toBe(false);
    expect(esquemaAdoptante.safeParse({ ...adoptanteValido, ciudad: 'a'.repeat(61) }).success).toBe(
      false,
    );
    expect(
      esquemaAdoptante.safeParse({ ...adoptanteValido, email: `${'a'.repeat(96)}@x.co` }).success,
    ).toBe(false);
  });

  it('teléfono y documento en sus bordes', () => {
    for (const t of ['1234567', '+12345678901234']) {
      expect(esquemaAdoptante.safeParse({ ...adoptanteValido, telefono: t }).success).toBe(true);
    }
    for (const t of ['123456', '123456789012345', '+', '3a00123456']) {
      expect(esquemaAdoptante.safeParse({ ...adoptanteValido, telefono: t }).success).toBe(false);
    }
    expect(esquemaAdoptante.safeParse({ ...adoptanteValido, numeroDocumento: 'abc' }).success).toBe(
      false,
    );
    expect(
      esquemaAdoptante.safeParse({ ...adoptanteValido, numeroDocumento: 'a'.repeat(21) }).success,
    ).toBe(false);
    expect(
      esquemaAdoptante.safeParse({ ...adoptanteValido, numeroDocumento: 'a'.repeat(20) }).success,
    ).toBe(true);
  });

  it('exactamente 18 años pasa y un día menos no', () => {
    expect(
      esquemaAdoptante.safeParse({ ...adoptanteValido, fechaNacimiento: '2008-06-15' }).success,
    ).toBe(true);
    const m = mensajes(
      esquemaAdoptante.safeParse({ ...adoptanteValido, fechaNacimiento: '2008-06-16' }),
    );
    expect(m.fechaNacimiento).toBe('Debes ser mayor de 18 años para registrarte');
    expect(
      mensajes(esquemaAdoptante.safeParse({ ...adoptanteValido, fechaNacimiento: '2001-02-30' }))
        .fechaNacimiento,
    ).toBe('La fecha de nacimiento no es válida');
    expect(
      mensajes(esquemaAdoptante.safeParse({ ...adoptanteValido, fechaNacimiento: '' }))
        .fechaNacimiento,
    ).toBe('La fecha de nacimiento debe tener el formato AAAA-MM-DD');
  });

  it('política de contraseña: cada regla con su mensaje', () => {
    const msg = (c: string) =>
      mensajes(esquemaAdoptante.safeParse({ ...adoptanteValido, contrasena: c })).contrasena;
    expect(msg('Abcdef1')).toBe('La contraseña debe tener entre 8 y 64 caracteres');
    expect(msg('abcdefg1')).toBe('La contraseña debe incluir al menos una letra mayúscula');
    expect(msg('ABCDEFG1')).toBe('La contraseña debe incluir al menos una letra minúscula');
    expect(msg('Abcdefgh')).toBe('La contraseña debe incluir al menos un número');
    expect(msg(`Aa1${'x'.repeat(62)}`)).toBe('La contraseña debe tener entre 8 y 64 caracteres');
    expect(msg(`Aa1${'x'.repeat(61)}`)).toBeUndefined();
  });
});

describe('esquemaFundacion', () => {
  const documento = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
  const valida = {
    nombre: 'Patitas',
    nit: '900123456-7',
    direccion: 'Calle 1',
    ciudad: 'Montería',
    telefono: '3001234567',
    email: 'f@x.co',
    contrasena: 'Clave1234',
    documento,
    aceptaPoliticaDatos: true,
  };

  it('acepta una fundación válida con descripción opcional', () => {
    expect(esquemaFundacion.safeParse(valida).success).toBe(true);
    expect(esquemaFundacion.safeParse({ ...valida, descripcion: 'a'.repeat(500) }).success).toBe(
      true,
    );
    expect(
      mensajes(esquemaFundacion.safeParse({ ...valida, descripcion: 'a'.repeat(501) })).descripcion,
    ).toBe('La descripción no puede superar los 500 caracteres');
  });

  it('NIT en sus bordes', () => {
    for (const nit of ['1234-', 'abc', '12 34', '-1234', '1234']) {
      expect(esquemaFundacion.safeParse({ ...valida, nit }).success, nit).toBe(false);
    }
    for (const nit of ['12345', '9.001.234-5', `1${'2'.repeat(18)}3`]) {
      expect(esquemaFundacion.safeParse({ ...valida, nit }).success, nit).toBe(true);
    }
    expect(esquemaFundacion.safeParse({ ...valida, nit: `1${'2'.repeat(19)}3` }).success).toBe(
      false,
    );
  });

  it('el documento es obligatorio, de tipo permitido y de hasta 5 MB', () => {
    expect(
      mensajes(esquemaFundacion.safeParse({ ...valida, documento: undefined })).documento,
    ).toBe('Debes adjuntar el documento legal');
    const gif = new File(['x'], 'a.gif', { type: 'image/gif' });
    expect(mensajes(esquemaFundacion.safeParse({ ...valida, documento: gif })).documento).toBe(
      'Solo se permiten archivos JPG, PNG o PDF',
    );
    const justo = new File([new Uint8Array(5 * 1024 * 1024)], 'a.png', { type: 'image/png' });
    expect(esquemaFundacion.safeParse({ ...valida, documento: justo }).success).toBe(true);
    const grande = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' });
    expect(mensajes(esquemaFundacion.safeParse({ ...valida, documento: grande })).documento).toBe(
      'El archivo supera el tamaño máximo de 5 MB',
    );
  });
});

describe('esquemas de login y recuperación', () => {
  it('el login no aplica política de fortaleza pero sí requerido y tope', () => {
    expect(esquemaLogin.safeParse({ email: 'A@B.co', contrasena: 'x' }).success).toBe(true);
    expect(mensajes(esquemaLogin.safeParse({ email: 'a@b.co', contrasena: '' })).contrasena).toBe(
      'Ingresa tu contraseña',
    );
    expect(esquemaLogin.safeParse({ email: 'a@b.co', contrasena: 'x'.repeat(128) }).success).toBe(
      true,
    );
    expect(
      mensajes(esquemaLogin.safeParse({ email: 'a@b.co', contrasena: 'x'.repeat(129) })).contrasena,
    ).toBe('La contraseña no es válida');
  });

  it('el código son exactamente 6 dígitos', () => {
    expect(esquemaCodigo.safeParse({ codigo: '123456' }).success).toBe(true);
    for (const codigo of ['12345', '1234567', '12345a', '']) {
      expect(esquemaCodigo.safeParse({ codigo }).success, codigo).toBe(false);
    }
  });

  it('correo de recuperación y nueva contraseña', () => {
    expect(esquemaSolicitudCodigo.safeParse({ email: 'no-correo' }).success).toBe(false);
    expect(esquemaNuevaContrasena.safeParse({ nuevaContrasena: 'Clave1234' }).success).toBe(true);
    expect(esquemaNuevaContrasena.safeParse({ nuevaContrasena: 'clave1234' }).success).toBe(false);
  });
});
