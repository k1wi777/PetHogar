import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { NoLeidasResumen } from '../types';

export function contarNoLeidasResumen(cliente: ClienteHttp = http): Promise<NoLeidasResumen> {
  return cliente.get<NoLeidasResumen>('/notificaciones/no-leidas/count');
}
