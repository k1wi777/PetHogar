import type { SexoMascota, TamanoMascota } from '../entities/mascota.enum';
import type { EventoMedico, FotoGestion } from '../mascotas.types';

export interface FiltroCatalogo {
  especieId?: number;
  tamano?: TamanoMascota;
  edadMinMeses?: number;
  edadMaxMeses?: number;
  ciudad?: string;
}

/** Fila del listado tal como sale de la consulta (con la clave de la miniatura, que nunca se serializa). */
export interface FilaCatalogo {
  id: number;
  nombre: string;
  especie: string;
  raza: string;
  sexo: SexoMascota;
  edadMeses: number;
  tamano: TamanoMascota;
  ciudad: string;
  fundacionNombre: string;
  fotoCatalogoClave: string | null;
}

export interface FilaFicha {
  id: number;
  nombre: string;
  especie: string;
  raza: string;
  sexo: SexoMascota;
  edadMeses: number;
  tamano: TamanoMascota;
  color: string | null;
  esterilizado: boolean;
  vacunado: boolean;
  estadoSalud: string;
  descripcion: string | null;
  fechaPublicacion: Date;
  fundacionId: number;
  fundacionNombre: string;
  fundacionCiudad: string;
  fundacionDescripcion: string | null;
}

export interface MascotaCatalogo {
  id: number;
  nombre: string;
  especie: string;
  raza: string;
  sexo: SexoMascota;
  edadMeses: number;
  tamano: TamanoMascota;
  ciudad: string;
  fundacion: { nombre: string };
  fotoPrincipal: { urlCatalogo: string } | null;
}

/** Únicos datos de la fundación que son públicos. */
export interface FundacionPublica {
  id: number;
  nombre: string;
  ciudad: string;
  descripcion: string | null;
}

export interface MascotaFicha {
  id: number;
  nombre: string;
  especie: string;
  raza: string;
  sexo: SexoMascota;
  edadMeses: number;
  tamano: TamanoMascota;
  color: string | null;
  esterilizado: boolean;
  vacunado: boolean;
  estadoSalud: string;
  descripcion: string | null;
  fechaPublicacion: Date;
  fundacion: FundacionPublica;
  fotos: FotoGestion[];
  historial: EventoMedico[];
}
