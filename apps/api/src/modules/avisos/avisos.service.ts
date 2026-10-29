import { Injectable, Logger } from '@nestjs/common';
import {
  AdoptionApproved,
  AdoptionClosed,
  AdoptionRejected,
  AdoptionRequestCreated,
  DonationRegistered,
  FollowUpOverdue,
  FollowUpReminder,
  FollowUpReportReceived,
  FollowUpScheduled,
  FoundationRegistered,
  FoundationValidated,
  WellbeingAlertRaised,
} from '../../common/events';
import { DonacionesService } from '../donaciones/donaciones.service';
import { FundacionesService } from '../fundaciones/fundaciones.service';
import { MascotasService } from '../mascotas/mascotas.service';
import { SeguimientosService } from '../seguimientos/seguimientos.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { EntregaAvisoService, type OpcionesEntrega } from './entrega-aviso.service';
import * as textos from './textos-aviso';
import type { Aviso } from './textos-aviso';

const CON_CORREO: OpcionesEntrega = { correo: { plantilla: 'notificacion' } };

/**
 * Resuelve, para cada evento del catálogo, a quién avisar y con qué texto, leyendo solo lo
 * necesario de los módulos dueños (servicios de lectura). Si falta un dato (p. ej. la mascota ya
 * no existe) omite el aviso y lo registra; nunca lanza hacia quien emitió el evento.
 */
@Injectable()
export class AvisosService {
  private readonly logger = new Logger(AvisosService.name);

  constructor(
    private readonly entrega: EntregaAvisoService,
    private readonly usuarios: UsuariosService,
    private readonly fundaciones: FundacionesService,
    private readonly mascotas: MascotasService,
    private readonly seguimientos: SeguimientosService,
    private readonly donaciones: DonacionesService,
  ) {}

  // ---- Fundaciones -------------------------------------------------------------------------

  async fundacionRegistrada(evento: FoundationRegistered): Promise<void> {
    const fundacion = await this.fundaciones.datosBasicos(evento.fundacionId);
    if (!fundacion) return this.omitir('FoundationRegistered', 'la fundación no existe');
    const aviso = textos.fundacionRegistrada({
      fundacionId: fundacion.id,
      nombre: fundacion.nombre,
    });
    await this.entregarAAdministradores(aviso);
  }

  async fundacionValidada(evento: FoundationValidated): Promise<void> {
    const fundacion = await this.fundaciones.datosBasicos(evento.fundacionId);
    if (!fundacion) return this.omitir('FoundationValidated', 'la fundación no existe');
    const aviso = textos.fundacionValidada({
      fundacionId: fundacion.id,
      decision: evento.decision,
      observacion: evento.observacion,
    });
    await this.entrega.entregar(fundacion.usuarioId, aviso, {
      ...CON_CORREO,
      nombre: fundacion.nombre,
    });
  }

  // ---- Solicitudes y adopciones ------------------------------------------------------------

  async solicitudCreada(evento: AdoptionRequestCreated): Promise<void> {
    const [fundacion, mascota] = await Promise.all([
      this.fundaciones.datosBasicos(evento.fundacionId),
      this.mascotas.nombrePorId(evento.mascotaId),
    ]);
    if (!fundacion || mascota === null) {
      return this.omitir('AdoptionRequestCreated', 'falta la fundación o la mascota');
    }
    const aviso = textos.solicitudRecibida({ solicitudId: evento.solicitudId, mascota });
    await this.entrega.entregar(fundacion.usuarioId, aviso);
  }

  /** El aviso de la aprobación va al ADOPTANTE, no a la fundación que la decidió. */
  async solicitudAprobada(evento: AdoptionApproved): Promise<void> {
    const destino = await this.adoptanteYMascota(evento.adoptanteId, evento.mascotaId);
    if (!destino) return this.omitir('AdoptionApproved', 'falta el adoptante o la mascota');
    const aviso = textos.solicitudAprobada({
      solicitudId: evento.solicitudId,
      mascota: destino.mascota,
    });
    await this.entrega.entregar(destino.usuarioId, aviso, CON_CORREO);
  }

  async solicitudRechazada(evento: AdoptionRejected): Promise<void> {
    const destino = await this.adoptanteYMascota(evento.adoptanteId, evento.mascotaId);
    if (!destino) return this.omitir('AdoptionRejected', 'falta el adoptante o la mascota');
    const aviso = textos.solicitudRechazada({
      solicitudId: evento.solicitudId,
      mascota: destino.mascota,
      observacion: evento.observacion,
      automatica: evento.automatica,
    });
    await this.entrega.entregar(destino.usuarioId, aviso, CON_CORREO);
  }

  async adopcionCerrada(evento: AdoptionClosed): Promise<void> {
    const destino = await this.adoptanteYMascota(evento.adoptanteId, evento.mascotaId);
    if (!destino) return this.omitir('AdoptionClosed', 'falta el adoptante o la mascota');
    const aviso = textos.adopcionCerrada({
      adopcionId: evento.adopcionId,
      estado: evento.estado,
      mascota: destino.mascota,
    });
    await this.entrega.entregar(destino.usuarioId, aviso);
  }

  // ---- Seguimientos ------------------------------------------------------------------------

  async seguimientoProgramado(evento: FollowUpScheduled): Promise<void> {
    const datos = await this.seguimientos.datosParaAviso(evento.seguimientoId);
    if (!datos) return this.omitir('FollowUpScheduled', 'el seguimiento no existe');
    const aviso = textos.seguimientoProgramado({
      seguimientoId: evento.seguimientoId,
      fundacion: datos.fundacionNombre,
      tipo: datos.tipo,
      mascota: datos.mascotaNombre,
      fecha: datos.fechaProgramada,
    });
    await this.entrega.entregar(datos.adoptanteUsuarioId, aviso, CON_CORREO);
  }

