import { clausulaDeReporte, ReportesRepository } from './reportes.repository';

describe('clausulaDeReporte', () => {
  it('sin filtros no restringe', () => {
    expect(clausulaDeReporte({}, 'm."fundacion_id"', 'x."f"', 'date')).toEqual({
      where: 'TRUE',
      parametros: [],
    });
  });

  it('la fundación va siempre como parámetro y primero', () => {
    const c = clausulaDeReporte({ fundacionId: 3 }, 'm."fundacion_id"', 'x."f"', 'date');
    expect(c).toEqual({ where: 'm."fundacion_id" = $1', parametros: [3] });
  });

  it('columnas date: rango inclusivo con fechas de día', () => {
    const c = clausulaDeReporte(
      { fundacionId: 3, desde: '2026-10-01', hasta: '2026-10-31' },
      'm."fundacion_id"',
      'a."fecha_entrega"',
      'date',
    );
    expect(c.where).toBe(
      'm."fundacion_id" = $1 AND a."fecha_entrega" >= $2::date AND a."fecha_entrega" <= $3::date',
    );
    expect(c.parametros).toEqual([3, '2026-10-01', '2026-10-31']);
  });

  it('columnas timestamptz: intervalo semiabierto con instantes', () => {
    const c = clausulaDeReporte(
      {
        desdeInstante: new Date('2026-10-01T05:00:00Z'),
        hastaExclusivo: new Date('2026-11-01T05:00:00Z'),
      },
      'm."fundacion_id"',
      's."fecha_solicitud"',
      'timestamptz',
    );
    expect(c.where).toBe(
      's."fecha_solicitud" >= $1::timestamptz AND s."fecha_solicitud" < $2::timestamptz',
    );
    expect(c.parametros).toEqual(['2026-10-01T05:00:00.000Z', '2026-11-01T05:00:00.000Z']);
  });
});

describe('ReportesRepository', () => {
  it('toda consulta usa el manager recibido y pasa la fundación como parámetro, nunca interpolada', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };
    const repo = new ReportesRepository();
    await repo.adopcionesPorMes({ fundacionId: 9 }, manager as never);
    await repo.adopcionesPorEspecie({ fundacionId: 9 }, manager as never);
    await repo.solicitudesPorEstado({ fundacionId: 9 }, manager as never);
    await repo.seguimientosPorEstado({ fundacionId: 9 }, '2026-10-29', manager as never);
    await repo.seguimientosPorBienestar({ fundacionId: 9 }, manager as never);
    await repo.donacionesPorMes({ fundacionId: 9 }, manager as never);
    await repo.donacionesPorTipo({ fundacionId: 9 }, manager as never);
    expect(manager.query).toHaveBeenCalledTimes(7);
    for (const [sql, parametros] of manager.query.mock.calls) {
      expect(sql).toMatch(/"fundacion_id" = \$1/);
      expect(sql).not.toMatch(/= 9\b/);
      expect(parametros[0]).toBe(9);
    }
  });

  it('existeFundacion', async () => {
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([]),
    };
    const repo = new ReportesRepository();
    await expect(repo.existeFundacion(1, manager as never)).resolves.toBe(true);
    await expect(repo.existeFundacion(2, manager as never)).resolves.toBe(false);
  });
});

describe('consultas de listados', () => {
  const manager = () => ({ query: jest.fn().mockResolvedValue([{ total: 0 }]) });
  const filtro = { fundacionId: 9, desde: '2026-10-01' };

  it('solicitudes y seguimientos: fundación como parámetro, tope numérico y estado parametrizado', async () => {
    const m = manager();
    const repo = new ReportesRepository();
    await repo.listarSolicitudes(filtro, 'pendiente' as never, 1000, m as never);
    await repo.listarSeguimientos(filtro, 'vencido' as never, '2026-10-29', 1000, m as never);
    const [sqlSol, parSol] = m.query.mock.calls[0];
    expect(sqlSol).toContain('LIMIT 1000');
    expect(sqlSol).toContain(`m."fundacion_id" = $1`);
    expect(parSol).toEqual([9, 'pendiente']);
    const [sqlSeg, parSeg] = m.query.mock.calls[1];
    expect(parSeg).toEqual([9, '2026-10-01', '2026-10-29', 'vencido']);
    // El vencido se calcula con la fecha de hoy (parámetro 3), el estado pedido es el 4.
    expect(sqlSeg).toContain(`< $3::date THEN 'vencido'`);
    expect(sqlSeg).toMatch(/= \$4/);
  });

  it('seguimientos sin estado no añade condición de estado', async () => {
    const m = manager();
    await new ReportesRepository().contarSeguimientos(
      { fundacionId: 9 },
      undefined,
      '2026-10-29',
      m as never,
    );
    // Sin estado, el conteo no recibe `hoy`: un parámetro sin usar hace fallar a Postgres.
    expect(m.query.mock.calls[0][1]).toEqual([9]);
  });

  it('donaciones: reutiliza la cláusula de GET /fundacion/donaciones (fundación primero y tipo)', async () => {
    const m = manager();
    await new ReportesRepository().listarDonaciones(
      9,
      filtro,
      'economica' as never,
      1000,
      m as never,
    );
    const [sql, parametros] = m.query.mock.calls[0];
    expect(sql).toContain('LIMIT 1000');
    expect(sql).toContain(`"fundacion_id" = $1`);
    expect(parametros[0]).toBe(9);
    expect(parametros[parametros.length - 1]).toBe('economica');
  });
});
