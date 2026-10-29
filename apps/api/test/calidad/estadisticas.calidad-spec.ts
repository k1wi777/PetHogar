import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import { sembrarBase } from '../../src/database/seeds/seed';
import { sembrarDemo } from '../../src/database/seeds/seed.demo';
import { DonacionesService } from '../../src/modules/donaciones/donaciones.service';
import { PdfService } from '../../src/modules/reportes/pdf/pdf.service';
import { ADMIN, arrancarEntorno, type Entorno } from '../auth/helpers';
import {
  adoptanteConSesion,
  con,
  fundacionAprobada,
  type FundacionPrueba,
  relojSimulado,
} from '../seguimientos/helpers';

// V15 (estadísticas): cifras de /fundacion/estadisticas y /admin/estadisticas contra un conjunto
// CONOCIDO de datos, comparadas con un oráculo calculado en JavaScript (no con las mismas consultas),
// más los PDF con sus filtros, el tope de 1000 filas y la lectura consistente (REPEATABLE READ).
// Requiere Postgres (DATABASE_*) y Mailpit (SMTP_HOST/SMTP_PORT y MAILPIT_UI_PORT).

type Estado = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';
interface Solicitud {
  id: string;
  fundacion: 'A' | 'B';
  mascota: string;
  adoptante: number;
  /** Hora local de Bogotá (`YYYY-MM-DD HH:MM:SS`). */
  local: string;
  estado: Estado;
}
interface Adopcion {
  solicitud: string;
  entrega: string;
  estado: 'activa' | 'finalizada';
}
interface Seguimiento {
  adopcion: string;
  tipo: 'visita' | 'reporte';
  fecha: string;
  estado: 'programado' | 'realizado' | 'vencido' | 'cancelado';
  bienestar: 'bueno' | 'regular' | 'malo' | null;
}
interface Donacion {
  fundacion: 'A' | 'B';
  tipo: 'economica' | 'especie';
  monto: string | null;
  local: string;
}

