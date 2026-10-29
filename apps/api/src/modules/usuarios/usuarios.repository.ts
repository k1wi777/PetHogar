import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Adoptante } from './entities/adoptante.entity';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import type { DatosNuevoAdoptante, DatosNuevoUsuarioFundacion } from './usuarios.types';

/** `manager` opcional: permite participar en la transacción abierta por quien orquesta. */
@Injectable()
export class UsuariosRepository {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Adoptante) private readonly adoptantes: Repository<Adoptante>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
  ) {}

  private usuariosEn(manager?: EntityManager): Repository<Usuario> {
    return manager?.getRepository(Usuario) ?? this.usuarios;
  }

  buscarPorEmail(email: string): Promise<Usuario | null> {
    return this.usuarios.findOne({ where: { email }, relations: { rol: true } });
  }

  buscarPorId(id: number): Promise<Usuario | null> {
    return this.usuarios.findOne({ where: { id }, relations: { rol: true } });
  }

  buscarAdoptantePorUsuarioId(usuarioId: number): Promise<Adoptante | null> {
    return this.adoptantes.findOne({ where: { usuarioId } });
  }

  existeEmail(email: string): Promise<boolean> {
    return this.usuarios.exists({ where: { email } });
  }

  existeDocumento(numeroDocumento: string): Promise<boolean> {
    return this.adoptantes.exists({ where: { numeroDocumento } });
  }

  async crearAdoptante(datos: DatosNuevoAdoptante, manager?: EntityManager): Promise<Usuario> {
    const usuario = await this.insertarUsuario('adoptante', datos, manager, {
      emailVerificado: false,
      tokenVerificacionHash: datos.tokenVerificacionHash,
      tokenVerificacionExpira: datos.tokenVerificacionExpira,
    });
    const repoAdoptantes = manager?.getRepository(Adoptante) ?? this.adoptantes;
    await repoAdoptantes.insert({
      usuarioId: usuario.id,
      primerNombre: datos.primerNombre,
      segundoNombre: datos.segundoNombre,
      primerApellido: datos.primerApellido,
      segundoApellido: datos.segundoApellido,
      tipoDocumento: datos.tipoDocumento,
      numeroDocumento: datos.numeroDocumento,
      fechaNacimiento: datos.fechaNacimiento,
      direccion: datos.direccion,
      ciudad: datos.ciudad,
    });
    return usuario;
  }

  crearUsuarioFundacion(
    datos: DatosNuevoUsuarioFundacion,
    manager?: EntityManager,
  ): Promise<Usuario> {
    return this.insertarUsuario('fundacion', datos, manager, { emailVerificado: true });
  }

  private async insertarUsuario(
    rolNombre: string,
    datos: DatosNuevoUsuarioFundacion,
    manager: EntityManager | undefined,
    extra: Partial<Usuario>,
  ): Promise<Usuario> {
    const rol = await (manager?.getRepository(Rol) ?? this.roles).findOneByOrFail({
      nombre: rolNombre,
    });
    const repo = this.usuariosEn(manager);
    const usuario = repo.create({
      rolId: rol.id,
      email: datos.email,
      contrasena: datos.contrasenaHash,
      telefono: datos.telefono,
      aceptaPoliticaDatos: datos.aceptaPoliticaDatos,
      fechaAceptacion: datos.fechaAceptacion,
      ...extra,
    });
    return repo.save(usuario);
  }

  /**
   * Una sola sentencia: dos intentos paralelos no pueden superar el límite ni ampliar un
   * bloqueo vigente. Si el bloqueo previo ya venció, el contador vuelve a empezar en 1.
   */
  async registrarIntentoFallido(
    id: number,
    maxIntentos: number,
    bloqueoMs: number,
    ahora: Date,
  ): Promise<void> {
    const vencido = '("bloqueado_hasta" IS NOT NULL AND "bloqueado_hasta" <= :ahora)';
    const nuevoContador = `(CASE WHEN ${vencido} THEN 1 ELSE "intentos_fallidos" + 1 END)`;
    await this.usuarios
      .createQueryBuilder()
      .update(Usuario)
      .set({
        intentosFallidos: () => nuevoContador,
        bloqueadoHasta: () =>
          `(CASE WHEN "bloqueado_hasta" > :ahora THEN "bloqueado_hasta"
                 WHEN ${nuevoContador} >= :max THEN :hasta
                 ELSE NULL END)`,
      })
      .where('id = :id', { id })
      .setParameters({ ahora, max: maxIntentos, hasta: new Date(ahora.getTime() + bloqueoMs) })
      .execute();
  }

  async reiniciarIntentos(id: number): Promise<void> {
    await this.usuarios.update({ id }, { intentosFallidos: 0, bloqueadoHasta: null });
  }

  async guardarTokenVerificacion(id: number, hash: string, expira: Date): Promise<void> {
    await this.usuarios.update(
      { id },
      { tokenVerificacionHash: hash, tokenVerificacionExpira: expira },
    );
  }

  /** Un único UPDATE: el token se consume una sola vez aunque lleguen dos peticiones a la vez. */
  async consumirTokenVerificacion(hash: string, ahora: Date): Promise<boolean> {
    const resultado = await this.usuarios
      .createQueryBuilder()
      .update(Usuario)
      .set({ emailVerificado: true, tokenVerificacionHash: null, tokenVerificacionExpira: null })
      .where(
        '"token_verificacion_hash" = :hash AND "token_verificacion_expira" > :ahora AND "email_verificado" = false',
        { hash, ahora },
      )
      .execute();
    return (resultado.affected ?? 0) > 0;
  }
}
