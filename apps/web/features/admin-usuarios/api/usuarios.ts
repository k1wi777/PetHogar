import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { ConsultaUsuarios, PaginaUsuarios, UsuarioAdmin } from '../types';

export const USUARIOS_POR_PAGINA = 10;

export function listarUsuarios(
  consulta: ConsultaUsuarios,
  cliente: ClienteHttp = http,
): Promise<PaginaUsuarios> {
  return cliente.get<PaginaUsuarios>('/admin/usuarios', {
    consulta: {
      page: consulta.pagina,
      limit: USUARIOS_POR_PAGINA,
      nombre: consulta.nombre,
      correo: consulta.correo,
      rol: consulta.rol,
    },
  });
}

/** Desactivar cierra todas las sesiones de la cuenta; devuelve el usuario ya actualizado. */
export function cambiarEstadoUsuario(
  id: number,
  activo: boolean,
  cliente: ClienteHttp = http,
): Promise<UsuarioAdmin> {
  return cliente.patch<UsuarioAdmin>(`/admin/usuarios/${id}/estado`, { cuerpo: { activo } });
}
