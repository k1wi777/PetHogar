import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FollowUpReportReceived } from '../../common/events';
import { emitirSeguro } from '../../common/events/emitir-seguro';
import { Reloj } from '../../common/reloj/reloj';
import { hoyEnBogota } from '../../common/validation/fecha';
import { STORAGE_SERVICE, type IStorageService } from '../storage/storage.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import { eliminarArchivos, guardarFotos } from './archivos.util';
import { EstadoSeguimientoMaquina } from './estado-seguimiento.maquina';
import { OrigenEvidencia, TipoSeguimiento } from './entities/seguimiento.enum';
import {
  MAX_FOTOS,
  MENSAJE_SEGUIMIENTO_NO_EXISTE,
  MENSAJE_SOLO_ADOPTANTES,
  MENSAJE_VISITA_SIN_REPORTE,
} from './seguimientos.constants';
import { SeguimientosRepository } from './seguimientos.repository';
import type { SeguimientoDetalleAdoptante, SeguimientoParaAccion } from './seguimientos.types';

/** Envío (y reenvío) del reporte del adoptante, con sus fotos en almacenamiento privado. */
@Injectable()
export class ReporteService {
  private readonly logger = new Logger(ReporteService.name);

  constructor(
    private readonly repo: SeguimientosRepository,
    private readonly usuarios: UsuariosService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
    private readonly eventos: EventEmitter2,
    private readonly reloj: Reloj,
  ) {}

  /**
   * Guarda el reporte y reemplaza las fotos anteriores. La precomprobación evita escribir archivos
   * por una petición condenada; todo el reemplazo ocurre bajo el `FOR UPDATE` de la fila, así que
   * nunca hay más de {@link MAX_FOTOS} fotos del adoptante, ni con envíos simultáneos. Los archivos
   * reemplazados se borran tras el commit y los nuevos si algo falla. La fundación solo recibe el
   * evento la primera vez que se entrega.
   */
  async enviar(
    usuarioId: number,
    seguimientoId: number,
    comentarios: string,
    fotos: readonly Buffer[],
  ): Promise<SeguimientoDetalleAdoptante> {
    if (fotos.length > MAX_FOTOS) {
      throw new BadRequestException(`No puedes adjuntar más de ${MAX_FOTOS} fotos`);
    }
    const adoptanteId = await this.adoptanteIdDe(usuarioId);
    const dueno = { tipo: 'adoptante', adoptanteId } as const;
    const previo = await this.repo.buscarParaAccion(seguimientoId, dueno);
    validarAdmiteReporte(previo);

    const nuevas = await guardarFotos(this.storage, fotos, this.logger);
    let resultado: { primera: boolean; reemplazadas: string[]; adopcionId: number };
    try {
      resultado = await this.repo.enTransaccion(async (manager) => {
        const actual = await this.repo.bloquearParaAccion(manager, seguimientoId, dueno);
        validarAdmiteReporte(actual);
        if (!(await this.repo.guardarReporte(manager, seguimientoId, comentarios))) {
          throw new ConflictException(`El seguimiento ya está ${actual.estado}`);
        }
        const reemplazadas = await this.repo.borrarEvidencias(
          manager,
          seguimientoId,
          OrigenEvidencia.Adoptante,
        );
        await this.repo.insertarEvidencias(
          manager,
          seguimientoId,
          nuevas,
          OrigenEvidencia.Adoptante,
        );
        return {
          primera: actual.reporteEnviadoEn === null,
          reemplazadas,
          adopcionId: actual.adopcionId,
        };
      });
    } catch (error) {
      await eliminarArchivos(this.storage, nuevas, this.logger);
      throw error;
    }

    await eliminarArchivos(this.storage, resultado.reemplazadas, this.logger);
    if (resultado.primera) {
      emitirSeguro(
        this.eventos,
        FollowUpReportReceived.eventName,
        new FollowUpReportReceived(seguimientoId, resultado.adopcionId),
        this.logger,
      );
    }
    const detalle = await this.repo.obtenerDeAdoptante(
      seguimientoId,
      adoptanteId,
      hoyEnBogota(this.reloj.ahora()),
    );
    if (!detalle) throw new NotFoundException(MENSAJE_SEGUIMIENTO_NO_EXISTE);
    return detalle;
  }

  private async adoptanteIdDe(usuarioId: number): Promise<number> {
    const adoptante = await this.usuarios.adoptantePorUsuarioId(usuarioId);
    if (!adoptante) throw new ForbiddenException(MENSAJE_SOLO_ADOPTANTES);
    return adoptante.id;
  }
}

/** 404 uniforme (ajeno = inexistente); 409 si es una visita o ya está cerrado o cancelado. */
function validarAdmiteReporte(
  seguimiento: SeguimientoParaAccion | null,
): asserts seguimiento is SeguimientoParaAccion {
  if (!seguimiento) throw new NotFoundException(MENSAJE_SEGUIMIENTO_NO_EXISTE);
  if (seguimiento.tipo === TipoSeguimiento.Visita) {
    throw new ConflictException(MENSAJE_VISITA_SIN_REPORTE);
  }
  if (!EstadoSeguimientoMaquina.esPendiente(seguimiento.estado)) {
    throw new ConflictException(`El seguimiento ya está ${seguimiento.estado}`);
  }
}
