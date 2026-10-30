import { describe, expect, it } from 'vitest';
import { MENSAJE_CORREO_LARGO, MENSAJE_NOMBRE_LARGO, esquemaFiltrosUsuarios } from './filtros';

describe('esquemaFiltrosUsuarios', () => {
  it('recorta y acepta vacíos y roles válidos', () => {
    expect(
      esquemaFiltrosUsuarios.parse({ nombre: '  Ana ', correo: '', rol: 'fundacion' }),
    ).toEqual({
      nombre: 'Ana',
      correo: '',
      rol: 'fundacion',
    });
  });
  it('rechaza más de 100 caracteres con el texto del backend', () => {
    const r = esquemaFiltrosUsuarios.safeParse({
      nombre: 'a'.repeat(101),
      correo: 'b'.repeat(101),
    });
    expect(r.error?.issues.map((i) => i.message)).toEqual([
      MENSAJE_NOMBRE_LARGO,
      MENSAJE_CORREO_LARGO,
    ]);
  });
  it('rechaza un rol desconocido', () => {
    expect(esquemaFiltrosUsuarios.safeParse({ nombre: '', correo: '', rol: 'root' }).success).toBe(
      false,
    );
  });
});
