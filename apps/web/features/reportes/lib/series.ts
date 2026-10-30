import { formatearFecha } from '@/shared/lib/fechas';
import { formatearMonto } from '@/shared/lib/monto';
import type { EstadisticasDto, TipoReporte } from '../types';

export type TipoGrafico = 'columnas' | 'barras' | 'dona';

/** Una fila de la serie: la gráfica la dibuja y la tabla equivalente la muestra (misma fuente). */
export interface FilaSerie {
  clave: string;
  etiqueta: string;
  /** Etiqueta breve para el eje de la gráfica (la tabla usa `etiqueta`). */
  etiquetaCorta: string;
  /** Magnitud de dibujo (cantidad; en donaciones por mes, la magnitud del monto). Nunca se muestra ni se suma. */
  valor: number;
  /** Texto con el valor que se rotula en la gráfica («3», «$ 50.000»). */
  valorTexto: string;
  /** Solo en las composiciones circulares: entero, y todas las filas suman 100. */
  porcentaje?: number;
  /** Celdas de la tabla, en el orden de `columnas`. */
  celdas: string[];
}

export interface Serie {
  id: string;
  titulo: string;
  /** Frase para lectores de pantalla con el total y el valor más alto. */
  descripcion: string;
  tipo: TipoGrafico;
  columnas: string[];
  filas: FilaSerie[];
  /** Suma de los conteos del servidor; 0 ⇒ no hay datos (estado vacío en lugar de gráfica). */
  total: number;
  /** Hay algo que dibujar (en una dona, al menos un valor distinto de cero). */
  graficable: boolean;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** `2026-10` → «octubre de 2026» a partir de la cadena, sin `Date` (no hay desfase de zona). */
export function mesEnTexto(mes: string): string {
  const texto = formatearFecha(`${mes}-01`);
  return texto === `${mes}-01` ? mes : texto.replace(/^\d+ de /, '');
}

const ABREVIATURAS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** `2026-10` → «oct 2026». */
export function mesCorto(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  const abreviatura = m ? ABREVIATURAS[Number(m[2]) - 1] : undefined;
  return m && abreviatura ? `${abreviatura} ${m[1]}` : mes;
}

/**
 * Porcentajes enteros que suman exactamente 100 (método del mayor resto). Con total 0 devuelve
 * ceros: la serie no se dibuja.
 */
export function porcentajes(valores: readonly number[]): number[] {
  const total = valores.reduce((a, b) => a + b, 0);
  if (total <= 0) return valores.map(() => 0);
  const exactos = valores.map((v) => (v * 100) / total);
  const base = exactos.map(Math.floor);
  let faltan = 100 - base.reduce((a, b) => a + b, 0);
  const orden = exactos
    .map((e, i) => ({ i, resto: e - Math.floor(e) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of orden) {
    if (faltan <= 0) break;
    base[i]! += 1;
    faltan -= 1;
  }
  return base;
}

/** Fila de una composición: categoría, cantidad y porcentaje (el dibujo usa la cantidad). */
function composicion(
  id: string,
  titulo: string,
  categorias: ReadonlyArray<{ clave: string; etiqueta: string; cantidad: number }>,
  rotulo: [string, string],
): Serie {
  const pct = porcentajes(categorias.map((c) => c.cantidad));
  const total = categorias.reduce((a, c) => a + c.cantidad, 0);
  const filas = categorias.map<FilaSerie>((c, i) => ({
    clave: c.clave,
    etiqueta: c.etiqueta,
    etiquetaCorta: c.etiqueta,
    valor: c.cantidad,
    valorTexto: String(c.cantidad),
    porcentaje: pct[i],
    celdas: [c.etiqueta, String(c.cantidad), `${pct[i]} %`],
  }));
  const mayor = [...categorias].sort((a, b) => b.cantidad - a.cantidad)[0];
  return {
    id,
    titulo,
    descripcion:
      total === 0
        ? `${titulo}: no hay datos en este rango.`
        : `${titulo}: ${plural(total, rotulo[0], rotulo[1])} en total; el mayor grupo es ${mayor!.etiqueta.toLowerCase()} con ${mayor!.cantidad}.`,
    tipo: 'dona',
    columnas: ['Categoría', 'Cantidad', 'Porcentaje'],
    filas,
    total,
    graficable: filas.some((f) => f.valor > 0),
  };
}

const mesesOrdenados = <T extends { mes: string }>(filas: readonly T[]) =>
  [...filas].sort((a, b) => a.mes.localeCompare(b.mes));

export function serieAdopcionesPorMes(d: EstadisticasDto): Serie {
  const meses = mesesOrdenados(d.adopciones.porMes);
  const total = meses.reduce((a, f) => a + f.cantidad, 0);
  const mayor = [...meses].sort((a, b) => b.cantidad - a.cantidad)[0];
  return {
    id: 'adopciones-por-mes',
    titulo: 'Adopciones por mes',
    descripcion:
      total === 0
        ? 'Adopciones por mes: no hay datos en este rango.'
        : `Adopciones por mes: ${plural(total, 'adopción', 'adopciones')} en ${plural(meses.length, 'mes', 'meses')} con datos; el mes con más fue ${mesEnTexto(mayor!.mes)} con ${mayor!.cantidad}.`,
    tipo: 'columnas',
    columnas: ['Mes', 'Adopciones'],
    filas: meses.map((f) => ({
      clave: f.mes,
      etiqueta: mesEnTexto(f.mes),
      etiquetaCorta: mesCorto(f.mes),
      valor: f.cantidad,
      valorTexto: String(f.cantidad),
      celdas: [mesEnTexto(f.mes), String(f.cantidad)],
    })),
    total,
    graficable: total > 0,
  };
}

export function serieAdopcionesPorEspecie(d: EstadisticasDto): Serie {
  // Orden estable: más adopciones primero y, a igualdad, por nombre.
  const especies = [...d.adopciones.porEspecie].sort(
    (a, b) => b.cantidad - a.cantidad || a.especie.localeCompare(b.especie, 'es'),
  );
  const total = especies.reduce((a, f) => a + f.cantidad, 0);
  return {
    id: 'adopciones-por-especie',
    titulo: 'Adopciones por especie',
    descripcion:
      total === 0
        ? 'Adopciones por especie: no hay datos en este rango.'
        : `Adopciones por especie: ${plural(total, 'adopción', 'adopciones')}; la especie con más es ${especies[0]!.especie.toLowerCase()} con ${especies[0]!.cantidad}.`,
    tipo: 'barras',
    columnas: ['Especie', 'Adopciones'],
    filas: especies.map((f) => ({
      clave: f.especie,
      etiqueta: f.especie,
      etiquetaCorta: f.especie,
      valor: f.cantidad,
      valorTexto: String(f.cantidad),
      celdas: [f.especie, String(f.cantidad)],
    })),
    total,
    graficable: total > 0,
  };
}

export function serieSolicitudes(d: EstadisticasDto): Serie {
  const e = d.solicitudes.porEstado;
  return composicion(
    'solicitudes-por-estado',
    'Solicitudes por estado',
    [
      { clave: 'pendiente', etiqueta: 'Pendiente', cantidad: e.pendiente },
      { clave: 'aprobada', etiqueta: 'Aprobada', cantidad: e.aprobada },
      { clave: 'rechazada', etiqueta: 'Rechazada', cantidad: e.rechazada },
      { clave: 'cancelada', etiqueta: 'Cancelada', cantidad: e.cancelada },
    ],
    ['solicitud', 'solicitudes'],
  );
}

export function serieSeguimientos(d: EstadisticasDto): Serie {
  const e = d.seguimientos.porEstado;
  return composicion(
    'seguimientos-por-estado',
    'Seguimientos por estado',
    [
      { clave: 'programado', etiqueta: 'Programado', cantidad: e.programado },
      { clave: 'realizado', etiqueta: 'Realizado', cantidad: e.realizado },
      { clave: 'vencido', etiqueta: 'Vencido', cantidad: e.vencido },
      { clave: 'cancelado', etiqueta: 'Cancelado', cantidad: e.cancelado },
    ],
    ['seguimiento', 'seguimientos'],
  );
}

export function serieBienestar(d: EstadisticasDto): Serie {
  const e = d.seguimientos.porBienestar;
  return composicion(
    'seguimientos-por-bienestar',
    'Seguimientos por bienestar',
    [
      { clave: 'bueno', etiqueta: 'Bueno', cantidad: e.bueno },
      { clave: 'regular', etiqueta: 'Regular', cantidad: e.regular },
      { clave: 'malo', etiqueta: 'Malo', cantidad: e.malo },
    ],
    ['seguimiento valorado', 'seguimientos valorados'],
  );
}

/** Aportes por mes: la barra dibuja la magnitud del monto económico; la tabla trae también la cantidad. */
export function serieDonacionesPorMes(d: EstadisticasDto): Serie {
  const meses = mesesOrdenados(d.donaciones.porMes);
  const total = meses.reduce((a, f) => a + f.cantidad, 0);
  const filas = meses.map<FilaSerie>((f) => ({
    clave: f.mes,
    etiqueta: mesEnTexto(f.mes),
    etiquetaCorta: mesCorto(f.mes),
    // Solo magnitud de dibujo: el monto mostrado sale de la cadena del servidor (R16).
    valor: Number(f.monto),
    valorTexto: formatearMonto(f.monto),
    celdas: [mesEnTexto(f.mes), String(f.cantidad), formatearMonto(f.monto)],
  }));
  const mayor = [...meses].sort((a, b) => Number(b.monto) - Number(a.monto))[0];
  return {
    id: 'donaciones-por-mes',
    titulo: 'Donaciones por mes (monto económico)',
    descripcion:
      total === 0
        ? 'Donaciones por mes: no hay datos en este rango.'
        : `Donaciones por mes: ${plural(total, 'aporte', 'aportes')} en ${plural(meses.length, 'mes', 'meses')} con datos; el mes con más monto fue ${mesEnTexto(mayor!.mes)} con ${formatearMonto(mayor!.monto)}.`,
    tipo: 'columnas',
    columnas: ['Mes', 'Aportes', 'Monto económico'],
    filas,
    total,
    graficable: filas.some((f) => f.valor > 0),
  };
}

export function serieDonacionesPorTipo(d: EstadisticasDto): Serie {
  const { economica, especie } = d.donaciones.porTipo;
  const base = composicion(
    'donaciones-por-tipo',
    'Donaciones por tipo',
    [
      { clave: 'economica', etiqueta: 'Económica', cantidad: economica.cantidad },
      { clave: 'especie', etiqueta: 'En especie', cantidad: especie.cantidad },
    ],
    ['aporte', 'aportes'],
  );
  // Los montos van solo en la tabla (no se mezclan unidades en la dona).
  return {
    ...base,
    columnas: ['Tipo', 'Cantidad', 'Porcentaje', 'Monto'],
    filas: base.filas.map((f) => ({
      ...f,
      celdas: [...f.celdas, f.clave === 'economica' ? formatearMonto(economica.monto) : '—'],
    })),
  };
}

/** Las series de cada tipo de reporte, en el orden en que se muestran. */
export function seriesDe(reporte: TipoReporte, d: EstadisticasDto): Serie[] {
  switch (reporte) {
    case 'adopciones':
      return [serieAdopcionesPorMes(d), serieAdopcionesPorEspecie(d)];
    case 'solicitudes':
      return [serieSolicitudes(d)];
    case 'seguimientos':
      return [serieSeguimientos(d), serieBienestar(d)];
    case 'donaciones':
      return [serieDonacionesPorMes(d), serieDonacionesPorTipo(d)];
  }
}
