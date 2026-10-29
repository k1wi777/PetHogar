import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CrearHistorialDto } from '../dto/crear-historial.dto';
import type { HistorialMedico } from '../entities/historial-medico.entity';
import { MENSAJE_MASCOTA_NO_EXISTE } from '../mascotas.mensajes';
import { MascotasRepository } from '../mascotas.repository';
import type { EventoMedico } from '../mascotas.types';
import { fechaNoFutura } from './fecha-no-futura';
import { HistorialRepository } from './historial.repository';

export const MENSAJE_FECHA_FUTURA = 'La fecha del registro no puede ser futura';

/** Dueño de `historial_medico`: escritura de la fundación dueña y lectura para la ficha pública. */
@Injectable()
export class HistorialService {
  constructor(
    private readonly historial: HistorialRepository,
    private readonly mascotas: MascotasRepository,
  ) {}

  /**
   * Cualquier estado de la mascota: es un registro veterinario y puede corregirse tras una
   * adopción. La propiedad se comprueba antes que la fecha para no revelar nada de mascotas ajenas.
   */
  async registrar(
    mascotaId: number,
    fundacionId: number,
    dto: CrearHistorialDto,
    ahora: Date = new Date(),
  ): Promise<EventoMedico> {
    if (!(await this.mascotas.buscarDeFundacion(mascotaId, fundacionId))) {
      throw new NotFoundException(MENSAJE_MASCOTA_NO_EXISTE);
    }
    if (!fechaNoFutura(dto.fecha, ahora)) {
      throw new BadRequestException({
        message: 'Los datos enviados no son válidos',
        errores: [{ campo: 'fecha', mensajes: [MENSAJE_FECHA_FUTURA] }],
      });
    }
    const evento = await this.historial.insertar({
      mascotaId,
      tipo: dto.tipo,
      fecha: dto.fecha,
      descripcion: dto.descripcion,
      veterinario: dto.veterinario ?? null,
    });
    return aEvento(evento);
  }

  async listar(mascotaId: number): Promise<EventoMedico[]> {
    return (await this.historial.listar(mascotaId)).map(aEvento);
  }
}

function aEvento(h: HistorialMedico): EventoMedico {
  return {
    id: h.id,
    tipo: h.tipo,
    fecha: h.fecha,
    descripcion: h.descripcion,
    veterinario: h.veterinario,
  };
}
