/**
 * Datos declarativos del demo ampliado. Todas las fechas son desfases respecto a `now()` (la base
 * de datos las resuelve): así las gráficas muestran siempre los últimos meses y los seguimientos
 * `programado`/`vencido` conservan su sentido.
 */

/** Tiempo transcurrido hasta ahora; `dias` negativo apunta al futuro (o adelanta dentro del mes). */
export interface Desfase {
  meses: number;
  dias: number;
}

export const hace = (meses: number, dias = 0): Desfase => ({ meses, dias });

export const ADOPTANTE_DEMO_EMAIL = 'adoptante.demo@pethogar.local';

export const ADOPTANTE_DEMO = {
  primerNombre: 'Ana',
  primerApellido: 'Demo',
  tipoDocumento: 'CC',
  numeroDocumento: '1000000001',
  fechaNacimiento: '1990-05-15',
  direccion: 'Carrera 4 # 5-6',
  ciudad: 'Bogotá',
} as const;

export interface MascotaAdoptadaDemo {
  nombre: string;
  especie: string;
  raza: string;
  sexo: 'macho' | 'hembra';
  edadMeses: number;
  tamano: 'pequeño' | 'mediano' | 'grande';
  descripcion: string;
}

/** Ya adoptadas: no aparecen en el catálogo público, que sigue mostrando las 4 disponibles. */
export const MASCOTAS_ADOPTADAS_DEMO: MascotaAdoptadaDemo[] = [
  {
    nombre: 'Rocky',
    especie: 'perro',
    raza: 'Mestizo',
    sexo: 'macho',
    edadMeses: 30,
    tamano: 'mediano',
    descripcion: 'Leal y enérgico.',
  },
  {
    nombre: 'Pelusa',
    especie: 'gato',
    raza: 'Mestizo',
    sexo: 'hembra',
    edadMeses: 18,
    tamano: 'pequeño',
    descripcion: 'Tranquila y muy mimosa.',
  },
  {
    nombre: 'Toby',
    especie: 'perro',
    raza: 'Labrador',
    sexo: 'macho',
    edadMeses: 48,
    tamano: 'grande',
    descripcion: 'Noble y paciente.',
  },
];

export type EstadoSolicitudDemo = 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';

export interface SolicitudDemo {
  clave: string;
  mascota: string;
  estado: EstadoSolicitudDemo;
  solicitud: Desfase;
  respuesta?: Desfase;
  observacion?: string;
}

export const SOLICITUDES_DEMO: SolicitudDemo[] = [
  {
    clave: 'toby',
    mascota: 'Toby',
    estado: 'aprobada',
    solicitud: hace(5),
    respuesta: hace(5, -2),
  },
  {
    clave: 'rocky',
    mascota: 'Rocky',
    estado: 'aprobada',
    solicitud: hace(4),
    respuesta: hace(4, -2),
  },
  {
    clave: 'rocky-rechazada',
    mascota: 'Rocky',
    estado: 'rechazada',
    solicitud: hace(4, 3),
    respuesta: hace(4, -2),
    observacion: 'La fundación aprobó otra solicitud para esta mascota.',
  },
  {
    clave: 'michi-rechazada',
    mascota: 'Michi',
    estado: 'rechazada',
    solicitud: hace(3),
    respuesta: hace(3, -3),
    observacion: 'Michi necesita un hogar sin otros gatos.',
  },
  {
    clave: 'pelusa',
    mascota: 'Pelusa',
    estado: 'aprobada',
    solicitud: hace(2),
    respuesta: hace(2, -2),
  },
  {
    clave: 'nieve-cancelada',
    mascota: 'Nieve',
    estado: 'cancelada',
    solicitud: hace(1, 10),
    respuesta: hace(1, 8),
  },
  { clave: 'firulais', mascota: 'Firulais', estado: 'pendiente', solicitud: hace(0, 5) },
  { clave: 'luna', mascota: 'Luna', estado: 'pendiente', solicitud: hace(0, 2) },
];

export interface AdopcionDemo {
  /** Clave de la solicitud aprobada. */
  solicitud: string;
  entrega: Desfase;
  estado: 'activa' | 'finalizada';
  cierre?: Desfase;
  motivoCierre?: string;
}

export const ADOPCIONES_DEMO: AdopcionDemo[] = [
  {
    solicitud: 'toby',
    entrega: hace(5, -5),
    estado: 'finalizada',
    cierre: hace(1),
    motivoCierre: 'La adopción se completó con éxito y no requiere más seguimiento.',
  },
  { solicitud: 'rocky', entrega: hace(4, -5), estado: 'activa' },
  { solicitud: 'pelusa', entrega: hace(2, -5), estado: 'activa' },
];

