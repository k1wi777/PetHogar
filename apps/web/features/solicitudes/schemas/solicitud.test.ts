import { describe, expect, it } from 'vitest';
import { esquemaSolicitud } from './solicitud';

const archivo = (nombre = 'f.pdf', tipo = 'application/pdf', bytes = 10) =>
  new File([new Uint8Array(bytes)], nombre, { type: tipo });
const valido = () => ({
  motivo: 'Tengo patio y tiempo',
  tipoVivienda: 'casa' as const,
  tieneOtrasMascotas: false,
  formulario: archivo(),
});
const mensajes = (entrada: unknown) => {
  const r = esquemaSolicitud.safeParse(entrada);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('esquemaSolicitud', () => {
  it('acepta datos completos y recorta el motivo', () => {
    const r = esquemaSolicitud.safeParse({ ...valido(), motivo: '  Quiero un amigo  ' });
    expect(r.success && r.data.motivo).toBe('Quiero un amigo');
  });

  it('el motivo es obligatorio y llega a 500 caracteres', () => {
    expect(mensajes({ ...valido(), motivo: '   ' })).toContain('El motivo es obligatorio');
    expect(esquemaSolicitud.safeParse({ ...valido(), motivo: 'a'.repeat(500) }).success).toBe(true);
    expect(mensajes({ ...valido(), motivo: 'a'.repeat(501) })).toContain(
      'El motivo no puede superar 500 caracteres',
    );
  });

  it('el tipo de vivienda es uno de tres', () => {
    expect(mensajes({ ...valido(), tipoVivienda: 'castillo' })).toContain(
      'El tipo de vivienda debe ser casa, apartamento o finca',
    );
    for (const t of ['casa', 'apartamento', 'finca']) {
      expect(esquemaSolicitud.safeParse({ ...valido(), tipoVivienda: t }).success).toBe(true);
    }
  });

  it('otras mascotas exige una respuesta explícita', () => {
    expect(mensajes({ ...valido(), tieneOtrasMascotas: undefined })).toContain(
      'Indica si tienes otras mascotas',
    );
    expect(esquemaSolicitud.safeParse({ ...valido(), tieneOtrasMascotas: true }).success).toBe(
      true,
    );
  });

  it('el formulario es obligatorio y se valida (tipo, vacío, tamaño)', () => {
    expect(mensajes({ ...valido(), formulario: undefined })).toContain(
      'Debes adjuntar el formulario firmado',
    );
    expect(mensajes({ ...valido(), formulario: archivo('a.gif', 'image/gif') })).toContain(
      'Solo se permiten archivos JPG, PNG o PDF',
    );
    expect(mensajes({ ...valido(), formulario: archivo('a.png', 'image/png', 0) })).toContain(
      'El archivo está vacío',
    );
    expect(
      mensajes({ ...valido(), formulario: archivo('a.png', 'image/png', 5 * 1024 * 1024 + 1) }),
    ).toContain('El archivo supera el tamaño máximo de 5 MB');
  });
});
