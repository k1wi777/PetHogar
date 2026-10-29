import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { RolNombre } from '../../common/auth/usuario-autenticado';
import type { Usuario } from './entities/usuario.entity';
import { UsuariosRepository } from './usuarios.repository';
import type {
  DatosNuevoAdoptante,
  DatosNuevoUsuarioFundacion,
  PerfilUsuario,
  UsuarioCreado,
  UsuarioCredenciales,
} from './usuarios.types';

/** Dueño de `usuario`, `adoptante` y `rol`. Devuelve objetos de dominio, nunca entidades. */
@Injectable()
export class UsuariosService {
  constructor(private readonly repo: UsuariosRepository) {}

  async crearAdoptante(
    datos: DatosNuevoAdoptante,
    manager?: EntityManager,
  ): Promise<UsuarioCreado> {
    const usuario = await this.repo.crearAdoptante(datos, manager);
    return { id: usuario.id, email: usuario.email };
  }

  async crearUsuarioFundacion(
    datos: DatosNuevoUsuarioFundacion,
    manager?: EntityManager,
  ): Promise<UsuarioCreado> {
    const usuario = await this.repo.crearUsuarioFundacion(datos, manager);
    return { id: usuario.id, email: usuario.email };
  }

  async buscarPorEmail(email: string): Promise<UsuarioCredenciales | null> {
    const usuario = await this.repo.buscarPorEmail(email);
    return usuario ? aCredenciales(usuario) : null;
  }

  async buscarPorId(id: number): Promise<UsuarioCredenciales | null> {
    const usuario = await this.repo.buscarPorId(id);
    return usuario ? aCredenciales(usuario) : null;
  }

  existeEmail(email: string): Promise<boolean> {
    return this.repo.existeEmail(email);
  }

  existeDocumento(numeroDocumento: string): Promise<boolean> {
    return this.repo.existeDocumento(numeroDocumento);
  }

  async obtenerPerfil(id: number): Promise<PerfilUsuario | null> {
    const usuario = await this.repo.buscarPorId(id);
    if (!usuario) return null;
    const adoptante = await this.repo.buscarAdoptantePorUsuarioId(id);
    return {
      id: usuario.id,
      email: usuario.email,
      telefono: usuario.telefono,
      rol: usuario.rol.nombre as RolNombre,
      adoptante: adoptante && {
        primerNombre: adoptante.primerNombre,
        segundoNombre: adoptante.segundoNombre,
        primerApellido: adoptante.primerApellido,
        segundoApellido: adoptante.segundoApellido,
      },
    };
  }

  registrarIntentoFallido(
    id: number,
    maxIntentos: number,
    bloqueoMs: number,
    ahora: Date,
  ): Promise<void> {
    return this.repo.registrarIntentoFallido(id, maxIntentos, bloqueoMs, ahora);
  }

  reiniciarIntentos(id: number): Promise<void> {
    return this.repo.reiniciarIntentos(id);
  }

  guardarTokenVerificacion(id: number, hash: string, expira: Date): Promise<void> {
    return this.repo.guardarTokenVerificacion(id, hash, expira);
  }

  /** `true` si el token era válido y la cuenta quedó verificada; el token no vuelve a servir. */
  consumirTokenVerificacion(hash: string, ahora: Date): Promise<boolean> {
    return this.repo.consumirTokenVerificacion(hash, ahora);
  }
}

function aCredenciales(usuario: Usuario): UsuarioCredenciales {
  return {
    id: usuario.id,
    email: usuario.email,
    contrasenaHash: usuario.contrasena,
    rol: usuario.rol.nombre as RolNombre,
    activo: usuario.activo,
    emailVerificado: usuario.emailVerificado,
    intentosFallidos: usuario.intentosFallidos,
    bloqueadoHasta: usuario.bloqueadoHasta,
    tokenVerificacionExpira: usuario.tokenVerificacionExpira,
  };
}
