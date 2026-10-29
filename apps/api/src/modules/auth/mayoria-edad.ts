export const EDAD_MINIMA = 18;

/** `fechaNacimiento` en formato `YYYY-MM-DD`; compara por fecha civil (UTC), sin husos horarios. */
export function esMayorDeEdad(fechaNacimiento: string, ahora: Date): boolean {
  const [anio, mes, dia] = fechaNacimiento.split('-').map(Number);
  let edad = ahora.getUTCFullYear() - anio;
  const todaviaNoCumple =
    ahora.getUTCMonth() + 1 < mes || (ahora.getUTCMonth() + 1 === mes && ahora.getUTCDate() < dia);
  if (todaviaNoCumple) edad -= 1;
  return edad >= EDAD_MINIMA;
}
