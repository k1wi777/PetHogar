import { Injectable, NotFoundException } from '@nestjs/common';
import { desplazamiento, type Paginado, paginar } from '../../common/pagination/paginar';
import type { PaginacionQueryDto } from '../../common/pagination/paginacion-query.dto';
import {
  LIMITE_MENSAJE,
  LIMITE_TITULO,
  MENSAJE_NOTIFICACION_NO_EXISTE,
} from './notificaciones.constants';
import { aVista, recortar } from './notificaciones.mapeo';
import { NotificacionesRepository } from './notificaciones.repository';
import type {
  FiltroNotificaciones,
  NotificacionVista,
  NuevaNotificacion,
} from './notificaciones.types';

/**
 * Dueño de `notificacion`. Es un módulo hoja: no conoce ningún dominio; quien avisa (el módulo
 * `avisos`) le entrega destinatario, texto y referencia ya resueltos.
 */
@Injectable()
export class NotificacionesService {
  constructor(private readonly repo: NotificacionesRepository) {}

  /**
   * Crea la notificación recortando título y mensaje a sus límites. `creada` es `false` cuando la
   * clave de deduplicación ya existía para ese destinatario (no se inserta nada).
   */
  async crear(datos: NuevaNotificacion): Promise<{ creada: boolean }> {
    const creada = await this.repo.insertar({
      usuarioId: datos.usuarioId,
      tipo: datos.tipo,
      titulo: recortar(datos.titulo, LIMITE_TITULO),
      mensaje: recortar(datos.mensaje, LIMITE_MENSAJE),
      entidad: datos.referencia?.tipo ?? null,
      entidadId: datos.referencia?.id ?? null,
      clave: datos.clave ?? null,
    });
    return { creada };
  }

  async listar(
    usuarioId: number,
    filtro: FiltroNotificaciones,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<NotificacionVista>> {
    const { skip, take } = desplazamiento(paginacion);
    const [filas, total] = await this.repo.listar(usuarioId, filtro, skip, take);
    return paginar(filas.map(aVista), total, paginacion);
  }

  async contarNoLeidas(usuarioId: number): Promise<{ noLeidas: number }> {
    return { noLeidas: await this.repo.contarNoLeidas(usuarioId) };
  }

  /** Ajena e inexistente responden igual: 404. */
  async marcarLeida(usuarioId: number, id: number): Promise<NotificacionVista> {
    const fila = await this.repo.marcarLeida(id, usuarioId);
    if (!fila) throw new NotFoundException(MENSAJE_NOTIFICACION_NO_EXISTE);
    return aVista(fila);
  }

  async marcarTodas(usuarioId: number): Promise<{ actualizadas: number }> {
    return { actualizadas: await this.repo.marcarTodas(usuarioId) };
  }
}
