import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { AdoptionClosed } from '../../common/events';
import { emitirSeguro } from '../../common/events/emitir-seguro';
import { EstadoMascota } from '../mascotas/entities/mascota.enum';
import { MascotasService } from '../mascotas/mascotas.service';
import { SeguimientosService } from '../seguimientos/seguimientos.service';
import { AdopcionesService } from './adopciones.service';
import { MENSAJE_ADOPCION_NO_EXISTE, type AdopcionDeFundacion } from './adopciones.types';
import { CierreAdopcionDto, DestinoMascota, EstadoCierre } from './dto/cierre-adopcion.dto';
import { EstadoAdopcion } from './entities/adopcion.enum';

const MENSAJE_DESTINO = 'Indica si la mascota vuelve a estar disponible o inactiva';

const MASCOTA_POR_DESTINO: Record<DestinoMascota, EstadoMascota> = {
  [DestinoMascota.Disponible]: EstadoMascota.Disponible,
  [DestinoMascota.Inactiva]: EstadoMascota.Inactiva,
};

/**
 * Finaliza o revoca una adopción activa. Modifica tres agregados (adopción, mascota y
 * seguimientos) y por eso ocurre en UNA sola transacción: si cualquier paso falla no queda ningún
 * cambio parcial. Solo tras el `COMMIT` emite `AdoptionClosed` (los seguimientos cancelados no
 * notifican nada por sí solos).
 */
@Injectable()
export class CierreAdopcionService {
  private readonly logger = new Logger(CierreAdopcionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly adopciones: AdopcionesService,
    private readonly mascotas: MascotasService,
    private readonly seguimientos: SeguimientosService,
    private readonly eventos: EventEmitter2,
  ) {}

  async cerrar(
    id: number,
    fundacionId: number,
    dto: CierreAdopcionDto,
  ): Promise<AdopcionDeFundacion> {
    const revoca = dto.estado === EstadoCierre.Revocada;
    const destino = revoca ? dto.mascotaDestino : undefined;
    // Defensa en profundidad: el DTO ya lo exige, pero revocar sin destino dejaría la mascota adoptada.
    if (revoca && !destino) throw new BadRequestException(MENSAJE_DESTINO);
    const estado = revoca ? EstadoAdopcion.Revocada : EstadoAdopcion.Finalizada;
    const cerrada = await this.dataSource.transaction(async (manager) => {
      // 1) Bloquea la adopción (y comprueba la propiedad: ajena = inexistente = 404).
      const adopcion = await this.adopciones.bloquearParaCierre(manager, id, fundacionId);
      if (!adopcion) throw new NotFoundException(MENSAJE_ADOPCION_NO_EXISTE);
      // 2) Debe seguir activa; 3) se cierra con su motivo y fecha (UPDATE condicionado).
      if (adopcion.estado !== EstadoAdopcion.Activa) {
        throw new ConflictException(`La adopción ya está ${adopcion.estado}`);
      }
      await this.adopciones.registrarCierre(manager, id, estado, dto.motivo);
      // 4) Solo al revocar la mascota deja de estar adoptada (UPDATE condicionado a `adoptada`).
      if (destino) {
        await this.mascotas.transicionar(
          adopcion.mascotaId,
          MASCOTA_POR_DESTINO[destino],
          'revocacion',
          { manager },
        );
      }
      // 5) Los seguimientos pendientes dejan de generar vencimientos, recordatorios y alertas.
      await this.seguimientos.cancelarPendientesDeAdopcion(id, manager);
      return adopcion;
    });
    emitirSeguro(
      this.eventos,
      AdoptionClosed.eventName,
      new AdoptionClosed(id, estado, cerrada.mascotaId, fundacionId, cerrada.adoptanteId),
      this.logger,
    );
    return this.adopciones.obtenerDeFundacion(id, fundacionId);
  }
}
