import { ROLES, type ConsultaUsuarios, type RolUsuario } from '../types';
import { MAX_BUSQUEDA } from '../schemas/filtros';

interface Parametros {
  get(nombre: string): string | null;
}

const texto = (v: string | null): string | undefined => {
  const t = v?.trim();
  return t ? t.slice(0, MAX_BUSQUEDA) : undefined;
};

/** Búsqueda, rol y página de la URL; un valor desconocido o inválido se ignora. */
export function leerConsulta(params: Parametros): ConsultaUsuarios {
  const bruto = params.get('pagina');
  const pagina = bruto && /^\d{1,6}$/.test(bruto) ? Number(bruto) : 1;
  const rol = params.get('rol');
  return {
    pagina: pagina >= 1 ? pagina : 1,
    nombre: texto(params.get('nombre')),
    correo: texto(params.get('correo')),
    rol: ROLES.includes(rol as RolUsuario) ? (rol as RolUsuario) : undefined,
  };
}

/** `?nombre=…&correo=…&rol=…&pagina=2`, o cadena vacía con los valores por defecto. */
export function consultaAUrl(consulta: ConsultaUsuarios): string {
  const partes = new URLSearchParams();
  if (consulta.nombre) partes.set('nombre', consulta.nombre);
  if (consulta.correo) partes.set('correo', consulta.correo);
  if (consulta.rol) partes.set('rol', consulta.rol);
  if (consulta.pagina > 1) partes.set('pagina', String(consulta.pagina));
  const t = partes.toString();
  return t ? `?${t}` : '';
}
