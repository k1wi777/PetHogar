import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';

export interface NoLeidas {
  noLeidas: number;
}

export function contarNoLeidas(cliente: ClienteHttp = http): Promise<NoLeidas> {
  return cliente.get<NoLeidas>('/notificaciones/no-leidas/count');
}
