export enum TipoSeguimiento {
  Visita = 'visita',
  Reporte = 'reporte',
}

export enum EstadoSeguimiento {
  Programado = 'programado',
  Realizado = 'realizado',
  Vencido = 'vencido',
  Cancelado = 'cancelado',
}

export enum EstadoBienestar {
  Bueno = 'bueno',
  Regular = 'regular',
  Malo = 'malo',
}

/** Quién subió la foto: las del reporte son del adoptante y las del cierre, de la fundación. */
export enum OrigenEvidencia {
  Fundacion = 'fundacion',
  Adoptante = 'adoptante',
}
