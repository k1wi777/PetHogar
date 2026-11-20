import { describe, expect, it } from 'vitest';
import type { Pagina } from '@/shared/api/tipos';
import type { SeguimientoDeLista } from '../types';
import { resumirSeguimientos } from './seguimientos';

function seg(p: Partial<SeguimientoDeLista> & { id: number }): SeguimientoDeLista {
  return {
    tipo: 'visita',
    fechaProgramada: '2026-12-01',
    estado: 'programado',
    vencido: false,
    mascota: { id: 1, nombre: 'Luna' },
    ...p,
  };
}
const pagina = (data: SeguimientoDeLista[], total = data.length): Pagina<SeguimientoDeLista> => ({
  data,
  total,
  page: 1,
  limit: 100,
});

describe('resumirSeguimientos', () => {
  it('cuenta los vencidos por estado con el total exacto de la API', () => {
    const r = resumirSeguimientos(
      pagina([seg({ id: 1, estado: 'vencido', vencido: true })], 7),
      pagina([]),
    );
    expect(r.vencidos).toBe(7);
    expect(r.programados).toBe(0);
  });

  it('suma los programados ya pasados de fecha como vencidos y los resta de programados', () => {
    const r = resumirSeguimientos(
      pagina([]),
      pagina([
        seg({ id: 2, fechaProgramada: '2026-10-01', vencido: true }),
        seg({ id: 3, fechaProgramada: '2026-12-10' }),
        seg({ id: 4, fechaProgramada: '2026-12-05' }),
      ]),
    );
    expect(r.vencidos).toBe(1);
    expect(r.programados).toBe(2);
    expect(r.parcial).toBe(false);
  });

  it('ordena vencidos primero (el más antiguo antes) y luego los próximos por fecha', () => {
    const r = resumirSeguimientos(
      pagina([seg({ id: 1, estado: 'vencido', vencido: true, fechaProgramada: '2026-10-20' })]),
      pagina([
        seg({ id: 2, fechaProgramada: '2026-12-10' }),
        seg({ id: 3, fechaProgramada: '2026-10-01', vencido: true }),
        seg({ id: 4, fechaProgramada: '2026-12-05' }),
      ]),
    );
    expect(r.destacados.map((s) => s.id)).toEqual([3, 1, 4, 2]);
  });

  it('respeta el tope de filas destacadas', () => {
    const programados = Array.from({ length: 8 }, (_, i) =>
      seg({ id: i + 1, fechaProgramada: `2026-12-${String(i + 10)}` }),
    );
    const r = resumirSeguimientos(pagina([]), pagina(programados), 3);
    expect(r.destacados).toHaveLength(3);
  });

  it('marca el cálculo como parcial si hay más programados que los pedidos', () => {
    const r = resumirSeguimientos(pagina([]), pagina([seg({ id: 1 })], 150));
    expect(r.parcial).toBe(true);
    expect(r.programados).toBe(150);
  });
});
