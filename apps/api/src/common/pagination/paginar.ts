import { PaginacionQueryDto } from './paginacion-query.dto';

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** Construye la respuesta paginada estándar. */
export function paginar<T>(
  data: T[],
  total: number,
  { page, limit }: PaginacionQueryDto,
): Paginado<T> {
  return { data, total, page, limit };
}

/** Calcula `skip`/`take` para las consultas de TypeORM. */
export function desplazamiento({ page, limit }: PaginacionQueryDto): {
  skip: number;
  take: number;
} {
  return { skip: (page - 1) * limit, take: limit };
}
