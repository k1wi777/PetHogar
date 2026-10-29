import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Paginado } from '../../common/pagination/paginar';
import type { PaginacionQueryDto } from '../../common/pagination/paginacion-query.dto';
import { SesionService } from '../auth/sesion.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { FiltroUsuarios, UsuarioAdmin } from '../usuarios/usuarios.types';
import type { UsuarioAdminDto } from './dto/respuestas.dto';

export const MENSAJE_AUTODESACTIVACION = 'No puedes desactivar tu propia cuenta';

/** Orquesta usuarios (dueño de la cuenta) y auth (dueño de las sesiones) en una transacción. */
@Injectable()
export class AdminUsuariosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarios: UsuariosService,
    private readonly sesion: SesionService,
  ) {}

  async listar(
    filtros: FiltroUsuarios,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<UsuarioAdminDto>> {
    const pagina = await this.usuarios.listar(filtros, paginacion);
    return { ...pagina, data: pagina.data.map(aDto) };
  }

  /**
   * Cambiar el estado y revocar las sesiones al desactivar es atómico: o ambos o ninguno.
   * Reactivar no restaura sesiones; la persona debe iniciar sesión de nuevo.
   */
  async cambiarEstado(actorId: number, id: number, activo: boolean): Promise<UsuarioAdminDto> {
    if (!activo && actorId === id) throw new BadRequestException(MENSAJE_AUTODESACTIVACION);

    const usuario = await this.dataSource.transaction(async (manager) => {
      const actualizado = await this.usuarios.cambiarEstado(id, activo, manager);
      if (!activo) await this.sesion.revocarTodas(id, manager);
      return actualizado;
    });
    return aDto(usuario);
  }
}

function aDto(u: UsuarioAdmin): UsuarioAdminDto {
  return {
    id: u.id,
    email: u.email,
    telefono: u.telefono,
    rol: u.rol,
    activo: u.activo,
    emailVerificado: u.emailVerificado,
    fechaCreacion: u.fechaCreacion,
    nombre: u.nombre,
  };
}
