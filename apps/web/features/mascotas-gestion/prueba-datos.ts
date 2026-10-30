import type { Usuario } from '@/shared/api/tipos';
import { usuarioDe } from '@/shared/testing/prueba-utils';
import type { EventoMedico, FotoGestion, MascotaGestion, MascotaGestionDetalle } from './types';

/** Datos de ejemplo para las pruebas (no forman parte de la aplicación). */
export function mascota(parcial: Partial<MascotaGestion> = {}): MascotaGestion {
  return {
    id: 5,
    razaId: 11,
    nombre: 'Firulais',
    sexo: 'macho',
    edadMeses: 30,
    tamano: 'mediano',
    color: 'Café',
    esterilizado: true,
    vacunado: false,
    estadoSalud: 'Sano',
    descripcion: 'Juguetón',
    estado: 'disponible',
    fechaPublicacion: '2026-10-20T15:00:00.000Z',
    ...parcial,
  };
}

export function foto(id: number, parcial: Partial<FotoGestion> = {}): FotoGestion {
  return {
    id,
    esPrincipal: false,
    urlCatalogo: `http://api.test/uploads/mascotas/m-${id}.webp`,
    url: `http://api.test/uploads/mascotas/g-${id}.webp`,
    ...parcial,
  };
}

export function detalle(parcial: Partial<MascotaGestionDetalle> = {}): MascotaGestionDetalle {
  return {
    ...mascota(),
    fotos: [foto(1, { esPrincipal: true }), foto(2)],
    ...parcial,
  };
}

export function evento(id: number, parcial: Partial<EventoMedico> = {}): EventoMedico {
  return {
    id,
    tipo: 'vacuna',
    fecha: '2026-03-05',
    descripcion: 'Primera dosis',
    veterinario: 'Dra. Pérez',
    ...parcial,
  };
}

export const ESPECIES = [
  { id: 1, nombre: 'perro' },
  { id: 2, nombre: 'gato' },
];
export const RAZAS: Record<number, Array<{ id: number; nombre: string }>> = {
  1: [
    { id: 11, nombre: 'Criollo' },
    { id: 12, nombre: 'Labrador' },
  ],
  2: [{ id: 21, nombre: 'Siamés' }],
};

export function fundacion(
  estadoValidacion: 'pendiente' | 'aprobada' | 'rechazada' = 'aprobada',
  observacionValidacion: string | null = null,
): Usuario {
  return usuarioDe('fundacion', {
    id: 1,
    nombre: 'Patitas',
    estadoValidacion,
    observacionValidacion,
  });
}
