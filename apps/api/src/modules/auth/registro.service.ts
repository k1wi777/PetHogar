import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { FoundationRegistered } from '../../common/events';
import { emitirSeguro } from '../../common/events/emitir-seguro';
import { IMailService, MAIL_SERVICE } from '../mail/mail.interface';
import { EstadoValidacion } from '../fundaciones/entities/fundacion.enum';
import { FundacionesService } from '../fundaciones/fundaciones.service';
import { IStorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import { hashearContrasena } from './contrasena';
import type { RegistroAdoptanteDto } from './dto/registro-adoptante.dto';
import type { RegistroFundacionDto } from './dto/registro-fundacion.dto';
import type { RegistroFundacionRespuestaDto } from './dto/respuestas.dto';
import { traducirErrorUnico } from './errores-unicos';
import { esMayorDeEdad } from './mayoria-edad';
import { VerificacionService } from './verificacion.service';

export const MENSAJE_REGISTRO_ADOPTANTE =
  'Registro exitoso. Revisa tu correo y confirma tu cuenta con el enlace que te enviamos.';
export const MENSAJE_REGISTRO_FUNDACION =
  'Recibimos el registro de tu fundación. Un administrador revisará tu documento y te avisaremos cuando sea aprobada.';

const MENSAJE_EMAIL_DUPLICADO = 'Ya existe una cuenta registrada con este correo';
const MENSAJE_DOCUMENTO_DUPLICADO = 'Ya existe una cuenta registrada con este número de documento';
const MENSAJE_NIT_DUPLICADO = 'Ya existe una fundación registrada con este NIT';

@Injectable()
export class RegistroService {
  private readonly logger = new Logger(RegistroService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly usuarios: UsuariosService,
    private readonly fundaciones: FundacionesService,
    private readonly verificacion: VerificacionService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
    @Inject(MAIL_SERVICE) private readonly mail: IMailService,
    private readonly eventos: EventEmitter2,
  ) {}

  async registrarAdoptante(dto: RegistroAdoptanteDto): Promise<{ mensaje: string }> {
    const ahora = new Date();
    if (!esMayorDeEdad(dto.fechaNacimiento, ahora)) {
      throw new BadRequestException('Debes ser mayor de 18 años para registrarte');
    }
    if (await this.usuarios.existeEmail(dto.email)) {
      throw new ConflictException(MENSAJE_EMAIL_DUPLICADO);
    }
    if (await this.usuarios.existeDocumento(dto.numeroDocumento)) {
      throw new ConflictException(MENSAJE_DOCUMENTO_DUPLICADO);
    }

    const contrasenaHash = await hashearContrasena(dto.contrasena);
    const token = this.verificacion.generarToken(ahora);
    try {
      await this.dataSource.transaction((manager) =>
        this.usuarios.crearAdoptante(
          {
            email: dto.email,
            contrasenaHash,
            telefono: dto.telefono,
            aceptaPoliticaDatos: true,
            fechaAceptacion: ahora,
            primerNombre: dto.primerNombre,
            segundoNombre: dto.segundoNombre || null,
            primerApellido: dto.primerApellido,
            segundoApellido: dto.segundoApellido || null,
            tipoDocumento: dto.tipoDocumento,
            numeroDocumento: dto.numeroDocumento,
            fechaNacimiento: dto.fechaNacimiento,
            direccion: dto.direccion,
            ciudad: dto.ciudad,
            tokenVerificacionHash: token.hash,
            tokenVerificacionExpira: token.expira,
          },
          manager,
        ),
      );
    } catch (error) {
      throw traducirErrorUnico(error);
    }

    // Después del commit: un fallo de correo no deshace el registro (puede pedir reenvío).
    await this.verificacion.enviarCorreo(dto.email, dto.primerNombre, token.token);
    return { mensaje: MENSAJE_REGISTRO_ADOPTANTE };
  }

  async registrarFundacion(
    dto: RegistroFundacionDto,
    documento: Express.Multer.File | undefined,
  ): Promise<RegistroFundacionRespuestaDto> {
    if (!documento) {
      throw new BadRequestException(
        'Debes adjuntar el documento legal de la fundación (JPG, PNG o PDF)',
      );
    }
    if (await this.usuarios.existeEmail(dto.email)) {
      throw new ConflictException(MENSAJE_EMAIL_DUPLICADO);
    }
    if (await this.fundaciones.existeNit(dto.nit)) {
      throw new ConflictException(MENSAJE_NIT_DUPLICADO);
    }

    const contrasenaHash = await hashearContrasena(dto.contrasena);
    // El storage valida tipo por firma binaria y tamaño; la carpeta `fundaciones` es privada.
    const guardado = await this.storage.guardar(
      { buffer: documento.buffer, nombreOriginal: documento.originalname },
      { categoria: 'documento', carpeta: 'fundaciones' },
    );

    let fundacionId: number;
    try {
      fundacionId = await this.dataSource.transaction(async (manager) => {
        const usuario = await this.usuarios.crearUsuarioFundacion(
          {
            email: dto.email,
            contrasenaHash,
            telefono: dto.telefono,
            aceptaPoliticaDatos: true,
            fechaAceptacion: new Date(),
          },
          manager,
        );
        const fundacion = await this.fundaciones.crear(
          {
            usuarioId: usuario.id,
            nombre: dto.nombre,
            nit: dto.nit,
            direccion: dto.direccion,
            ciudad: dto.ciudad,
            descripcion: dto.descripcion || null,
            documentoClave: guardado.clave,
          },
          manager,
        );
        return fundacion.id;
      });
    } catch (error) {
      await this.limpiarArchivo(guardado.clave);
      throw traducirErrorUnico(error);
    }

    // Solo tras el COMMIT: avisa a los administradores de que hay una fundación por validar.
    emitirSeguro(
      this.eventos,
      FoundationRegistered.eventName,
      new FoundationRegistered(fundacionId),
      this.logger,
    );
    await this.mail.enviar({
      para: dto.email,
      plantilla: 'registro-fundacion-recibido',
      datos: { nombreFundacion: dto.nombre },
    });
    return { mensaje: MENSAJE_REGISTRO_FUNDACION, estadoValidacion: EstadoValidacion.Pendiente };
  }

  /** Su propio fallo se registra y nunca oculta el error original del registro. */
  private async limpiarArchivo(clave: string): Promise<void> {
    try {
      await this.storage.eliminar(clave);
    } catch (error) {
      this.logger.error(`No se pudo eliminar el archivo huérfano ${clave}`, String(error));
    }
  }
}
