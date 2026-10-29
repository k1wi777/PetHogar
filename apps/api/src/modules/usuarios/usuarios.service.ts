import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { desplazamiento, type Paginado, paginar } from '../../common/pagination/paginar';
import type { PaginacionQueryDto } from '../../common/pagination/paginacion-query.dto';
import type { RolNombre } from '../../common/auth/usuario-autenticado';
import type { Usuario } from './entities/usuario.entity';
import { UsuariosRepository } from './usuarios.repository';
import type {
  AdoptanteBasico,
  ContactoActivo,
  DatosNuevoAdoptante,
  DatosNuevoUsuarioFundacion,
  FiltroUsuarios,
  PerfilUsuario,
  UsuarioAdmin,
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

  estaActiva(id: number): Promise<boolean> {
    return this.repo.estaActiva(id);
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

  /** `null` si el usuario no es un adoptante. */
  async adoptantePorUsuarioId(usuarioId: number): Promise<AdoptanteBasico | null> {
    const adoptante = await this.repo.buscarAdoptantePorUsuarioId(usuarioId);
    if (!adoptante) return null;
    const nombres = [
      adoptante.primerNombre,
      adoptante.segundoNombre,
      adoptante.primerApellido,
      adoptante.segundoApellido,
    ];
    return {
      id: adoptante.id,
      usuarioId,
      nombreCompleto: nombres.filter(Boolean).join(' '),
    };
  }

  /** `null` si la cuenta no existe o está desactivada (no debe recibir avisos). */
  async contactoActivo(usuarioId: number): Promise<ContactoActivo | null> {
    const fila = await this.repo.buscarContactoActivo(usuarioId);
    return fila && { email: fila.email, nombre: fila.primerNombre };
  }

  usuarioIdDeAdoptante(adoptanteId: number): Promise<number | null> {
    return this.repo.buscarUsuarioIdDeAdoptante(adoptanteId);
  }

  idsAdministradoresActivos(): Promise<number[]> {
    return this.repo.listarIdsAdministradoresActivos();
  }

  /** Nombre completo de los adoptantes entre `usuarioIds` (los demás usuarios no aparecen). */
  async nombresPorUsuarioIds(usuarioIds: number[]): Promise<Map<number, string>> {
    if (usuarioIds.length === 0) return new Map();
    const adoptantes = await this.repo.buscarAdoptantesPorUsuarioIds(usuarioIds);
    return new Map(
      adoptantes.map((a) => [
        a.usuarioId,
        [a.primerNombre, a.segundoNombre, a.primerApellido, a.segundoApellido]
          .filter(Boolean)
          .join(' '),
      ]),
    );
  }

  async listar(
    filtros: FiltroUsuarios,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<UsuarioAdmin>> {
    const { skip, take } = desplazamiento(paginacion);
    const [filas, total] = await this.repo.listarParaAdmin(filtros, skip, take);
    return paginar(filas, total, paginacion);
  }

  /**
   * Activa o desactiva una cuenta dentro de la transacción del llamador (`manager`). Desactivar
   * a un administrador exige que quede otro activo: el bloqueo asesor serializa a dos
   * administradores que se desactiven mutuamente a la vez. Idempotente.
   */
  async cambiarEstado(id: number, activo: boolean, manager: EntityManager): Promise<UsuarioAdmin> {
    const actual = await this.repo.obtenerParaAdmin(id, manager);
    if (!actual) throw new NotFoundException('El usuario no existe');

    if (actual.activo && !activo && actual.rol === 'administrador') {
      await this.repo.bloquearAdministradores(manager);
      if ((await this.repo.contarAdministradoresActivosExcepto(id, manager)) === 0) {
        throw new ConflictException('Debe haber al menos un administrador activo');
      }
    }
    await this.repo.actualizarActivo(id, activo, manager);
    return { ...actual, activo };
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

  /** `true` si se emitió; `false` si la cuenta no puede recibirlo o el enfriamiento sigue vigente. */
  guardarCodigoRecuperacion(
    id: number,
    hash: string,
    expira: Date,
    expiraMaxima: Date,
  ): Promise<boolean> {
    return this.repo.guardarCodigoRecuperacion(id, hash, expira, expiraMaxima);
  }

  reclamarIntentoCodigo(id: number, maxIntentos: number, ahora: Date): Promise<string | null> {
    return this.repo.reclamarIntentoCodigo(id, maxIntentos, ahora);
  }

  restablecerContrasena(
    id: number,
    hashCodigo: string,
    contrasenaHash: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    return this.repo.restablecerContrasena(id, hashCodigo, contrasenaHash, manager);
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
