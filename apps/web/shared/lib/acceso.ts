import type { Rol } from '@/shared/api/tipos';

/** Reglas de acceso por rol y menús de cada panel: datos puros usados por el proxy, la guarda y el shell. */
export const PANEL_POR_ROL: Readonly<Record<Rol, string>> = {
  adoptante: '/adoptante',
  fundacion: '/fundacion',
  administrador: '/administrador',
};

export const NOMBRE_PANEL: Readonly<Record<Rol, string>> = {
  adoptante: 'Panel del adoptante',
  fundacion: 'Panel de la fundación',
  administrador: 'Panel de administración',
};

export interface OpcionMenu {
  /** Ruta completa. */
  href: string;
  etiqueta: string;
  /** Texto de la página placeholder. */
  descripcion: string;
}

const op = (href: string, etiqueta: string, descripcion: string): OpcionMenu => ({
  href,
  etiqueta,
  descripcion,
});

export const MENU_POR_ROL: Readonly<Record<Rol, readonly OpcionMenu[]>> = {
  adoptante: [
    op('/adoptante', 'Inicio', 'Tu resumen de solicitudes y adopciones.'),
    op(
      '/adoptante/solicitudes',
      'Mis solicitudes',
      'Aquí verás el estado de tus solicitudes de adopción.',
    ),
    op('/adoptante/adopciones', 'Mis adopciones', 'Aquí verás tus adopciones y sus seguimientos.'),
    op('/adoptante/donar', 'Donar', 'Aquí podrás registrar una donación a una fundación.'),
    op('/adoptante/notificaciones', 'Notificaciones', 'Aquí verás tus avisos.'),
  ],
  fundacion: [
    op('/fundacion', 'Resumen', 'El resumen de tu fundación.'),
    op('/fundacion/mascotas', 'Mis mascotas', 'Aquí gestionarás las mascotas de tu fundación.'),
    op(
      '/fundacion/solicitudes',
      'Solicitudes recibidas',
      'Aquí evaluarás las solicitudes de adopción.',
    ),
    op(
      '/fundacion/adopciones',
      'Adopciones y seguimientos',
      'Aquí darás seguimiento a las adopciones.',
    ),
    op('/fundacion/donaciones', 'Donaciones', 'Aquí verás y registrarás las donaciones.'),
    op('/fundacion/reportes', 'Reportes', 'Aquí generarás tus reportes y estadísticas.'),
    op('/fundacion/notificaciones', 'Notificaciones', 'Aquí verás tus avisos.'),
  ],
  administrador: [
    op('/administrador', 'Resumen', 'Las estadísticas globales de la plataforma.'),
    op(
      '/administrador/fundaciones',
      'Fundaciones por validar',
      'Aquí validarás las fundaciones registradas.',
    ),
    op('/administrador/usuarios', 'Usuarios', 'Aquí gestionarás las cuentas de usuario.'),
    op('/administrador/reportes', 'Reportes', 'Aquí consultarás los reportes de la plataforma.'),
    op('/administrador/notificaciones', 'Notificaciones', 'Aquí verás tus avisos.'),
  ],
};

export const RUTA_INGRESAR = '/ingresar';
export const RUTA_SIN_PERMISO = '/403';

const ROLES = Object.keys(PANEL_POR_ROL) as Rol[];

export function esRolConocido(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as string[]).includes(valor);
}

/** Rol dueño del panel al que pertenece la ruta, o `null` si no es una ruta de panel. */
export function rolDelPanel(pathname: string): Rol | null {
  for (const rol of ROLES) {
    const prefijo = PANEL_POR_ROL[rol];
    if (pathname === prefijo || pathname.startsWith(`${prefijo}/`)) return rol;
  }
  return null;
}

/** Solo se aceptan rutas internas como destino tras iniciar sesión (evita redirecciones abiertas). */
export function rutaInternaSegura(destino: string | null | undefined): string | null {
  if (!destino || !destino.startsWith('/') || destino.startsWith('//') || destino.includes('\\'))
    return null;
  return destino;
}

export type DecisionAcceso = { tipo: 'permitir' } | { tipo: 'redirigir'; destino: string };

/**
 * Decide el acceso a una ruta según el indicio de rol (R13). El indicio NO es autoridad: solo
 * evita renderizar paneles ajenos; la guarda cliente y la API validan el rol real.
 */
export function resolverAcceso(
  pathname: string,
  indicio: string | null | undefined,
  consulta = '',
): DecisionAcceso {
  const rol = esRolConocido(indicio) ? indicio : null;
  if (pathname === RUTA_INGRESAR) {
    return rol ? { tipo: 'redirigir', destino: PANEL_POR_ROL[rol] } : { tipo: 'permitir' };
  }
  const dueno = rolDelPanel(pathname);
  if (!dueno) return { tipo: 'permitir' };
  if (!rol) {
    const siguiente = encodeURIComponent(`${pathname}${consulta}`);
    return { tipo: 'redirigir', destino: `${RUTA_INGRESAR}?siguiente=${siguiente}` };
  }
  return rol === dueno ? { tipo: 'permitir' } : { tipo: 'redirigir', destino: RUTA_SIN_PERMISO };
}
