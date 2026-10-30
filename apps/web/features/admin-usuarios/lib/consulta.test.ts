import { describe, expect, it } from 'vitest';
import { consultaAUrl, leerConsulta } from './consulta';

const p = (q: string) => leerConsulta(new URLSearchParams(q));

describe('consulta de usuarios', () => {
  it('lee nombre, correo, rol y página', () => {
    expect(p('')).toEqual({ pagina: 1, nombre: undefined, correo: undefined, rol: undefined });
    expect(p('nombre=%20Ana%20&correo=x@y&rol=fundacion&pagina=2')).toEqual({
      pagina: 2,
      nombre: 'Ana',
      correo: 'x@y',
      rol: 'fundacion',
    });
  });
  it('ignora roles desconocidos y páginas inválidas; recorta a 100 caracteres', () => {
    const r = p(`rol=root&pagina=-3&nombre=${'a'.repeat(150)}`);
    expect(r.rol).toBeUndefined();
    expect(r.pagina).toBe(1);
    expect(r.nombre).toHaveLength(100);
  });
  it('serializa solo lo que tiene valor', () => {
    expect(consultaAUrl({ pagina: 1 })).toBe('');
    expect(consultaAUrl({ pagina: 2, nombre: 'Ana', rol: 'adoptante' })).toBe(
      '?nombre=Ana&rol=adoptante&pagina=2',
    );
  });
});