const HOY = '2026-06-01';
const MASCOTAS: Record<string, { fundacion: 'A' | 'B'; especie: 'perro' | 'gato' }> = {
  m1: { fundacion: 'A', especie: 'perro' },
  m2: { fundacion: 'A', especie: 'perro' },
  m3: { fundacion: 'A', especie: 'perro' },
  m4: { fundacion: 'A', especie: 'gato' },
  m5: { fundacion: 'A', especie: 'gato' },
  b1: { fundacion: 'B', especie: 'perro' },
  b2: { fundacion: 'B', especie: 'perro' },
};
const SOLICITUDES: Solicitud[] = [
  {
    id: 's1',
    fundacion: 'A',
    mascota: 'm1',
    adoptante: 0,
    local: '2026-01-15 10:00:00',
    estado: 'aprobada',
  },
  {
    id: 's2',
    fundacion: 'A',
    mascota: 'm1',
    adoptante: 1,
    local: '2026-01-31 23:30:00',
    estado: 'rechazada',
  },
  {
    id: 's3',
    fundacion: 'A',
    mascota: 'm2',
    adoptante: 0,
    local: '2026-02-01 00:00:00',
    estado: 'aprobada',
  },
  {
    id: 's4',
    fundacion: 'A',
    mascota: 'm3',
    adoptante: 2,
    local: '2026-02-10 12:00:00',
    estado: 'pendiente',
  },
  {
    id: 's5',
    fundacion: 'A',
    mascota: 'm4',
    adoptante: 0,
    local: '2026-03-05 09:00:00',
    estado: 'cancelada',
  },
  {
    id: 's6',
    fundacion: 'A',
    mascota: 'm5',
    adoptante: 1,
    local: '2026-03-20 09:00:00',
    estado: 'aprobada',
  },
  {
    id: 'sb1',
    fundacion: 'B',
    mascota: 'b1',
    adoptante: 2,
    local: '2026-02-12 08:00:00',
    estado: 'aprobada',
  },
  {
    id: 'sb2',
    fundacion: 'B',
    mascota: 'b2',
    adoptante: 0,
    local: '2026-03-01 00:00:00',
    estado: 'pendiente',
  },
];
const ADOPCIONES: Adopcion[] = [
  { solicitud: 's1', entrega: '2026-01-20', estado: 'activa' },
  { solicitud: 's3', entrega: '2026-02-05', estado: 'activa' },
  { solicitud: 's6', entrega: '2026-03-22', estado: 'finalizada' },
  { solicitud: 'sb1', entrega: '2026-02-14', estado: 'activa' },
];
const SEGUIMIENTOS: Seguimiento[] = [
  { adopcion: 's1', tipo: 'reporte', fecha: '2026-02-01', estado: 'realizado', bienestar: 'bueno' },
  {
    adopcion: 's1',
    tipo: 'visita',
    fecha: '2026-03-01',
    estado: 'realizado',
    bienestar: 'regular',
  },
  { adopcion: 's1', tipo: 'reporte', fecha: '2026-04-01', estado: 'realizado', bienestar: 'malo' },
  { adopcion: 's1', tipo: 'visita', fecha: '2026-05-01', estado: 'programado', bienestar: null },
  { adopcion: 's1', tipo: 'reporte', fecha: '2026-05-15', estado: 'vencido', bienestar: null },
  { adopcion: 's1', tipo: 'visita', fecha: '2026-07-01', estado: 'programado', bienestar: null },
  { adopcion: 's1', tipo: 'visita', fecha: '2026-07-10', estado: 'cancelado', bienestar: null },
  {
    adopcion: 'sb1',
    tipo: 'reporte',
    fecha: '2026-03-01',
    estado: 'realizado',
    bienestar: 'bueno',
  },
];
const DONACIONES: Donacion[] = [
  { fundacion: 'A', tipo: 'economica', monto: '1000.50', local: '2026-01-31 23:59:59' },
  { fundacion: 'A', tipo: 'economica', monto: '2500.25', local: '2026-02-01 00:00:00' },
  { fundacion: 'A', tipo: 'especie', monto: null, local: '2026-02-15 10:00:00' },
  { fundacion: 'A', tipo: 'economica', monto: '0.25', local: '2026-03-10 08:00:00' },
  { fundacion: 'A', tipo: 'especie', monto: null, local: '2026-03-11 08:00:00' },
  { fundacion: 'B', tipo: 'economica', monto: '99999999.99', local: '2026-02-10 10:00:00' },
];

const centimos = (m: string): bigint => {
  const [e, d = ''] = m.split('.');
  return BigInt(e) * 100n + BigInt(d.padEnd(2, '0'));
};
const dinero = (c: bigint): string => `${c / 100n}.${String(c % 100n).padStart(2, '0')}`;

interface Filtro {
  fundacion: 'A' | 'B' | null;
  desde?: string;
  hasta?: string;
}
const enRango = (dia: string, f: Filtro): boolean =>
  (!f.desde || dia >= f.desde) && (!f.hasta || dia <= f.hasta);

