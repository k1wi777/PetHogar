import type { Sexo, Tamano, TipoHistorial } from '../types';

function meses(n: number): string {
  return n === 1 ? '1 mes' : `${n} meses`;
}

function anios(n: number): string {
  return n === 1 ? '1 año' : `${n} años`;
}

/** Edad legible. Compacta (tarjeta): años enteros desde los 24 meses. Detallada (ficha): años y meses. */
export function formatearEdad(edadMeses: number, detallada = false): string {
  const total = Math.max(0, Math.floor(edadMeses));
  if (total === 0) return 'Menos de un mes';
  if (detallada) {
    if (total < 12) return meses(total);
    const resto = total % 12;
    const base = anios(Math.floor(total / 12));
    return resto ? `${base} y ${meses(resto)}` : base;
  }
  return total < 24 ? meses(total) : anios(Math.floor(total / 12));
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const etiquetaTamano = (t: Tamano): string => capitalizar(t);
export const etiquetaSexo = (s: Sexo): string => capitalizar(s);

const TIPOS: Readonly<Record<TipoHistorial, string>> = {
  vacuna: 'Vacuna',
  desparasitacion: 'Desparasitación',
  cirugia: 'Cirugía',
  consulta: 'Consulta',
};

export const etiquetaTipoHistorial = (t: TipoHistorial): string => TIPOS[t] ?? capitalizar(t);

/** «2026-03-05» → «5 de marzo de 2026» (sin desplazamientos por zona horaria). */
export function fechaLarga(fecha: string): string {
  const coincide = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!coincide) return fecha;
  const fechaUtc = new Date(
    Date.UTC(Number(coincide[1]), Number(coincide[2]) - 1, Number(coincide[3])),
  );
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(fechaUtc);
}
