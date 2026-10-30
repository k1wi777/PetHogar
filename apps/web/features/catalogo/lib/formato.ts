/** «2026-03-05» → «5 de marzo de 2026» (sin desplazamientos por zona horaria). */
export function fechaLarga(fecha: string): string {
  const coincide = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!coincide) return fecha;
  const fechaUtc = new Date(
    Date.UTC(Number(coincide[1]), Number(coincide[2]) - 1, Number(coincide[3])),
  );
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(fechaUtc);
}
