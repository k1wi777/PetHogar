import { describe, expect, it } from 'vitest';
import { consultaAUrl, leerConsulta, leerId, rutaDetalle, rutaLista } from './consulta';

const p = (q: string) => new URLSearchParams(q);

describe('consulta de fundaciones', () => {
  it('por defecto: pendientes, página 1', () => {
    expect(leerConsulta(p(''))).toEqual({ pagina: 1, estado: 'pendiente' });
  });
  it('lee estado y página; ignora valores desconocidos', () => {
    expect(leerConsulta(p('estado=aprobada&pagina=3'))).toEqual({ pagina: 3, estado: 'aprobada' });
    expect(leerConsulta(p('estado=otro&pagina=0'))).toEqual({ pagina: 1, estado: 'pendiente' });
    expect(leerConsulta(p('pagina=abc'))).toEqual({ pagina: 1, estado: 'pendiente' });
  });
  it('serializa solo lo que se aparta del valor por defecto', () => {
    expect(consultaAUrl({ pagina: 1, estado: 'pendiente' })).toBe('');
    expect(consultaAUrl({ pagina: 2, estado: 'rechazada' })).toBe('?estado=rechazada&pagina=2');
    expect(rutaLista({ pagina: 1, estado: 'aprobada' })).toBe(
      '/administrador/fundaciones?estado=aprobada',
    );
    expect(rutaDetalle(7, { pagina: 2, estado: 'pendiente' })).toBe(
      '/administrador/fundaciones/7?pagina=2',
    );
  });
  it('el id debe ser un entero positivo', () => {
    expect(leerId('12')).toBe(12);
    for (const malo of ['0', '-1', 'x', '1.5', '', null, undefined])
      expect(leerId(malo)).toBeNull();
  });
});
