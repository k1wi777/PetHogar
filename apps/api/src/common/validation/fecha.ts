/** El proyecto es colombiano y no hay multi-zona: «hoy» siempre es el día en Bogotá, no el del servidor. */
export const ZONA_HORARIA = 'America/Bogota';

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

const formateador = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `YYYY-MM-DD` que existe en el calendario (rechaza `2026-02-30` o `2026-13-01`). */
export function esFechaCalendario(valor: string): boolean {
  const partes = FORMATO.exec(valor);
  if (!partes) return false;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCFullYear(anio); // años < 100 no se desplazan a 19xx
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}

/** Día actual en Bogotá como `YYYY-MM-DD`. */
export function hoyEnBogota(ahora: Date): string {
  return formateador.format(ahora);
}

/**
 * Instante de las 00:00 de Bogotá de un día `YYYY-MM-DD`. Colombia no usa horario de verano, así
 * que el desfase fijo de -05:00 es exacto.
 */
export function inicioDelDiaEnBogota(fecha: string): Date {
  return new Date(`${fecha}T00:00:00-05:00`);
}

/** Días enteros entre dos fechas `YYYY-MM-DD` (positivo si `hasta` es posterior a `desde`). */
export function diasEntre(desde: string, hasta: string): number {
  const dia = 86_400_000;
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / dia);
}
