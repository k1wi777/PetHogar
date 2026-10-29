import type { TipoHistorialMedico } from './entities/historial-medico.enum';
import type { EstadoMascota, SexoMascota, TamanoMascota } from './entities/mascota.enum';

/** Datos descriptivos editables por la fundación (nunca incluyen `estado` ni `fundacionId`). */
export interface DatosMascota {
  razaId: number;
  nombre: string;
  sexo: SexoMascota;
  edadMeses: number;
  tamano: TamanoMascota;
  color: string | null;
  esterilizado: boolean;
  vacunado: boolean;
  estadoSalud: string;
  descripcion: string | null;
}

export type CambiosMascota = Partial<DatosMascota>;

/** Mascota vista por su fundación dueña (cualquier estado). */
export interface MascotaGestion extends DatosMascota {
  id: number;
  estado: EstadoMascota;
  fechaPublicacion: Date;
}

export interface FiltroMascotasFundacion {
  estado?: EstadoMascota;
}

/** Foto lista para responder: URLs públicas, nunca las claves de almacenamiento. */
export interface FotoGestion {
  id: number;
  esPrincipal: boolean;
  /** `null` si la foto no tiene una clave pública real (datos heredados del seed demo). */
  urlCatalogo: string | null;
  url: string | null;
}

export interface MascotaGestionDetalle extends MascotaGestion {
  fotos: FotoGestion[];
}

/** Evento del historial médico (la fecha es `YYYY-MM-DD`). */
export interface EventoMedico {
  id: number;
  tipo: TipoHistorialMedico;
  fecha: string;
  descripcion: string;
  veterinario: string | null;
}
