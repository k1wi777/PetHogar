import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { Especie, Raza } from '../types';

export function listarEspecies(cliente: ClienteHttp = http): Promise<Especie[]> {
  return cliente.get<Especie[]>('/especies', { autenticada: false });
}

export function listarRazas(especieId: number, cliente: ClienteHttp = http): Promise<Raza[]> {
  return cliente.get<Raza[]>(`/especies/${especieId}/razas`, { autenticada: false });
}
