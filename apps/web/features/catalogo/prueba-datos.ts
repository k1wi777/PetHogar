import type { FichaMascota } from './types';

/** Ficha de ejemplo para las pruebas. */
export function fichaEjemplo(extra: Partial<FichaMascota> = {}): FichaMascota {
  return {
    id: 5,
    nombre: 'Luna',
    especie: 'perro',
    raza: 'Criollo',
    sexo: 'hembra',
    edadMeses: 30,
    tamano: 'mediano',
    color: 'Café',
    esterilizado: true,
    vacunado: false,
    estadoSalud: 'Saludable',
    descripcion: 'Cariñosa y juguetona.',
    fechaPublicacion: '2026-01-01T00:00:00.000Z',
    fundacion: {
      id: 1,
      nombre: 'Huellitas',
      ciudad: 'Montería',
      descripcion: 'Rescatamos animales.',
    },
    fotos: [
      {
        id: 1,
        esPrincipal: true,
        urlCatalogo: 'http://api/uploads/publico/a-m.webp',
        url: 'http://api/uploads/publico/a.webp',
      },
      { id: 2, esPrincipal: false, urlCatalogo: 'http://api/uploads/publico/b-m.webp', url: null },
    ],
    historial: [
      {
        id: 2,
        tipo: 'cirugia',
        fecha: '2026-03-05',
        descripcion: 'Esterilización',
        veterinario: 'Dra. Pérez',
      },
      { id: 1, tipo: 'vacuna', fecha: '2026-01-10', descripcion: 'Triple', veterinario: null },
    ],
    ...extra,
  };
}
