import { Injectable, UnauthorizedException } from '@nestjs/common';
import { FundacionesService } from '../fundaciones/fundaciones.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { UsuarioPerfilDto } from './dto/respuestas.dto';

/** Arma el perfil de salida (mapeo explícito): solo datos públicos del usuario y, si aplica, de su fundación. */
@Injectable()
export class PerfilService {
  constructor(
    private readonly usuarios: UsuariosService,
    private readonly fundaciones: FundacionesService,
  ) {}

  async obtener(usuarioId: number): Promise<UsuarioPerfilDto> {
    const perfil = await this.usuarios.obtenerPerfil(usuarioId);
    if (!perfil) throw new UnauthorizedException('Sesión no válida o vencida');
    const fundacion =
      perfil.rol === 'fundacion' ? await this.fundaciones.obtenerPorUsuarioId(usuarioId) : null;
    return {
      id: perfil.id,
      email: perfil.email,
      telefono: perfil.telefono,
      rol: perfil.rol,
      adoptante: perfil.adoptante,
      fundacion: fundacion && {
        id: fundacion.id,
        nombre: fundacion.nombre,
        estadoValidacion: fundacion.estadoValidacion,
        observacionValidacion: fundacion.observacionValidacion,
      },
    };
  }
}
