import type { ConsultaNotificaciones, FiltroLeida } from '../types';

interface Parametros {
  get(nombre: string): string | null;
}

const FILTRO_DE_PARAMETRO: Readonly<Record<string, FiltroLeida>> = {
  true: 'leidas',
  false: 'no-leidas',
};

/** Filtro y página de la URL (`?leida=true|false&pagina=N`); un valor inválido se ignora. */
export function leerConsulta(params: Parametros): ConsultaNotificaciones {
  const bruto = params.get('pagina');
  const pagina = bruto && /^\d{1,6}$/.test(bruto) ? Number(bruto) : 1;
  const leida = params.get('leida');
  const filtro =
    leida !== null && Object.hasOwn(FILTRO_DE_PARAMETRO, leida)
      ? FILTRO_DE_PARAMETRO[leida]!
      : 'todas';
  return { pagina: pagina >= 1 ? pagina : 1, filtro };
}

/** `?leida=false&pagina=2`, o cadena vacía con los valores por defecto. */
export function consultaAUrl(consulta: ConsultaNotificaciones): string {
  const partes = new URLSearchParams();
  if (consulta.filtro === 'leidas') partes.set('leida', 'true');
  if (consulta.filtro === 'no-leidas') partes.set('leida', 'false');
  if (consulta.pagina > 1) partes.set('pagina', String(consulta.pagina));
  const texto = partes.toString();
  return texto ? `?${texto}` : '';
}