/** Oráculo: cálculo independiente en JavaScript con las reglas del enunciado. */
function esperado(f: Filtro) {
  const delFiltro = (fundacion: 'A' | 'B'): boolean =>
    f.fundacion === null || f.fundacion === fundacion;
  const solicitudes = SOLICITUDES.filter(
    (s) => delFiltro(s.fundacion) && enRango(s.local.slice(0, 10), f),
  );
  const adopciones = ADOPCIONES.filter((a) => {
    const s = SOLICITUDES.find((x) => x.id === a.solicitud)!;
    return delFiltro(s.fundacion) && enRango(a.entrega, f);
  });
  const seguimientos = SEGUIMIENTOS.filter((g) => {
    const s = SOLICITUDES.find((x) => x.id === g.adopcion)!;
    return delFiltro(s.fundacion) && enRango(g.fecha, f);
  });
  const donaciones = DONACIONES.filter(
    (d) => delFiltro(d.fundacion) && enRango(d.local.slice(0, 10), f),
  );

  const cuenta = <K extends string>(claves: K[], valores: K[]) =>
    Object.fromEntries(claves.map((c) => [c, valores.filter((v) => v === c).length])) as Record<
      K,
      number
    >;
  const agrupar = <T>(items: T[], clave: (t: T) => string) => {
    const m = new Map<string, T[]>();
    for (const i of items) m.set(clave(i), [...(m.get(clave(i)) ?? []), i]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  };
  const economicas = donaciones.filter((d) => d.tipo === 'economica');
  const suma = (ds: Donacion[]): bigint => ds.reduce((t, d) => t + centimos(d.monto!), 0n);

  return {
    adopciones: {
      total: adopciones.length,
      porMes: agrupar(adopciones, (a) => a.entrega.slice(0, 7)).map(([mes, l]) => ({
        mes,
        cantidad: l.length,
      })),
      porEspecie: agrupar(
        adopciones,
        (a) => MASCOTAS[SOLICITUDES.find((x) => x.id === a.solicitud)!.mascota].especie,
      )
        .map(([especie, l]) => ({ especie, cantidad: l.length }))
        .sort((x, y) => y.cantidad - x.cantidad || x.especie.localeCompare(y.especie)),
    },
    solicitudes: {
      total: solicitudes.length,
      porEstado: cuenta(
        ['pendiente', 'aprobada', 'rechazada', 'cancelada'] as Estado[],
        solicitudes.map((s) => s.estado),
      ),
    },
    seguimientos: {
      total: seguimientos.length,
      porEstado: cuenta(
        ['programado', 'realizado', 'vencido', 'cancelado'] as const,
        // `programado` con fecha anterior a hoy cuenta como vencido (sin esperar a la tarea diaria).
        seguimientos.map((g) =>
          g.estado === 'programado' && g.fecha < HOY ? 'vencido' : g.estado,
        ),
      ),
      porBienestar: cuenta(
        ['bueno', 'regular', 'malo'] as const,
        seguimientos.flatMap((g) => (g.bienestar ? [g.bienestar] : [])),
      ),
    },
    donaciones: {
      total: donaciones.length,
      porMes: agrupar(donaciones, (d) => d.local.slice(0, 7)).map(([mes, l]) => ({
        mes,
        cantidad: l.length,
        monto: dinero(suma(l.filter((d) => d.tipo === 'economica'))),
      })),
      porTipo: {
        economica: { cantidad: economicas.length, monto: dinero(suma(economicas)) },
        especie: { cantidad: donaciones.length - economicas.length },
      },
    },
  };
}

describe('V15 — estadísticas y reportes: cifras exactas, filtros, PDF y lectura consistente', () => {
  let e: Entorno;
  let A: FundacionPrueba;
  let B: FundacionPrueba;
  let admin: string;
  const idDe = { A: 0, B: 0 };
  const capturas: { content: unknown[] }[] = [];

  const q = <T = unknown>(sql: string, p: unknown[] = []): Promise<T[]> => e.ds.query(sql, p);

  beforeAll(async () => {
    process.env.SEGUIMIENTOS_CRON_HABILITADO = 'false';
    e = await arrancarEntorno();
    relojSimulado(e).fijar(`${HOY}T17:00:00Z`);
    admin = (await e.sesion(ADMIN.email, ADMIN.clave)).access;
    A = await fundacionAprobada(e, 'Montería');
    B = await fundacionAprobada(e, 'Cereté');
    idDe.A = A.id;
    idDe.B = B.id;
    jest.spyOn(e.app.get(PdfService), 'generar').mockImplementation(async (def) => {
      capturas.push(def as never);
      return Buffer.from('%PDF-1.7\nsimulado\n%%EOF');
    });
  });
  afterAll(async () => {
    await e.cerrar();
  });

  async function cargarDatos(): Promise<void> {
    const adoptantes = [
      await adoptanteConSesion(e),
      await adoptanteConSesion(e),
      await adoptanteConSesion(e),
    ];
    const razas = new Map<string, number>();
    for (const r of await q<{ id: number; especie: string }>(
      `SELECT r.id, es.nombre AS especie FROM raza r JOIN especie es ON es.id = r.especie_id WHERE r.nombre = 'Mestizo'`,
    )) {
      razas.set(r.especie, r.id);
    }
    const mascotas = new Map<string, number>();
    for (const [clave, m] of Object.entries(MASCOTAS)) {
      const [{ id }] = await q<{ id: number }>(
        `INSERT INTO mascota (fundacion_id, raza_id, nombre, sexo, edad_meses, tamano, estado_salud)
         VALUES ($1, $2, $3, 'macho', 12, 'mediano', 'Sano') RETURNING id`,
        [idDe[m.fundacion], razas.get(m.especie), `Mascota ${clave}`],
      );
      mascotas.set(clave, id);
    }
    const solicitudes = new Map<string, number>();
    for (const s of SOLICITUDES) {
      const [{ id }] = await q<{ id: number }>(
        `INSERT INTO solicitud_adopcion (adoptante_id, mascota_id, fecha_solicitud, motivo, tipo_vivienda,
                                         tiene_otras_mascotas, formulario_url, estado)
         VALUES ($1, $2, ($3 || '-05')::timestamptz, 'Motivo', 'casa', false, 'privado/solicitudes/x.pdf', $4)
         RETURNING id`,
        [adoptantes[s.adoptante].id, mascotas.get(s.mascota), s.local, s.estado],
      );
      solicitudes.set(s.id, id);
    }
    const adopciones = new Map<string, number>();
    for (const a of ADOPCIONES) {
      const [{ id }] = await q<{ id: number }>(
        `INSERT INTO adopcion (solicitud_id, fecha_entrega, estado) VALUES ($1, $2, $3) RETURNING id`,
        [solicitudes.get(a.solicitud), a.entrega, a.estado],
      );
      adopciones.set(a.solicitud, id);
    }
    for (const g of SEGUIMIENTOS) {
      await q(
        `INSERT INTO seguimiento (adopcion_id, tipo, fecha_programada, fecha_realizada, estado, estado_bienestar)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          adopciones.get(g.adopcion),
          g.tipo,
          g.fecha,
          g.estado === 'realizado' ? g.fecha : null,
          g.estado,
          g.bienestar,
        ],
      );
    }
    for (const d of DONACIONES) {
      await q(
        `INSERT INTO donacion (fundacion_id, tipo, monto, descripcion_especie, nombre_donante, fecha)
         VALUES ($1, $2, $3, $4, 'Donante manual', ($5 || '-05')::timestamptz)`,
        [idDe[d.fundacion], d.tipo, d.monto, d.tipo === 'especie' ? 'Dos bultos' : null, d.local],
      );
    }
  }

  describe('con el seed demo (sin solicitudes ni donaciones)', () => {
    it('todo en 0 con todas las categorías presentes', async () => {
      const config = {
        adminEmail: ADMIN.email,
        adminPassword: ADMIN.clave,
        adminTelefono: '3000000000',
        demo: true,
        demoPassword: 'ClaveDemo12345',
      };
      await e.ds.transaction(async (m) => {
        await sembrarBase(m, config);
        await sembrarDemo(m, config);
      });
      const [{ id: demo }] = await q<{ id: number }>(
        `SELECT id FROM fundacion WHERE nit = '900000000-1'`,
      );
      const res = await con(e.get(`/admin/estadisticas?fundacionId=${demo}`), admin).expect(200);
      expect(res.body).toEqual({
        filtros: { fundacionId: demo, desde: null, hasta: null },
        adopciones: { total: 0, porMes: [], porEspecie: [] },
        solicitudes: {
          total: 0,
          porEstado: { pendiente: 0, aprobada: 0, rechazada: 0, cancelada: 0 },
        },
        seguimientos: {
          total: 0,
          porEstado: { programado: 0, realizado: 0, vencido: 0, cancelado: 0 },
          porBienestar: { bueno: 0, regular: 0, malo: 0 },
        },
        donaciones: {
          total: 0,
          porMes: [],
          porTipo: { economica: { cantidad: 0, monto: '0.00' }, especie: { cantidad: 0 } },
        },
      });
    });
  });

  describe('con un conjunto conocido de datos', () => {
    beforeAll(cargarDatos);

    const comparar = (cuerpo: Record<string, unknown>, f: Filtro): void => {
      const { adopciones, solicitudes, seguimientos, donaciones } = esperado(f);
      expect(cuerpo.adopciones).toEqual(adopciones);
      expect(cuerpo.solicitudes).toEqual(solicitudes);
      expect(cuerpo.seguimientos).toEqual(seguimientos);
      expect(cuerpo.donaciones).toEqual(donaciones);
    };
    const consulta = (f: Omit<Filtro, 'fundacion'>): string => {
      const p = new URLSearchParams();
      if (f.desde) p.set('desde', f.desde);
      if (f.hasta) p.set('hasta', f.hasta);
      return p.toString() ? `?${p}` : '';
    };

    const RANGOS: Omit<Filtro, 'fundacion'>[] = [
      {},
      { desde: '2026-02-01', hasta: '2026-02-28' },
      { desde: '2026-01-31', hasta: '2026-02-01' },
      { desde: '2026-03-01' },
      { hasta: '2026-01-31' },
      { desde: '2026-03-12', hasta: '2026-03-12' },
      { desde: '2030-01-01', hasta: '2030-12-31' },
    ];

    it.each(RANGOS)('la fundación A ve solo lo suyo con el rango %j', async (rango) => {
      const res = await con(e.get(`/fundacion/estadisticas${consulta(rango)}`), A.access).expect(
        200,
      );
      comparar(res.body, { fundacion: 'A', ...rango });
      expect(res.body.filtros).toEqual({
        fundacionId: A.id,
        desde: rango.desde ?? null,
        hasta: rango.hasta ?? null,
      });
    });

    it.each(RANGOS)('la fundación B ve solo lo suyo con el rango %j', async (rango) => {
      const res = await con(e.get(`/fundacion/estadisticas${consulta(rango)}`), B.access).expect(
        200,
      );
      comparar(res.body, { fundacion: 'B', ...rango });
    });

    it.each(RANGOS)('el administrador ve lo global con el rango %j', async (rango) => {
      const res = await con(e.get(`/admin/estadisticas${consulta(rango)}`), admin).expect(200);
      comparar(res.body, { fundacion: null, ...rango });
    });

    it.each(['A', 'B'] as const)('el administrador filtra por la fundación %s', async (f) => {
      const rango = { desde: '2026-02-01', hasta: '2026-03-31' };
      const res = await con(
        e.get(`/admin/estadisticas${consulta(rango)}&fundacionId=${idDe[f]}`),
        admin,
      ).expect(200);
      comparar(res.body, { fundacion: f, ...rango });
    });

    it('un cliente no puede pedir las cifras de otra fundación enviando fundacionId', async () => {
      const res = await con(e.get(`/fundacion/estadisticas?fundacionId=${B.id}`), A.access).expect(
        200,
      );
      comparar(res.body, { fundacion: 'A' });
    });

    it('rango invertido 400, fecha inválida 400, fundación inexistente 404, sin sesión 401, rol ajeno 403', async () => {
      await con(
        e.get('/fundacion/estadisticas?desde=2026-03-01&hasta=2026-02-01'),
        A.access,
      ).expect(400);
      await con(e.get('/admin/estadisticas?desde=2026-13-01'), admin).expect(400);
      await con(e.get('/admin/estadisticas?fundacionId=999999'), admin).expect(404);
      await e.get('/fundacion/estadisticas').expect(401);
      await con(e.get('/fundacion/estadisticas'), admin).expect(403);
      await con(e.get('/admin/estadisticas'), A.access).expect(403);
    });

    it('los valores sensibles del dataset no aparecen y los montos conservan los céntimos', async () => {
      const res = await con(e.get('/admin/estadisticas'), admin).expect(200);
      expect(res.body.donaciones.porTipo.economica.monto).toBe('100003500.99');
      expect(JSON.stringify(res.body)).not.toMatch(/privado\/|contrasena|email|documento/i);
    });

    describe('PDF con filtros (el contenido se captura antes de renderizar)', () => {
      const filasDe = (def: { content: unknown[] }): string[][] => {
        const tabla = def.content.find(
          (c) => typeof c === 'object' && c !== null && 'table' in (c as object),
        ) as { table: { body: { text?: string }[][] } } | undefined;
        return (tabla?.table.body.slice(1) ?? []).map((fila) =>
          fila.map((celda) => (typeof celda === 'string' ? celda : String(celda.text ?? ''))),
        );
      };
      const pdf = async (ruta: string, access = A.access) => {
        capturas.length = 0;
        await con(e.get(`/fundacion/reportes/${ruta}`), access).expect(200);
        return capturas[0];
      };

      it.each([
        ['aprobada', 3],
        ['pendiente', 1],
        ['rechazada', 1],
        ['cancelada', 1],
      ])('solicitudes.pdf?estado=%s lista solo las de la fundación y estado', async (estado, n) => {
        const def = await pdf(`solicitudes.pdf?estado=${estado}`);
        expect(filasDe(def)).toHaveLength(n);
        expect(JSON.stringify(def)).toContain(`Estado: ${estado}`);
      });

      it('solicitudes.pdf con rango respeta el día de Bogotá (31 de enero 23:30 sí, 1 de febrero 00:00 no)', async () => {
        const def = await pdf('solicitudes.pdf?desde=2026-01-31&hasta=2026-01-31');
        expect(filasDe(def).map((f) => f[0])).toEqual(['2026-01-31']);
      });

      it('seguimientos.pdf: vencido incluye al programado con fecha pasada; programado solo al futuro', async () => {
        const vencidos = filasDe(await pdf('seguimientos.pdf?estado=vencido')).map((f) => f[0]);
        expect(vencidos.sort()).toEqual(['2026-05-01', '2026-05-15']);
        const programados = filasDe(await pdf('seguimientos.pdf?estado=programado')).map(
          (f) => f[0],
        );
        expect(programados).toEqual(['2026-07-01']);
        expect(filasDe(await pdf('seguimientos.pdf'))).toHaveLength(7);
        expect(filasDe(await pdf('seguimientos.pdf', B.access))).toHaveLength(1);
      });

      it('donaciones.pdf: filtro por tipo y periodo, totales de todo el conjunto y monto exacto', async () => {
        const def = await pdf('donaciones.pdf?tipo=economica&desde=2026-02-01&hasta=2026-03-31');
        expect(filasDe(def)).toHaveLength(2);
        const texto = JSON.stringify(def);
        expect(texto).toContain('Económicas: 2 · $ 2.500,50');
        expect(texto).toContain('En especie: 0');
        expect(JSON.stringify(await pdf('donaciones.pdf', B.access))).toContain('$ 99.999.999,99');
      });

      it('sin filas, el PDF dice «Sin resultados»', async () => {
        const def = await pdf('solicitudes.pdf?desde=2030-01-01');
        expect(filasDe(def)).toHaveLength(0);
        expect(JSON.stringify(def)).toContain('Sin resultados');
      });

      it('con más de 1000 filas incluye las primeras 1000 y avisa del total real', async () => {
        const C = await fundacionAprobada(e, 'Lorica');
        await q(
          `INSERT INTO donacion (fundacion_id, tipo, monto, nombre_donante, fecha)
           SELECT $1, 'economica', 10.10, 'Donante ' || g, now() - (g || ' minutes')::interval
             FROM generate_series(1, 1005) g`,
          [C.id],
        );
        const def = await pdf('donaciones.pdf', C.access);
        expect(filasDe(def)).toHaveLength(1000);
        const texto = JSON.stringify(def);
        expect(texto).toContain('primeras 1000 de 1005');
        expect(texto).toContain('Económicas: 1005 · $ 10.150,50');
      });
    });
  });

  describe('lectura consistente (REPEATABLE READ)', () => {
    let fundacionId: number;
    const insertarDonacion = (): Promise<unknown> =>
      q(
        `INSERT INTO donacion (fundacion_id, tipo, monto, nombre_donante) VALUES ($1, 'economica', 1.00, 'Concurrente')`,
        [fundacionId],
      );

    beforeAll(async () => {
      fundacionId = (await fundacionAprobada(e, 'Sahagún')).id;
      for (let i = 0; i < 5; i++) await insertarDonacion();
    });

    it('control: sin instantánea, una escritura entre las dos lecturas las desacopla', async () => {
      const total = async (): Promise<number> =>
        Number(
          (
            await q<{ n: string }>('SELECT count(*) AS n FROM donacion WHERE fundacion_id = $1', [
              fundacionId,
            ])
          )[0].n,
        );
      const antes = await total();
      await insertarDonacion();
      expect(await total()).toBe(antes + 1);
    });

    it('dentro de la instantánea una escritura confirmada a mitad NO cambia la segunda lectura', async () => {
      const { InstantaneaService } = await import('../../src/common/database/instantanea.service');
      const instantanea = e.app.get(InstantaneaService);
      const contar = async (m: DataSource['manager']): Promise<number> =>
        Number(
          (
            await m.query('SELECT count(*) AS n FROM donacion WHERE fundacion_id = $1', [
              fundacionId,
            ])
          )[0].n,
        );
      const [primera, segunda] = await instantanea.leer(async (m) => {
        const a = await contar(m);
        await insertarDonacion(); // otra conexión, confirmada
        return [a, await contar(m)];
      });
      expect(segunda).toBe(primera);
      expect(await instantanea.leer(contar)).toBe(primera + 1);
    });

    it('bajo escrituras concurrentes, el total y los totales por tipo suman exactamente lo de la página', async () => {
      const donaciones = e.app.get(DonacionesService);
      const MAX_ESCRITURAS = 80; // con las 7 previas se mantiene bajo el límite de 100 de la página
      let escrituras = 0;
      const escritor = (async () => {
        while (escrituras < MAX_ESCRITURAS) {
          await insertarDonacion();
          escrituras++;
          await new Promise((r) => setTimeout(r, 3));
        }
      })();
      let lecturas = 0;
      const totalesVistos = new Set<number>();
      while (escrituras < MAX_ESCRITURAS) {
        const r = await donaciones.listar(fundacionId, { page: 1, limit: 100 } as never);
        expect(r.data).toHaveLength(r.total);
        expect(r.totales.economica.cantidad).toBe(r.total);
        expect(r.totales.economica.monto).toBe(`${r.total}.00`);
        totalesVistos.add(r.total);
        lecturas++;
      }
      await escritor;
      // La prueba solo vale si realmente hubo escrituras entre lecturas.
      expect(lecturas).toBeGreaterThan(5);
      expect(totalesVistos.size).toBeGreaterThan(1);
    });
  });
});
