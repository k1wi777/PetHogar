import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HistorialMedico } from '../entities/historial-medico.entity';
import type { TipoHistorialMedico } from '../entities/historial-medico.enum';

export interface DatosHistorial {
  mascotaId: number;
  tipo: TipoHistorialMedico;
  fecha: string;
  descripcion: string;
  veterinario: string | null;
}

/** Dueño de `historial_medico`. */
@Injectable()
export class HistorialRepository {
  constructor(
    @InjectRepository(HistorialMedico) private readonly historial: Repository<HistorialMedico>,
  ) {}

  insertar(datos: DatosHistorial): Promise<HistorialMedico> {
    return this.historial.save(this.historial.create(datos));
  }

  /** Orden del índice `idx_historial_mascota_fecha`: más reciente primero, desempate por id. */
  listar(mascotaId: number): Promise<HistorialMedico[]> {
    return this.historial.find({
      where: { mascotaId },
      order: { fecha: 'DESC', id: 'DESC' },
    });
  }
}
