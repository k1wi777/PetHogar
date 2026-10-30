const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * «15 de diciembre de 2026» a partir de `AAAA-MM-DD` o de un ISO con hora.
 * Se lee por partes (sin `new Date(texto)`) para evitar el desfase de zona horaria
 * en las fechas sin hora. Un valor irreconocible se devuelve tal cual.
 */
export function formatearFecha(valor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (!m) return valor;
  const dia = Number(m[3]);
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return valor;
  const solo = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  if (solo) return `${dia} de ${mes} de ${m[1]}`;
  // Instante con hora: se muestra en la zona del navegador.
  const f = new Date(valor);
  if (Number.isNaN(f.getTime())) return `${dia} de ${mes} de ${m[1]}`;
  return `${f.getDate()} de ${MESES[f.getMonth()]} de ${f.getFullYear()}`;
}

const ZONA_BOGOTA = 'America/Bogota';
const FORMATO_DIA_BOGOTA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_BOGOTA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Día de calendario (`AAAA-MM-DD`) del instante dado en Bogotá, como lo evalúa el backend. Es la
 * única fuente de «hoy»: nunca se usa la zona del navegador ni `toISOString()`.
 */
export function hoyEnBogota(ahora: Date = new Date()): string {
  const partes = Object.fromEntries(
    FORMATO_DIA_BOGOTA.formatToParts(ahora).map((p) => [p.type, p.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

/** «15 de diciembre de 2026, 3:30 p. m.» de un instante, en hora de Bogotá. */
export function formatearFechaBogota(instante: string): string {
  const f = new Date(instante);
  if (Number.isNaN(f.getTime())) return instante;
  const dia = formatearFecha(hoyEnBogota(f));
  const hora = new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA_BOGOTA,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(f);
  return `${dia}, ${hora}`;
}

/** `AAAA-MM-DD` que existe en el calendario (rechaza `2026-02-30`). */
export function esFechaReal(valor: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  return f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia;
}

/** Resta días a una fecha `AAAA-MM-DD` operando en UTC (sin zona local de por medio). */
export function restarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d - dias)).toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  return restarDias(fecha, -dias);
}

export function primerDiaDelMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

export function ultimoDiaDelMes(fecha: string): string {
  const [a, m] = fecha.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
