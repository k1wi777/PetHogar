import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { FundacionAprobada } from '../types';

/** El backend admite hasta 100 por página; no existe un listado más ligero (ver `design.md`). */
export const MAX_FUNDACIONES_SELECTOR = 100;

export interface FundacionesAprobadas {
  fundaciones: FundacionAprobada[];
  hayMas: boolean;
}

/**
 * Fuente del selector de fundación del administrador. Aislada aquí: si el backend ofrece un
 * catálogo propio, solo cambia este módulo.
 */
export async function listarFundacionesAprobadas(
  cliente: ClienteHttp = http,
): Promise<FundacionesAprobadas> {
  const pagina = await cliente.get<{
    data: Array<{ id: number; nombre: string }>;
    total: number;
  }>('/admin/fundaciones', {
    consulta: { estado: 'aprobada', limit: MAX_FUNDACIONES_SELECTOR, page: 1 },
  });
  return {
    fundaciones: pagina.data.map((f) => ({ id: f.id, nombre: f.nombre })),
    hayMas: pagina.total > pagina.data.length,
  };
}
