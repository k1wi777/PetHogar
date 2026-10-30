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
