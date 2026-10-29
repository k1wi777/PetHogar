import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueryFailedError } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { FollowUpScheduled } from '../../common/events';
import { emitirSeguro } from '../../common/events/emitir-seguro';
import { desplazamiento, type Paginado, paginar } from '../../common/pagination/paginar';
import type { PaginacionQueryDto } from '../../common/pagination/paginacion-query.dto';
import { Reloj } from '../../common/reloj/reloj';
import { hoyEnBogota, inicioDelDiaEnBogota } from '../../common/validation/fecha';
import { EstadoAdopcion } from '../adopciones/entities/adopcion.enum';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { ProgramarSeguimientoDto } from './dto/programar-seguimiento.dto';
import {
  CONSTRAINT_PENDIENTE,
  MENSAJE_ADOPCION_NO_EXISTE,
  MENSAJE_DUPLICADO,
  MENSAJE_SEGUIMIENTO_NO_EXISTE,
  MENSAJE_SOLO_ADOPTANTES,
} from './seguimientos.constants';
import { SeguimientosRepository } from './seguimientos.repository';
import type {
  FiltroSeguimientos,
  ResumenSeguimiento,
  SeguimientoDetalleAdoptante,
  SeguimientoDetalleFundacion,
  SeguimientoListaAdoptante,
  SeguimientoListaFundacion,
} from './seguimientos.types';

/** Programar, consultar por rol y las piezas que `adopciones` usa (resumen y cancelación al cerrar). */
@Injectable()
export class SeguimientosService {
  private readonly logger = new Logger(SeguimientosService.name);

  constructor(
    private readonly repo: SeguimientosRepository,
    private readonly usuarios: UsuariosService,
    private readonly eventos: EventEmitter2,
    private readonly reloj: Reloj,
  ) {}

  /**
   * Crea un seguimiento `programado` en una adopción activa de la fundación. El `FOR SHARE` de la
   * adopción serializa esta operación contra el cierre (B-32) y comprueba la propiedad; el índice
   * único parcial resuelve el doble envío. El evento sale solo después del commit.
   */
  async programar(
    fundacionId: number,
    adopcionId: number,
    dto: ProgramarSeguimientoDto,
  ): Promise<SeguimientoDetalleFundacion> {
    const hoy = hoyEnBogota(this.reloj.ahora());
    const seguimientoId = await this.repo.enTransaccion(async (manager) => {
      const adopcion = await this.repo.bloquearAdopcionParaProgramar(
        manager,
        adopcionId,
        fundacionId,
      );
      if (!adopcion) throw new NotFoundException(MENSAJE_ADOPCION_NO_EXISTE);
      if (adopcion.estado !== EstadoAdopcion.Activa) {
        throw new ConflictException(`La adopción ya está ${adopcion.estado}`);
      }
      if (dto.fechaProgramada <= adopcion.fechaEntrega) {
        throw new BadRequestException(
          `La fecha del seguimiento debe ser posterior a la fecha de entrega (${adopcion.fechaEntrega})`,
        );
      }
      if (dto.fechaProgramada < hoy) {
        throw new BadRequestException('La fecha del seguimiento no puede ser anterior a hoy');
      }
      return this.insertar(manager, adopcionId, dto);
    });

    emitirSeguro(
      this.eventos,
      FollowUpScheduled.eventName,
      new FollowUpScheduled(seguimientoId, adopcionId, inicioDelDiaEnBogota(dto.fechaProgramada)),
      this.logger,
    );
    return this.obtenerDeFundacion(fundacionId, seguimientoId);
  }

  private async insertar(
    manager: EntityManager,
    adopcionId: number,
    dto: ProgramarSeguimientoDto,
  ): Promise<number> {
    try {
      return await this.repo.insertar(manager, adopcionId, dto.tipo, dto.fechaProgramada);
    } catch (error) {
      throw esViolacionDePendiente(error) ? new ConflictException(MENSAJE_DUPLICADO) : error;
    }
  }

  // ---- Lecturas por rol ---------------------------------------------------------------------

  async listarDeFundacion(
    fundacionId: number,
    filtro: FiltroSeguimientos,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<SeguimientoListaFundacion>> {
    const { skip, take } = desplazamiento(paginacion);
    const hoy = hoyEnBogota(this.reloj.ahora());
    const [filas, total] = await this.repo.listarDeFundacion(fundacionId, filtro, hoy, skip, take);
    return paginar(filas, total, paginacion);
  }

  async obtenerDeFundacion(fundacionId: number, id: number): Promise<SeguimientoDetalleFundacion> {
    const hoy = hoyEnBogota(this.reloj.ahora());
    const seguimiento = await this.repo.obtenerDeFundacion(id, fundacionId, hoy);
    if (!seguimiento) throw new NotFoundException(MENSAJE_SEGUIMIENTO_NO_EXISTE);
    return seguimiento;
  }

  async listarMios(
    usuarioId: number,
    filtro: FiltroSeguimientos,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<SeguimientoListaAdoptante>> {
    const adoptanteId = await this.adoptanteIdDe(usuarioId);
    const { skip, take } = desplazamiento(paginacion);
    const hoy = hoyEnBogota(this.reloj.ahora());
    const [filas, total] = await this.repo.listarDeAdoptante(adoptanteId, filtro, hoy, skip, take);
    return paginar(filas, total, paginacion);
  }

  async obtenerMio(usuarioId: number, id: number): Promise<SeguimientoDetalleAdoptante> {
    const adoptanteId = await this.adoptanteIdDe(usuarioId);
    const hoy = hoyEnBogota(this.reloj.ahora());
    const seguimiento = await this.repo.obtenerDeAdoptante(id, adoptanteId, hoy);
    if (!seguimiento) throw new NotFoundException(MENSAJE_SEGUIMIENTO_NO_EXISTE);
    return seguimiento;
  }

  // ---- Piezas para `adopciones` -------------------------------------------------------------

  /** Una consulta posterior a la paginación de adopciones: sin N+1 y sin alterar su `total`. */
  resumenPorAdopciones(adopcionIds: readonly number[]): Promise<Map<number, ResumenSeguimiento[]>> {
    return this.repo.resumenPorAdopciones(adopcionIds, hoyEnBogota(this.reloj.ahora()));
  }

  /** Paso del cierre de la adopción: se ejecuta en la transacción del orquestador (`manager`). */
  async cancelarPendientesDeAdopcion(adopcionId: number, manager: EntityManager): Promise<number> {
    return (await this.repo.cancelarPendientesDeAdopcion(manager, adopcionId)).length;
  }

  private async adoptanteIdDe(usuarioId: number): Promise<number> {
    const adoptante = await this.usuarios.adoptantePorUsuarioId(usuarioId);
    if (!adoptante) throw new ForbiddenException(MENSAJE_SOLO_ADOPTANTES);
    return adoptante.id;
  }
}

function esViolacionDePendiente(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const { code, constraint } = error.driverError as { code?: string; constraint?: string };
  return code === '23505' && constraint === CONSTRAINT_PENDIENTE;
}
