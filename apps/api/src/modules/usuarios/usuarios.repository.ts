import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { Adoptante } from './entities/adoptante.entity';
import { Rol } from './entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import { construirFiltroUsuarios, SQL_NOMBRE_USUARIO } from './usuarios.filtros';
import type {
  DatosNuevoAdoptante,
  DatosNuevoUsuarioFundacion,
  FiltroUsuarios,
  UsuarioAdmin,
} from './usuarios.types';

const BLOQUEO_ADMINISTRADORES = 'usuarios:administradores';

interface FilaUsuarioAdmin {
  id: number;
  email: string;
  telefono: string;
  rol: UsuarioAdmin['rol'];
  activo: boolean;
  email_verificado: boolean;
  fecha_creacion: Date;
  nombre: string | null;
}

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

  /** Consulta por clave primaria: existe y está activo. */
  estaActiva(id: number): Promise<boolean> {
    return this.usuarios.exists({ where: { id, activo: true } });
  }

  /** Solo lectura: correo de una cuenta activa o `null` si no existe o está desactivada. */
  async buscarContactoActivo(
    id: number,
  ): Promise<{ email: string; primerNombre: string | null } | null> {
    const fila = await this.usuarios
      .createQueryBuilder('u')
      .leftJoin(Adoptante, 'a', 'a."usuario_id" = u."id"')
      .select(['u."email" AS "email"', 'a."primer_nombre" AS "primerNombre"'])
      .where('u."id" = :id AND u."activo" = true', { id })
      .getRawOne<{ email: string; primerNombre: string | null }>();
    return fila ?? null;
  }

  async buscarUsuarioIdDeAdoptante(adoptanteId: number): Promise<number | null> {
    const adoptante = await this.adoptantes.findOne({
      where: { id: adoptanteId },
      select: { usuarioId: true },
    });
    return adoptante?.usuarioId ?? null;
  }

  async listarIdsAdministradoresActivos(): Promise<number[]> {
    const filas = await this.usuarios
      .createQueryBuilder('u')
      .innerJoin(Rol, 'r', 'r."id" = u."rol_id"')
      .select('u."id"', 'id')
      .where(`r."nombre" = 'administrador' AND u."activo" = true`)
      .orderBy('u."id"', 'ASC')
      .getRawMany<{ id: number }>();
    return filas.map((fila) => fila.id);
  }

  buscarAdoptantesPorUsuarioIds(usuarioIds: number[]): Promise<Adoptante[]> {
    return this.adoptantes.find({ where: { usuarioId: In(usuarioIds) } });
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

  /**
   * Guarda un código de recuperación nuevo (invalida el anterior) en una sola sentencia y solo
   * si la cuenta está activa y verificada y el último envío ya cumplió el enfriamiento:
   * `expiraMaxima` es la expiración más tardía que aún permite emitir otro.
   */
  async guardarCodigoRecuperacion(
    id: number,
    hash: string,
    expira: Date,
    expiraMaxima: Date,
  ): Promise<boolean> {
    const resultado = await this.usuarios
      .createQueryBuilder()
      .update(Usuario)
      .set({ resetCodeHash: hash, resetCodeExpira: expira, resetCodeIntentos: 0 })
      .where(
        `id = :id AND "activo" = true AND "email_verificado" = true
         AND ("reset_code_expira" IS NULL OR "reset_code_expira" <= :expiraMaxima)`,
        { id, expiraMaxima },
      )
      .execute();
    return (resultado.affected ?? 0) > 0;
  }

  /**
   * Reclama un intento de comprobación en una sola sentencia: el contador y el límite se evalúan
   * juntos, así que peticiones paralelas no superan `maxIntentos`. Devuelve el hash vigente o
   * `null` si no hay cuenta activa, código, vigencia o intentos disponibles.
   */
  async reclamarIntentoCodigo(
    id: number,
    maxIntentos: number,
    ahora: Date,
  ): Promise<string | null> {
    const resultado = await this.usuarios
      .createQueryBuilder()
      .update(Usuario)
      .set({ resetCodeIntentos: () => '"reset_code_intentos" + 1' })
      .where(
        `id = :id AND "activo" = true AND "reset_code_hash" IS NOT NULL
         AND "reset_code_expira" > :ahora AND "reset_code_intentos" < :max`,
        { id, ahora, max: maxIntentos },
      )
      .returning('"reset_code_hash"')
      .execute();
    const filas = resultado.raw as { reset_code_hash: string }[];
    return filas[0]?.reset_code_hash ?? null;
  }

  /**
   * Cambia la contraseña consumiendo el código (`hashCodigo` debe seguir vigente en BD) y limpia
   * intentos y bloqueo de login. `false` si otra petición ya lo consumió.
   */
  async restablecerContrasena(
    id: number,
    hashCodigo: string,
    contrasenaHash: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const resultado = await this.usuariosEn(manager)
      .createQueryBuilder()
      .update(Usuario)
      .set({
        contrasena: contrasenaHash,
        resetCodeHash: null,
        resetCodeExpira: null,
        resetCodeIntentos: 0,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      })
      .where('id = :id AND "reset_code_hash" = :hashCodigo', { id, hashCodigo })
      .execute();
    return (resultado.affected ?? 0) > 0;
  }

  /**
   * Base de las consultas de administración: `usuario` con su rol y, si existen, adoptante y
   * fundación (esta última solo en lectura, por nombre de tabla). Las uniones son 1:1.
   */
  private consultaAdmin(manager?: EntityManager): SelectQueryBuilder<Usuario> {
    return this.usuariosEn(manager)
      .createQueryBuilder('u')
      .innerJoin(Rol, 'r', 'r."id" = u."rol_id"')
      .leftJoin(Adoptante, 'a', 'a."usuario_id" = u."id"')
      .leftJoin('fundacion', 'f', 'f."usuario_id" = u."id"');
  }

  async listarParaAdmin(
    filtros: FiltroUsuarios,
    skip: number,
    take: number,
  ): Promise<[UsuarioAdmin[], number]> {
    const { condiciones, parametros } = construirFiltroUsuarios(filtros);
    const filtrada = (): SelectQueryBuilder<Usuario> => {
      const qb = this.consultaAdmin().setParameters(parametros);
      condiciones.forEach((condicion) => qb.andWhere(condicion));
      return qb;
    };
    const total = await filtrada().select('COUNT(u."id")', 'total').getRawOne<{ total: string }>();
    // Desempate por clave primaria: la paginación es estable aunque coincida la fecha.
    const filas = await filtrada()
      .select(COLUMNAS_ADMIN)
      .orderBy('u."fecha_creacion"', 'DESC')
      .addOrderBy('u."id"', 'DESC')
      .offset(skip)
      .limit(take)
      .getRawMany<FilaUsuarioAdmin>();
    return [filas.map(aUsuarioAdmin), Number(total?.total ?? 0)];
  }

  async obtenerParaAdmin(id: number, manager?: EntityManager): Promise<UsuarioAdmin | null> {
    const fila = await this.consultaAdmin(manager)
      .select(COLUMNAS_ADMIN)
      .where('u."id" = :id', { id })
      .getRawOne<FilaUsuarioAdmin>();
    return fila ? aUsuarioAdmin(fila) : null;
  }

  async actualizarActivo(id: number, activo: boolean, manager?: EntityManager): Promise<void> {
    await this.usuariosEn(manager).update({ id }, { activo });
  }

  /** Bloqueo asesor de la transacción: serializa las desactivaciones de administradores. */
  async bloquearAdministradores(manager: EntityManager): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [BLOQUEO_ADMINISTRADORES]);
  }

  contarAdministradoresActivosExcepto(id: number, manager: EntityManager): Promise<number> {
    return manager
      .getRepository(Usuario)
      .createQueryBuilder('u')
      .innerJoin(Rol, 'r', 'r."id" = u."rol_id"')
      .where(`r."nombre" = 'administrador' AND u."activo" = true AND u."id" <> :id`, { id })
      .getCount();
  }
}

const COLUMNAS_ADMIN = [
  'u."id" AS "id"',
  'u."email" AS "email"',
  'u."telefono" AS "telefono"',
  'r."nombre" AS "rol"',
  'u."activo" AS "activo"',
  'u."email_verificado" AS "email_verificado"',
  'u."fecha_creacion" AS "fecha_creacion"',
  `${SQL_NOMBRE_USUARIO} AS "nombre"`,
];

function aUsuarioAdmin(fila: FilaUsuarioAdmin): UsuarioAdmin {
  return {
    id: fila.id,
    email: fila.email,
    telefono: fila.telefono,
    rol: fila.rol,
    activo: fila.activo,
    emailVerificado: fila.email_verificado,
    fechaCreacion: fila.fecha_creacion,
    nombre: fila.nombre,
  };
}
