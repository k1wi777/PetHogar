import { describe, expect, it } from 'vitest';
import { consultaAUrl, leerConsulta, leerId, leerPestana, rutaLista } from './consulta';

const q = (texto: string) => new URLSearchParams(texto);

describe('consulta de la lista', () => {
  it('lee página y estado válidos y descarta los inválidos', () => {
    expect(leerConsulta(q('pagina=3&estado=adoptada'))).toEqual({ pagina: 3, estado: 'adoptada' });
    expect(leerConsulta(q('pagina=0&estado=raro'))).toEqual({ pagina: 1, estado: undefined });
    expect(leerConsulta(q('pagina=-2'))).toEqual({ pagina: 1, estado: undefined });
    expect(leerConsulta(q(''))).toEqual({ pagina: 1, estado: undefined });
  });

  it('serializa solo lo que difiere del valor por defecto', () => {
    expect(consultaAUrl({ pagina: 1 })).toBe('');
    expect(consultaAUrl({ pagina: 2, estado: 'inactiva' })).toBe('?pagina=2&estado=inactiva');
    expect(rutaLista({ pagina: 1, estado: 'en_proceso' })).toBe(
      '/fundacion/mascotas?estado=en_proceso',
    );
  });

  it('valida el id de la ruta y la pestaña', () => {
    expect(leerId('12')).toBe(12);
    for (const malo of ['0', '-1', 'abc', '1.5', '', null, undefined]) {
      expect(leerId(malo)).toBeNull();
    }
    expect(leerPestana('fotos')).toBe('fotos');
    expect(leerPestana('historial')).toBe('historial');
    expect(leerPestana('otra')).toBe('datos');
    expect(leerPestana(null)).toBe('datos');
  });
});
