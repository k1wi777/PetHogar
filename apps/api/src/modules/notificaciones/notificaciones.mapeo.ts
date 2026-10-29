import type { NotificacionVista } from './notificaciones.types';

/** Fila con lo estrictamente necesario: nunca `usuarioId` ni `clave`. */
export interface FilaNotificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fechaCreacion: Date;
  entidad: string | null;
  entidadId: number | null;
}

export function aVista(fila: FilaNotificacion): NotificacionVista {
  return {
    id: fila.id,
    tipo: fila.tipo,
    titulo: fila.titulo,
    mensaje: fila.mensaje,
    leida: fila.leida,
    fechaCreacion: fila.fechaCreacion,
    referencia:
      fila.entidad !== null && fila.entidadId !== null
        ? { tipo: fila.entidad, id: fila.entidadId }
        : null,
  };
}

/** Recorta por caracteres reales (sin partir un par sustituto) y marca el corte con «…». */
export function recortar(texto: string, maximo: number): string {
  const caracteres = Array.from(texto);
  if (caracteres.length <= maximo) return texto;
  return `${caracteres
    .slice(0, maximo - 1)
    .join('')
    .trimEnd()}…`;
}
