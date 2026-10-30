export type Sexo = 'macho' | 'hembra';
export type Tamano = 'pequeño' | 'mediano' | 'grande';
export type TipoHistorial = 'vacuna' | 'desparasitacion' | 'cirugia' | 'consulta';

export interface MascotaCatalogo {
  id: number;
  nombre: string;
  especie: string;
  raza: string;
  sexo: Sexo;
  edadMeses: number;
  tamano: Tamano;
  ciudad: string;
  fundacion: { nombre: string };
  fotoPrincipal: { urlCatalogo: string } | null;
}

export interface FotoPublica {
  id: number;
  esPrincipal: boolean;
  /** Miniatura; `null` si la foto no tiene una URL pública. */
  urlCatalogo: string | null;
  /** Versión grande. */
  url: string | null;
}

export interface EventoMedico {
  id: number;
  tipo: TipoHistorial;
  /** AAAA-MM-DD. */
  fecha: string;
  descripcion: string;
  veterinario: string | null;
}

/** Únicos datos de la fundación que la API hace públicos. */
export interface FundacionPublica {
  id: number;
  nombre: string;
  ciudad: string;
  descripcion: string | null;
}

export interface FichaMascota {
  id: number;
  nombre: string;
  especie: string;
  raza: string;
  sexo: Sexo;
  edadMeses: number;
  tamano: Tamano;
  color: string | null;
  esterilizado: boolean;
  vacunado: boolean;
  estadoSalud: string;
  descripcion: string | null;
  fechaPublicacion: string;
  fundacion: FundacionPublica;
  fotos: FotoPublica[];
  historial: EventoMedico[];
}

export interface Especie {
  id: number;
  nombre: string;
}

/** Filtros del catálogo tal como viven en la URL (ya validados). */
export interface FiltrosCatalogo {
  especie?: number;
  tamano?: Tamano;
  edadMin?: number;
  edadMax?: number;
  ciudad?: string;
  pagina: number;
}

/** Consulta que admite `GET /mascotas`. */
export interface ConsultaCatalogo {
  especieId?: number;
  tamano?: Tamano;
  edadMinMeses?: number;
  edadMaxMeses?: number;
  ciudad?: string;
  page?: number;
}
