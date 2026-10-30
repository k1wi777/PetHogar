import type { Sexo, Tamano, TipoHistorial } from '@/shared/lib/formato-mascota';

// Se redefinen aquí (mismos literales) para no importar la feature `catalogo`.
export type { Sexo, Tamano, TipoHistorial };

export const ESTADOS_MASCOTA = ['disponible', 'en_proceso', 'adoptada', 'inactiva'] as const;
export type EstadoMascota = (typeof ESTADOS_MASCOTA)[number];

export const ETIQUETA_ESTADO: Readonly<Record<EstadoMascota, string>> = {
  disponible: 'Disponible',
  en_proceso: 'En proceso',
  adoptada: 'Adoptada',
  inactiva: 'Inactiva',
};

/** Mascota de la fundación (`GET /fundacion/mascotas`); trae `razaId` pero no el nombre de la raza. */
export interface MascotaGestion {
  id: number;
  razaId: number;
  nombre: string;
  sexo: Sexo;
  edadMeses: number;
  tamano: Tamano;
  color: string | null;
  esterilizado: boolean;
  vacunado: boolean;
  estadoSalud: string;
  descripcion: string | null;
  estado: EstadoMascota;
  fechaPublicacion: string;
}

export interface FotoGestion {
  id: number;
  esPrincipal: boolean;
  /** Miniatura; `null` si la foto no tiene URL pública (p. ej. las del seed). */
  urlCatalogo: string | null;
  /** Versión grande. */
  url: string | null;
}

export interface MascotaGestionDetalle extends MascotaGestion {
  fotos: FotoGestion[];
}

export interface EventoMedico {
  id: number;
  tipo: TipoHistorial;
  /** AAAA-MM-DD. */
  fecha: string;
  descripcion: string;
  veterinario: string | null;
}

export interface Especie {
  id: number;
  nombre: string;
}

export interface Raza {
  id: number;
  nombre: string;
}

/** Cuerpo de `POST /mascotas`; el de `PATCH` es un subconjunto. */
export interface DatosMascota {
  nombre: string;
  razaId: number;
  sexo: Sexo;
  edadMeses: number;
  tamano: Tamano;
  estadoSalud: string;
  color?: string | null;
  descripcion?: string | null;
  esterilizado: boolean;
  vacunado: boolean;
}

export type CambiosMascota = Partial<DatosMascota>;

export interface DatosHistorial {
  tipo: TipoHistorial;
  fecha: string;
  descripcion: string;
  veterinario?: string | null;
}

/** Filtro y página de la lista, tal como viven en la URL. */
export interface ConsultaMascotas {
  pagina: number;
  estado?: EstadoMascota;
}
