import type { ResumenAdopcion } from './adopciones.types';
import type { ResumenAdopcionDto } from './dto/respuestas.dto';

export function aprobacionAResumen(a: ResumenAdopcion): ResumenAdopcionDto {
  return { id: a.id, fechaEntrega: a.fechaEntrega, estado: a.estado };
}
