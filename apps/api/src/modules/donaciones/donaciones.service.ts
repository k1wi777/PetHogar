import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { UsuarioAutenticado } from '../../common/auth/usuario-autenticado';
import { DonationRegistered } from '../../common/events';
import { emitirSeguro } from '../../common/events/emitir-seguro';
import { InstantaneaService } from '../../common/database/instantanea.service';
import { desplazamiento } from '../../common/pagination/paginar';
import { inicioDelDiaEnBogota } from '../../common/validation/fecha';
import { EstadoValidacion } from '../fundaciones/entities/fundacion.enum';
import { FundacionesService } from '../fundaciones/fundaciones.service';
import type { FundacionBasica } from '../fundaciones/fundaciones.types';
import { STORAGE_SERVICE, type IStorageService } from '../storage/storage.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import {
  MENSAJE_DONACION_PROPIA,
  MENSAJE_FUNDACION_NO_RECIBE,
  MENSAJE_PERIODO_INVERTIDO,
} from './donaciones.constants';
import { construirTotales, totalDeFilas, urlComprobante } from './donaciones.mapeo';
import { DonacionesRepository } from './donaciones.repository';
import type {
  DonacionDeFundacion,
  DonacionesDeFundacion,
  DonacionParaAviso,
  DonacionResumen,
  FilaDonacion,
  FiltroDonaciones,
} from './donaciones.types';
import type { CamposDonacionDto } from './dto/campos-donacion.dto';
import type { ConsultaDonacionesDto } from './dto/consulta-donaciones.dto';
import type { CrearDonacionManualDto } from './dto/crear-donacion-manual.dto';
import type { CrearDonacionDto } from './dto/crear-donacion.dto';
import { TipoDonacion } from './entities/donacion.enum';
import { normalizarMonto } from './monto';

const UN_DIA_MS = 86_400_000;
const NOMBRE_DONANTE_SIN_DATOS = 'Donante registrado';

interface Registro {
  fundacion: FundacionBasica;
  usuarioId: number | null;
  nombreDonante: string | null;
  campos: CamposDonacionDto;
  comprobante: Buffer | undefined;
}

/**
 * Dueño de `donacion`. No hay pasarela de pago: solo se registra el aporte y, si existe, su
 * comprobante (en la carpeta privada `donaciones`).
 */
@Injectable()
export class DonacionesService {
  private readonly logger = new Logger(DonacionesService.name);

  constructor(
    private readonly repo: DonacionesRepository,
    private readonly fundaciones: FundacionesService,
    private readonly usuarios: UsuariosService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
    private readonly eventos: EventEmitter2,
    private readonly instantanea: InstantaneaService,
  ) {}

  /** Donación de un usuario registrado: el donante es siempre el del token. */
  async crear(
    usuario: UsuarioAutenticado,
    dto: CrearDonacionDto,
    comprobante?: Buffer,
  ): Promise<DonacionResumen> {
    const fundacion = await this.fundaciones.datosBasicos(dto.fundacionId);
    // 404 uniforme: un 409 revelaría que la fundación existe pero está pendiente.
    if (!fundacion || fundacion.estadoValidacion !== EstadoValidacion.Aprobada) {
      throw new NotFoundException(MENSAJE_FUNDACION_NO_RECIBE);
    }
    if (fundacion.usuarioId === usuario.id) throw new ForbiddenException(MENSAJE_DONACION_PROPIA);

    const resumen = await this.registrar({
      fundacion,
      usuarioId: usuario.id,
      nombreDonante: null,
      campos: dto,
      comprobante,
    });
    // Solo tras confirmar el INSERT.
    emitirSeguro(
      this.eventos,
      DonationRegistered.eventName,
      new DonationRegistered(resumen.id, fundacion.id, usuario.id),
      this.logger,
    );
    return resumen;
  }

  /**
   * Aporte presencial registrado por la fundación (del token), sin usuario donante. No emite
   * `DonationRegistered`: no hay a quién confirmar y los totales se leen de la tabla.
   */
  async crearManual(
    fundacionId: number,
    dto: CrearDonacionManualDto,
    comprobante?: Buffer,
  ): Promise<DonacionResumen> {
    const fundacion = await this.fundaciones.datosBasicos(fundacionId);
    if (!fundacion) throw new NotFoundException(MENSAJE_FUNDACION_NO_RECIBE);
    return this.registrar({
      fundacion,
      usuarioId: null,
      nombreDonante: dto.nombreDonante,
      campos: dto,
      comprobante,
    });
  }

