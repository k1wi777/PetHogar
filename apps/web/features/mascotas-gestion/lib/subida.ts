import { esErrorApi } from '@/shared/api/errores';
import { mensajeDe } from '@/shared/lib/errores-usuario';
import { SOLO_IMAGENES, validarDocumento } from '@/shared/lib/archivo';

export const MAX_FOTOS = 6;
/** Mismo texto que el backend para el 409 de cupo. */
export const MENSAJE_CUPO = `Solo puedes subir hasta ${MAX_FOTOS} fotos por mascota`;
export const MENSAJE_RESTO_CUPO = `No subida: ya hay ${MAX_FOTOS} fotos`;
export const MENSAJE_RESTO_LIMITE =
  'No subida: hiciste demasiadas subidas seguidas; espera un minuto y reintenta';

export type EstadoSubida = 'pendiente' | 'subiendo' | 'listo' | 'error' | 'rechazado';

export interface ElementoCola {
  id: number;
  archivo: File;
  estado: EstadoSubida;
  /** Motivo del error o del rechazo previo. */
  mensaje?: string;
}

/**
 * Validación previa a subir: tipo y tamaño (`validarDocumento`) y cupo restante. Los archivos se
 * atienden en el orden elegido, así que los que no caben quedan rechazados con el texto del backend.
 */
export function prepararArchivos(
  archivos: readonly File[],
  fotosActuales: number,
): { aceptados: File[]; rechazados: Array<{ archivo: File; mensaje: string }> } {
  const aceptados: File[] = [];
  const rechazados: Array<{ archivo: File; mensaje: string }> = [];
  for (const archivo of archivos) {
    const valido = validarDocumento(archivo, SOLO_IMAGENES);
    if (!valido.ok) {
      rechazados.push({ archivo, mensaje: valido.mensaje });
    } else if (fotosActuales + aceptados.length >= MAX_FOTOS) {
      rechazados.push({ archivo, mensaje: MENSAJE_CUPO });
    } else {
      aceptados.push(archivo);
    }
  }
  return { aceptados, rechazados };
}

export type MotivoParada = 'cupo' | 'limite' | 'no-aprobada' | null;

export interface ResumenSubida {
  subidas: number;
  fallidas: number;
  parada: MotivoParada;
  /** Mensaje del servidor que detuvo la cola. */
  mensaje?: string;
}

function paradaDe(error: unknown): MotivoParada {
  if (!esErrorApi(error)) return null;
  if (error.estado === 409) return 'cupo';
  if (error.estado === 429) return 'limite';
  if (error.estado === 403) return 'no-aprobada';
  return null;
}

/**
 * Sube de uno en uno (el backend recibe una foto por petición y bloquea la fila para garantizar el
 * máximo; en paralelo solo se obtendrían 409). Un 409, 429 o 403 detiene la cola y marca el resto.
 */
export async function procesarCola(
  elementos: readonly ElementoCola[],
  subir: (archivo: File) => Promise<unknown>,
  alCambiar: (id: number, cambio: Partial<Pick<ElementoCola, 'estado' | 'mensaje'>>) => void,
): Promise<ResumenSubida> {
  let subidas = 0;
  let fallidas = 0;
  for (let i = 0; i < elementos.length; i++) {
    const elemento = elementos[i]!;
    alCambiar(elemento.id, { estado: 'subiendo', mensaje: undefined });
    try {
      await subir(elemento.archivo);
      subidas++;
      alCambiar(elemento.id, { estado: 'listo' });
    } catch (error) {
      fallidas++;
      alCambiar(elemento.id, { estado: 'error', mensaje: mensajeDe(error) });
      const parada = paradaDe(error);
      if (parada) {
        const texto =
          parada === 'cupo'
            ? MENSAJE_RESTO_CUPO
            : parada === 'limite'
              ? MENSAJE_RESTO_LIMITE
              : `No subida: ${mensajeDe(error)}`;
        for (const resto of elementos.slice(i + 1)) {
          fallidas++;
          alCambiar(resto.id, { estado: 'error', mensaje: texto });
        }
        return { subidas, fallidas, parada, mensaje: mensajeDe(error) };
      }
    }
  }
  return { subidas, fallidas, parada: null };
}

/** «3 fotos subidas, 1 con error», para el anuncio a lectores de pantalla al terminar. */
export function resumenFinal(resumen: ResumenSubida, rechazadas: number): string {
  const partes: string[] = [];
  if (resumen.subidas > 0) {
    partes.push(resumen.subidas === 1 ? '1 foto subida' : `${resumen.subidas} fotos subidas`);
  }
  const errores = resumen.fallidas + rechazadas;
  if (errores > 0) partes.push(errores === 1 ? '1 con error' : `${errores} con error`);
  return partes.length > 0 ? partes.join(', ') : 'No se subió ninguna foto';
}

/** Texto alternativo de una foto de la galería (la API no guarda descripciones). */
export function textoAlternativo(
  nombre: string,
  posicion: number,
  total: number,
  esPrincipal: boolean,
): string {
  return `Foto ${posicion} de ${total} de ${nombre}${esPrincipal ? ', foto principal' : ''}`;
}
