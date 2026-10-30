import type { ClienteHttp } from '@/shared/api/cliente';
import { clienteServidor } from '@/shared/api/servidor';
import type { Especie } from '../types';

export function listarEspecies(cliente: ClienteHttp = clienteServidor()): Promise<Especie[]> {
  return cliente.get<Especie[]>('/especies', { autenticada: false });
}
