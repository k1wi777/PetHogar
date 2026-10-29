import { EstadoBienestar, EstadoSeguimiento, TipoSeguimiento } from './entities/seguimiento.enum';
import {
  aDetalleAdoptanteDto,
  aDetalleFundacionDto,
  aListaAdoptanteDto,
  aListaFundacionDto,
  aResumenDto,
} from './seguimientos.mapeo';
import type {
  SeguimientoDetalleAdoptante,
  SeguimientoDetalleFundacion,
} from './seguimientos.types';

// Lo que traería un objeto crudo con todo lo que NO debe salir.
const SUCIO = {
  clave: 'privado/seguimientos/aaa.jpg',
  url: 'privado/seguimientos/bbb.jpg',
  numeroDocumento: '123',
  email: 'ana@x.co',
  contrasena: 'hash',
};
const BASE = {
  id: 5,
  adopcionId: 9,
  tipo: TipoSeguimiento.Reporte,
  fechaProgramada: '2026-12-15',
  fechaRealizada: null,
  estado: EstadoSeguimiento.Programado,
  vencido: false,
  tieneReporte: true,
  mascota: { id: 4, nombre: 'Luna', ...SUCIO },
  ...SUCIO,
};
const REPORTE = {
  comentarios: 'Todo bien, come mucho',
  enviadoEn: new Date('2026-12-01T10:00:00Z'),
  fotos: [{ id: 21, ...SUCIO }],
};
const FUNDACION: SeguimientoDetalleFundacion = {
  ...BASE,
  adoptante: { nombreCompleto: 'Ana Pérez', ...SUCIO },
  fechaEntrega: '2026-11-20',
  estadoBienestar: EstadoBienestar.Malo,
  observaciones: 'Se ve delgado',
  reporte: REPORTE,
  evidencias: [{ id: 30, ...SUCIO }],
};
const ADOPTANTE = {
  ...BASE,
  fundacion: { nombre: 'Patitas', ...SUCIO },
  fechaEntrega: '2026-11-20',
  reporte: REPORTE,
  // Campos que el modelo de lectura del adoptante no trae, pero que un descuido podría propagar.
  estadoBienestar: EstadoBienestar.Malo,
  observaciones: 'Se ve delgado',
  evidencias: [{ id: 30 }],
} as unknown as SeguimientoDetalleAdoptante;

const PROHIBIDO = /privado\/|clave|numeroDocumento|contrasena|ana@x\.co/;

describe('mapeo de seguimientos', () => {
  it('la lista de la fundación solo trae el nombre del adoptante', () => {
    const dto = aListaFundacionDto({
      ...BASE,
      adoptante: { nombreCompleto: 'Ana Pérez', ...SUCIO },
    });
    expect(dto.adoptante).toEqual({ nombreCompleto: 'Ana Pérez' });
    expect(dto.mascota).toEqual({ id: 4, nombre: 'Luna' });
    expect(JSON.stringify(dto)).not.toMatch(PROHIBIDO);
  });

  it('el detalle de la fundación incluye resultado, reporte y enlaces de descarga, no claves', () => {
    const dto = aDetalleFundacionDto(FUNDACION);
    expect(dto.estadoBienestar).toBe('malo');
    expect(dto.observaciones).toBe('Se ve delgado');
    expect(dto.reporte?.fotos).toEqual([
      { id: 21, url: '/api/fundacion/seguimientos/5/evidencias/21' },
    ]);
    expect(dto.evidencias).toEqual([
      { id: 30, url: '/api/fundacion/seguimientos/5/evidencias/30' },
    ]);
    expect(JSON.stringify(dto)).not.toMatch(PROHIBIDO);
  });

  it('el adoptante no recibe bienestar, observaciones ni evidencias de la fundación', () => {
    const lista = aListaAdoptanteDto(ADOPTANTE);
    const detalle = aDetalleAdoptanteDto(ADOPTANTE);
    for (const dto of [lista, detalle]) {
      expect(dto).not.toHaveProperty('estadoBienestar');
      expect(dto).not.toHaveProperty('observaciones');
      expect(dto).not.toHaveProperty('evidencias');
      expect(dto).not.toHaveProperty('adoptante');
      expect(JSON.stringify(dto)).not.toMatch(/malo|delgado|\/api\/fundacion|clave|privado\//);
    }
    expect(detalle.fundacion).toEqual({ nombre: 'Patitas' });
    expect(detalle.reporte?.fotos).toEqual([
      { id: 21, url: '/api/mis-seguimientos/5/evidencias/21' },
    ]);
  });

  it('sin reporte, `reporte` es null', () => {
    expect(aDetalleAdoptanteDto({ ...ADOPTANTE, reporte: null }).reporte).toBeNull();
    expect(aDetalleFundacionDto({ ...FUNDACION, reporte: null }).reporte).toBeNull();
  });

  it('el resumen de adopciones copia solo sus seis campos', () => {
    expect(
      aResumenDto({
        id: 5,
        tipo: TipoSeguimiento.Visita,
        fechaProgramada: '2026-12-15',
        fechaRealizada: '2026-12-14',
        estado: EstadoSeguimiento.Realizado,
        vencido: false,
        ...SUCIO,
      } as never),
    ).toEqual({
      id: 5,
      tipo: 'visita',
      fechaProgramada: '2026-12-15',
      fechaRealizada: '2026-12-14',
      estado: 'realizado',
      vencido: false,
    });
  });
});