export interface SeguimientoDemo {
  /** Clave de la solicitud cuya adopción se sigue. */
  adopcion: string;
  tipo: 'visita' | 'reporte';
  fecha: Desfase;
  estado: 'programado' | 'realizado' | 'vencido' | 'cancelado';
  bienestar?: 'bueno' | 'regular' | 'malo';
  observaciones?: string;
  reporte?: string;
}

/** Solo estados alcanzables según `EstadoSeguimientoMaquina`; todas las fechas son posteriores a la entrega. */
export const SEGUIMIENTOS_DEMO: SeguimientoDemo[] = [
  {
    adopcion: 'toby',
    tipo: 'visita',
    fecha: hace(4),
    estado: 'realizado',
    bienestar: 'bueno',
    observaciones: 'Se adaptó muy bien a la casa.',
  },
  {
    adopcion: 'toby',
    tipo: 'reporte',
    fecha: hace(3),
    estado: 'realizado',
    bienestar: 'bueno',
    observaciones: 'Reporte revisado sin novedades.',
    reporte: 'Toby come bien, juega a diario y duerme tranquilo.',
  },
  { adopcion: 'toby', tipo: 'visita', fecha: hace(0, 15), estado: 'cancelado' },
  {
    adopcion: 'rocky',
    tipo: 'visita',
    fecha: hace(3),
    estado: 'realizado',
    bienestar: 'bueno',
    observaciones: 'Buen estado general.',
  },
  {
    adopcion: 'rocky',
    tipo: 'reporte',
    fecha: hace(2),
    estado: 'realizado',
    bienestar: 'regular',
    observaciones: 'Ha perdido algo de peso; se recomienda control veterinario.',
    reporte: 'Rocky come menos de lo habitual desde hace unos días.',
  },
  {
    adopcion: 'rocky',
    tipo: 'visita',
    fecha: hace(1),
    estado: 'realizado',
    bienestar: 'malo',
    observaciones: 'Se observa descuido y poca higiene; requiere acompañamiento.',
  },
  { adopcion: 'rocky', tipo: 'visita', fecha: hace(0, 10), estado: 'vencido' },
  { adopcion: 'rocky', tipo: 'reporte', fecha: hace(0, -20), estado: 'programado' },
  {
    adopcion: 'pelusa',
    tipo: 'reporte',
    fecha: hace(1, 5),
    estado: 'realizado',
    bienestar: 'bueno',
    observaciones: 'Reporte revisado sin novedades.',
    reporte: 'Pelusa está sana, activa y ya usa su arenero.',
  },
  { adopcion: 'pelusa', tipo: 'reporte', fecha: hace(0, 3), estado: 'vencido' },
  { adopcion: 'pelusa', tipo: 'visita', fecha: hace(0, -7), estado: 'programado' },
];

export interface DonacionDemo {
  tipo: 'economica' | 'especie';
  monto?: string;
  descripcionEspecie?: string;
  /** Con `true` la hizo el adoptante demo; si no, es un registro manual con `nombreDonante`. */
  delAdoptante: boolean;
  nombreDonante?: string;
  fecha: Desfase;
}

export const DONACIONES_DEMO: DonacionDemo[] = [
  { tipo: 'economica', monto: '50000.00', delAdoptante: true, fecha: hace(4, 10) },
  {
    tipo: 'especie',
    descripcionEspecie: 'Dos bultos de alimento para perros',
    delAdoptante: false,
    nombreDonante: 'Carlos Pérez',
    fecha: hace(4, 2),
  },
  {
    tipo: 'economica',
    monto: '120000.50',
    delAdoptante: false,
    nombreDonante: 'María López',
    fecha: hace(3, 5),
  },
  { tipo: 'economica', monto: '25000.00', delAdoptante: true, fecha: hace(2, 12) },
  {
    tipo: 'especie',
    descripcionEspecie: 'Mantas y camas para gatos',
    delAdoptante: true,
    fecha: hace(2, 3),
  },
  {
    tipo: 'economica',
    monto: '80000.00',
    delAdoptante: false,
    nombreDonante: 'Empresa Amiga SAS',
    fecha: hace(1, 8),
  },
  {
    tipo: 'especie',
    descripcionEspecie: 'Medicamentos veterinarios',
    delAdoptante: false,
    nombreDonante: 'Laura Díaz',
    fecha: hace(0, 9),
  },
  {
    tipo: 'economica',
    monto: '200000.00',
    delAdoptante: false,
    nombreDonante: 'Fondo Solidario',
    fecha: hace(0, 1),
  },
];
