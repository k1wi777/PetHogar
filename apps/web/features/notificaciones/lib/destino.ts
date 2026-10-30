import type { Rol } from '@/shared/api/tipos';
import { PANEL_POR_ROL } from '@/shared/lib/acceso';
import type { Notificacion } from '../types';

type ConstructorRuta = (id: number) => string;

/**
 * Pantalla relacionada por rol y `referencia.tipo`. Solo contiene rutas que existen en `app/`
 * (una prueba lo comprueba); el backend no entrega referencia a mascota.
 */
const RUTAS: Readonly<Record<Rol, Readonly<Record<string, ConstructorRuta>>>> = {
  fundacion: {
    solicitud: (id) => `/fundacion/solicitudes/${id}`,
    seguimiento: (id) => `/fundacion/adopciones/seguimientos/${id}`,
    // La validación de la fundación se ve en su inicio.
    fundacion: () => '/fundacion',
    // No hay detalle de donación: se lleva a la lista.
    donacion: () => '/fundacion/donaciones',
  },
  adoptante: {
    solicitud: (id) => `/adoptante/solicitudes/${id}`,
    adopcion: () => '/adoptante/adopciones',
    seguimiento: (id) => `/adoptante/adopciones/seguimientos/${id}`,
  },
  administrador: {
    fundacion: (id) => `/administrador/fundaciones/${id}`,
  },
};

/** Lista de notificaciones del propio panel: destino seguro por defecto. */
export function listaDelPanel(rol: Rol): string {
  return `${PANEL_POR_ROL[rol]}/notificaciones`;
}

/**
 * Ruta a la que lleva una notificación para ese rol. Sin referencia, con tipo desconocido, sin
 * pantalla para el rol o con un id que no sea un entero positivo, cae en la lista de
 * notificaciones del panel: nunca se interpola texto libre del servidor en una ruta.
 */
export function destinoDe(notificacion: Pick<Notificacion, 'referencia'>, rol: Rol): string {
  const ref = notificacion.referencia;
  if (!ref || !Number.isSafeInteger(ref.id) || ref.id <= 0) return listaDelPanel(rol);
  // `Object.hasOwn` evita resolver `constructor` o `__proto__` como si fueran tipos.
  const rutasDelRol = RUTAS[rol];
  const construir = Object.hasOwn(rutasDelRol, ref.tipo) ? rutasDelRol[ref.tipo] : undefined;
  return construir ? construir(ref.id) : listaDelPanel(rol);
}