  async seguimientoPorVencer(evento: FollowUpReminder): Promise<void> {
    const datos = await this.seguimientos.datosParaAviso(evento.seguimientoId);
    if (!datos) return this.omitir('FollowUpReminder', 'el seguimiento no existe');
    const aviso = textos.seguimientoPorVencer({
      seguimientoId: evento.seguimientoId,
      tipo: datos.tipo,
      mascota: datos.mascotaNombre,
      fecha: datos.fechaProgramada,
      diasRestantes: evento.diasRestantes,
    });
    await this.entrega.entregar(datos.adoptanteUsuarioId, aviso, CON_CORREO);
  }

  /** Al adoptante, con correo; a la fundación solo la campana (un lote de vencidos saturaría el buzón). */
  async seguimientoVencido(evento: FollowUpOverdue): Promise<void> {
    const datos = await this.seguimientos.datosParaAviso(evento.seguimientoId);
    if (!datos) return this.omitir('FollowUpOverdue', 'el seguimiento no existe');
    const base = { seguimientoId: evento.seguimientoId, mascota: datos.mascotaNombre };
    await Promise.allSettled([
      this.entrega.entregar(
        datos.adoptanteUsuarioId,
        textos.seguimientoVencidoAdoptante(base),
        CON_CORREO,
      ),
      this.entrega.entregar(datos.fundacionUsuarioId, textos.seguimientoVencidoFundacion(base)),
    ]);
  }

  async reporteRecibido(evento: FollowUpReportReceived): Promise<void> {
    const datos = await this.seguimientos.datosParaAviso(evento.seguimientoId);
    if (!datos) return this.omitir('FollowUpReportReceived', 'el seguimiento no existe');
    const aviso = textos.reporteRecibido({
      seguimientoId: evento.seguimientoId,
      mascota: datos.mascotaNombre,
    });
    await this.entrega.entregar(datos.fundacionUsuarioId, aviso);
  }

  /** Fundación y administradores; el aviso nunca lleva la valoración ni las observaciones. */
  async alertaBienestar(evento: WellbeingAlertRaised): Promise<void> {
    const datos = await this.seguimientos.datosParaAviso(evento.seguimientoId);
    if (!datos) return this.omitir('WellbeingAlertRaised', 'el seguimiento no existe');
    const aFundacion = textos.alertaBienestarFundacion({
      seguimientoId: evento.seguimientoId,
      mascota: datos.mascotaNombre,
    });
    const aAdministradores = textos.alertaBienestarAdministrador({
      seguimientoId: evento.seguimientoId,
      fundacionId: datos.fundacionId,
      fundacion: datos.fundacionNombre,
      mascota: datos.mascotaNombre,
    });
    await Promise.allSettled([
      this.entrega.entregar(datos.fundacionUsuarioId, aFundacion),
      this.entregarAAdministradores(aAdministradores),
    ]);
  }

  // ---- Donaciones --------------------------------------------------------------------------

  /**
   * Notificación a la fundación y, si el donante es un usuario registrado, su confirmación (con
   * correo). Una donación manual no emite este evento.
   */
  async donacionRegistrada(evento: DonationRegistered): Promise<void> {
    const [donacion, fundacion] = await Promise.all([
      this.donaciones.datosParaAviso(evento.donacionId),
      this.fundaciones.datosBasicos(evento.fundacionId),
    ]);
    if (!donacion || !fundacion) {
      return this.omitir('DonationRegistered', 'falta la donación o la fundación');
    }
    const entregas: Promise<void>[] = [
      this.entrega.entregar(
        fundacion.usuarioId,
        textos.donacionRecibida({
          donacionId: evento.donacionId,
          tipo: donacion.tipo,
          monto: donacion.monto,
        }),
      ),
    ];
    if (evento.usuarioId !== null) {
      entregas.push(
        this.entrega.entregar(
          evento.usuarioId,
          textos.donacionRegistrada({
            donacionId: evento.donacionId,
            fundacion: fundacion.nombre,
            tipo: donacion.tipo,
            monto: donacion.monto,
          }),
          {
            correo: {
              plantilla: 'donacion-confirmacion',
              fundacion: fundacion.nombre,
              detalle: textos.detalleDonacion(donacion),
              fecha: textos.fechaLargaDeInstante(donacion.fecha),
            },
          },
        ),
      );
    }
    await Promise.allSettled(entregas);
  }

  // ---- Auxiliares --------------------------------------------------------------------------

  private async adoptanteYMascota(
    adoptanteId: number,
    mascotaId: number,
  ): Promise<{ usuarioId: number; mascota: string } | null> {
    const [usuarioId, mascota] = await Promise.all([
      this.usuarios.usuarioIdDeAdoptante(adoptanteId),
      this.mascotas.nombrePorId(mascotaId),
    ]);
    return usuarioId === null || mascota === null ? null : { usuarioId, mascota };
  }

  /** A todos los administradores activos, en paralelo y aislados entre sí. */
  private async entregarAAdministradores(aviso: Aviso): Promise<void> {
    const ids = await this.usuarios.idsAdministradoresActivos();
    await Promise.allSettled(ids.map((id) => this.entrega.entregar(id, aviso)));
  }

  private omitir(evento: string, motivo: string): void {
    this.logger.warn(`Aviso de ${evento} omitido: ${motivo}`);
  }
}