  async listar(
    fundacionId: number,
    consulta: ConsultaDonacionesDto,
  ): Promise<DonacionesDeFundacion> {
    const filtro = filtroDePeriodo(consulta);
    const { skip, take } = desplazamiento(consulta);
    // Misma instantánea para la página y el agregado: bajo escrituras concurrentes el total y los
    // totales por tipo coinciden con lo que contiene la página (las lecturas van en serie).
    const { filas, agregado } = await this.instantanea.leer(async (manager) => ({
      filas: await this.repo.listar(fundacionId, filtro, skip, take, manager),
      agregado: await this.repo.agregar(fundacionId, filtro, manager),
    }));
    return {
      data: await this.conDonantes(filas),
      // Mismo filtro que la página (misma cláusula): el total es la suma del agregado.
      total: totalDeFilas(agregado),
      page: consulta.page,
      limit: consulta.limit,
      totales: construirTotales(agregado),
    };
  }

  /** Para los avisos; `null` si la donación ya no existe. */
  datosParaAviso(donacionId: number): Promise<DonacionParaAviso | null> {
    return this.repo.buscarParaAviso(donacionId);
  }

  /** Valida → guarda el comprobante → inserta; si el INSERT falla se borra el archivo. */
  private async registrar(registro: Registro): Promise<DonacionResumen> {
    const { fundacion, campos } = registro;
    const economica = campos.tipo === TipoDonacion.Economica;
    if (economica && !campos.monto) throw new BadRequestException('Indica el monto de la donación');
    if (!economica && !campos.descripcion) {
      throw new BadRequestException('Describe lo que donas');
    }

    let clave: string | undefined;
    try {
      if (registro.comprobante) {
        const guardado = await this.storage.guardar(
          { buffer: registro.comprobante },
          { categoria: 'documento', carpeta: 'donaciones' },
        );
        clave = guardado.clave;
      }
      const guardada = await this.repo.insertar({
        fundacionId: fundacion.id,
        usuarioId: registro.usuarioId,
        nombreDonante: registro.nombreDonante,
        tipo: campos.tipo,
        monto: economica ? normalizarMonto(campos.monto as string) : null,
        descripcionEspecie: economica ? null : (campos.descripcion as string),
        comprobanteClave: clave ?? null,
      });
      return {
        id: guardada.id,
        fundacion: { id: fundacion.id, nombre: fundacion.nombre },
        tipo: campos.tipo,
        monto: guardada.monto,
        descripcionEspecie: economica ? null : (campos.descripcion as string),
        fecha: guardada.fecha,
        comprobante: clave !== undefined,
      };
    } catch (error) {
      if (clave) await this.eliminarArchivo(clave);
      throw error;
    }
  }

  /** Nombre del donante en lote tras paginar: sin joins ni N+1 y sin tocar tablas ajenas. */
  private async conDonantes(filas: FilaDonacion[]): Promise<DonacionDeFundacion[]> {
    const ids = [...new Set(filas.flatMap((f) => (f.usuarioId === null ? [] : [f.usuarioId])))];
    const adoptantes = await this.usuarios.nombresPorUsuarioIds(ids);
    const restantes = ids.filter((id) => !adoptantes.has(id));
    const fundaciones = await this.fundaciones.nombresPorUsuarioIds(restantes);
    return filas.map((fila) => ({
      id: fila.id,
      tipo: fila.tipo,
      monto: fila.monto,
      descripcionEspecie: fila.descripcionEspecie,
      fecha: fila.fecha,
      donante:
        fila.usuarioId === null
          ? { nombre: fila.nombreDonante ?? NOMBRE_DONANTE_SIN_DATOS, origen: 'manual' }
          : {
              nombre:
                adoptantes.get(fila.usuarioId) ??
                fundaciones.get(fila.usuarioId) ??
                NOMBRE_DONANTE_SIN_DATOS,
              origen: 'plataforma',
            },
      comprobante: fila.tieneComprobante ? { url: urlComprobante(fila.id) } : null,
    }));
  }

  /** Su propio fallo se registra y nunca oculta el error original. */
  private async eliminarArchivo(clave: string): Promise<void> {
    try {
      await this.storage.eliminar(clave);
    } catch (error) {
      this.logger.error(`No se pudo eliminar el archivo huérfano ${clave}`, String(error));
    }
  }
}

/**
 * Periodo en fechas de Bogotá con ambos extremos incluidos, como intervalo semiabierto:
 * `fecha >= 00:00 del primer día` y `fecha < 00:00 del día siguiente al último`.
 */
export function filtroDePeriodo(consulta: ConsultaDonacionesDto): FiltroDonaciones {
  if (consulta.desde && consulta.hasta && consulta.hasta < consulta.desde) {
    throw new BadRequestException(MENSAJE_PERIODO_INVERTIDO);
  }
  return {
    desde: consulta.desde ? inicioDelDiaEnBogota(consulta.desde) : undefined,
    hastaExclusivo: consulta.hasta
      ? new Date(inicioDelDiaEnBogota(consulta.hasta).getTime() + UN_DIA_MS)
      : undefined,
    tipo: consulta.tipo,
  };
}
