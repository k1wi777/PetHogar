import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { AdoptionApproved, AdoptionRejected } from '../../common/events';
import { emitirSeguro } from '../../common/events/emitir-seguro';
import { EstadoMascota } from '../mascotas/entities/mascota.enum';
import { MascotasService } from '../mascotas/mascotas.service';
import { OBSERVACION_AUTOMATICA, SolicitudesService } from '../solicitudes/solicitudes.service';
import type { SolicitudDetalleFundacion } from '../solicitudes/solicitudes.types';
import { AdopcionesService } from './adopciones.service';
import type { ResumenAdopcion } from './adopciones.types';
import { DecisionSolicitudDto, TipoDecision } from './dto/decision-solicitud.dto';
import { EstadoAdopcion } from './entities/adopcion.enum';

export interface ResultadoDecision {
  solicitud: SolicitudDetalleFundacion;
  adopcion: ResumenAdopcion | null;
}

/**
 * Orquesta la decisión sobre una solicitud. Aprobar modifica cuatro agregados (solicitud,
 * mascota, adopción y las demás solicitudes) y por eso ocurre en UNA sola transacción; los
 * eventos de dominio se emiten solo después de confirmarla.
 */
@Injectable()
export class AprobacionService {
  private readonly logger = new Logger(AprobacionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly solicitudes: SolicitudesService,
    private readonly mascotas: MascotasService,
    private readonly adopciones: AdopcionesService,
    private readonly eventos: EventEmitter2,
  ) {}

  async decidir(
    id: number,
    fundacionId: number,
    dto: DecisionSolicitudDto,
  ): Promise<ResultadoDecision> {
    if (dto.decision === TipoDecision.Rechazar) {
      const solicitud = await this.solicitudes.rechazar(id, fundacionId, dto.observacion ?? '');
      return { solicitud, adopcion: null };
    }
    return this.aprobar(id, fundacionId, dto.observacion ?? null, dto.fechaEntrega ?? '');
  }

  private async aprobar(
    id: number,
    fundacionId: number,
    observacion: string | null,
    fechaEntrega: string,
  ): Promise<ResultadoDecision> {
    const resultado = await this.dataSource.transaction(async (manager) => {
      // 1) Serializa toda aprobación de esa mascota (y comprueba la propiedad: ajena = 404).
      await this.mascotas.bloquearParaDecision(manager, id, fundacionId);
      // 2) La solicitud debe seguir pendiente; 3) la mascota, disponible; 4) nace la adopción;
      // 5) las demás pendientes de esa mascota se rechazan automáticamente.
      const aprobada = await this.solicitudes.aprobar(id, fundacionId, observacion, manager);
      await this.mascotas.transicionar(aprobada.mascotaId, EstadoMascota.Adoptada, 'adopcion', {
        manager,
      });
      const adopcionId = await this.adopciones.crear(id, fechaEntrega, manager);
      const rechazadas = await this.solicitudes.rechazarPendientesDeMascota(
        aprobada.mascotaId,
        manager,
      );
      return { aprobada, adopcionId, rechazadas };
    });

    const { aprobada, adopcionId, rechazadas } = resultado;
    emitirSeguro(
      this.eventos,
      AdoptionApproved.eventName,
      new AdoptionApproved(id, adopcionId, aprobada.mascotaId, fundacionId, aprobada.adoptanteId),
      this.logger,
    );
    for (const rechazada of rechazadas) {
      emitirSeguro(
        this.eventos,
        AdoptionRejected.eventName,
        new AdoptionRejected(
          rechazada.id,
          aprobada.mascotaId,
          fundacionId,
          rechazada.adoptanteId,
          OBSERVACION_AUTOMATICA,
          true,
        ),
        this.logger,
      );
    }

    return {
      solicitud: await this.solicitudes.obtenerDeFundacion(id, fundacionId),
      adopcion: { id: adopcionId, fechaEntrega, estado: EstadoAdopcion.Activa },
    };
  }
}
