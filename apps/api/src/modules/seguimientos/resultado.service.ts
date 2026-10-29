import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WellbeingAlertRaised } from '../../common/events';
import { emitirSeguro } from '../../common/events/emitir-seguro';
import { Reloj } from '../../common/reloj/reloj';
import { hoyEnBogota } from '../../common/validation/fecha';
import { STORAGE_SERVICE, type IStorageService } from '../storage/storage.interface';
import { eliminarArchivos, guardarFotos } from './archivos.util';
import type { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import { EstadoSeguimientoMaquina } from './estado-seguimiento.maquina';
import {
  EstadoBienestar,
  EstadoSeguimiento,
  OrigenEvidencia,
  TipoSeguimiento,
} from './entities/seguimiento.enum';
import {
  MAX_FOTOS,
  MENSAJE_REPORTE_PENDIENTE,
  MENSAJE_SEGUIMIENTO_NO_EXISTE,
} from './seguimientos.constants';
import { SeguimientosRepository } from './seguimientos.repository';
import type { SeguimientoDetalleFundacion, SeguimientoParaAccion } from './seguimientos.types';

/** Cierre de un seguimiento por la fundación: resultado, bienestar, observaciones y evidencias. */
@Injectable()
export class ResultadoService {
  private readonly logger = new Logger(ResultadoService.name);

  constructor(
    private readonly repo: SeguimientosRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
    private readonly eventos: EventEmitter2,
    private readonly reloj: Reloj,
  ) {}

  /**
   * Pasa el seguimiento a `realizado` y guarda las evidencias en la misma transacción: o queda
   * todo o nada. El `FOR UPDATE` da una lectura coherente del estado y la fecha de entrega; el
   * `UPDATE` condicionado es la barrera final (un `realizado` nunca se reabre, tampoco con dos
   * cierres simultáneos). La alerta de bienestar sale solo tras el commit y solo con `malo`.
   */
  async registrar(
    id: number,
    fundacionId: number,
    dto: RegistrarResultadoDto,
    evidencias: readonly Buffer[],
  ): Promise<SeguimientoDetalleFundacion> {
    if (evidencias.length > MAX_FOTOS) {
      throw new BadRequestException(`No puedes adjuntar más de ${MAX_FOTOS} fotos`);
    }
    const hoy = hoyEnBogota(this.reloj.ahora());
    const dueno = { tipo: 'fundacion', fundacionId } as const;
    // Antes de guardar archivos: una petición condenada no debe escribir nada en disco.
    validarCierre(await this.repo.buscarParaAccion(id, dueno), dto, hoy);

    const claves = await guardarFotos(this.storage, evidencias, this.logger);
    let seguimiento: SeguimientoParaAccion;
    try {
      seguimiento = await this.repo.enTransaccion(async (manager) => {
        const actual = await this.repo.bloquearParaAccion(manager, id, dueno);
        validarCierre(actual, dto, hoy);
        const registrado = await this.repo.registrarResultado(manager, id, {
          fechaRealizada: dto.fechaRealizada,
          estadoBienestar: dto.estadoBienestar,
          observaciones: dto.observaciones,
        });
        if (!registrado) throw new ConflictException(mensajeDeEstado(actual.estado));
        await this.repo.insertarEvidencias(manager, id, claves, OrigenEvidencia.Fundacion);
        return actual;
      });
    } catch (error) {
      await eliminarArchivos(this.storage, claves, this.logger);
      throw error;
    }

    if (dto.estadoBienestar === EstadoBienestar.Malo) {
      emitirSeguro(
        this.eventos,
        WellbeingAlertRaised.eventName,
        new WellbeingAlertRaised(
          id,
          seguimiento.adopcionId,
          seguimiento.mascotaId,
          seguimiento.fundacionId,
        ),
        this.logger,
      );
    }
    const detalle = await this.repo.obtenerDeFundacion(id, fundacionId, hoy);
    if (!detalle) throw new NotFoundException(MENSAJE_SEGUIMIENTO_NO_EXISTE);
    return detalle;
  }
}

function mensajeDeEstado(estado: EstadoSeguimiento): string {
  return estado === EstadoSeguimiento.Realizado
    ? 'El seguimiento ya fue registrado como realizado'
    : `El seguimiento está ${estado}`;
}

/**
 * 404 uniforme; 409 si ya está cerrado o cancelado o si es un reporte que el adoptante todavía
 * no envió (una visita sí puede cerrarse sin reporte); 400 si la fecha realizada no está entre la
 * entrega y hoy.
 */
function validarCierre(
  seguimiento: SeguimientoParaAccion | null,
  dto: RegistrarResultadoDto,
  hoy: string,
): asserts seguimiento is SeguimientoParaAccion {
  if (!seguimiento) throw new NotFoundException(MENSAJE_SEGUIMIENTO_NO_EXISTE);
  if (!EstadoSeguimientoMaquina.esPendiente(seguimiento.estado)) {
    throw new ConflictException(mensajeDeEstado(seguimiento.estado));
  }
  if (seguimiento.tipo === TipoSeguimiento.Reporte && seguimiento.reporteEnviadoEn === null) {
    throw new ConflictException(MENSAJE_REPORTE_PENDIENTE);
  }
  if (dto.fechaRealizada > hoy) {
    throw new BadRequestException('La fecha realizada no puede ser futura');
  }
  if (dto.fechaRealizada < seguimiento.fechaEntrega) {
    throw new BadRequestException(
      `La fecha realizada no puede ser anterior a la fecha de entrega (${seguimiento.fechaEntrega})`,
    );
  }
}
