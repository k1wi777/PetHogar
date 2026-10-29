import { Injectable, NotFoundException } from '@nestjs/common';
import { InstantaneaService } from '../../common/database/instantanea.service';
import { Reloj } from '../../common/reloj/reloj';
import { hoyEnBogota } from '../../common/validation/fecha';
import { filtroDePeriodo } from './periodo';
import { MENSAJE_FUNDACION_INEXISTENTE } from './reportes.constants';
import { aEstadisticas } from './reportes.mapeo';
import { ReportesRepository } from './reportes.repository';
import type { Estadisticas, FiltroReporte } from './reportes.types';

/**
 * Estadísticas de solo lectura. Todas las consultas de una respuesta salen de la misma instantánea
 * (`REPEATABLE READ`), así que las cifras son coherentes entre sí aunque haya escrituras.
 */
@Injectable()
export class EstadisticasService {
  constructor(
    private readonly repo: ReportesRepository,
    private readonly instantanea: InstantaneaService,
    private readonly reloj: Reloj,
  ) {}

  /** La fundación sale siempre del token. */
  async deFundacion(fundacionId: number, desde?: string, hasta?: string): Promise<Estadisticas> {
    return this.calcular(filtroDePeriodo(fundacionId, desde, hasta), false);
  }

  /** Global o, si se indica, de una fundación (404 si no existe). */
  async deAdministrador(
    fundacionId: number | undefined,
    desde?: string,
    hasta?: string,
  ): Promise<Estadisticas> {
    return this.calcular(filtroDePeriodo(fundacionId, desde, hasta), fundacionId !== undefined);
  }

  private calcular(filtro: FiltroReporte, validarFundacion: boolean): Promise<Estadisticas> {
    const hoy = hoyEnBogota(this.reloj.ahora());
    return this.instantanea.leer(async (m) => {
      if (validarFundacion && !(await this.repo.existeFundacion(filtro.fundacionId as number, m))) {
        throw new NotFoundException(MENSAJE_FUNDACION_INEXISTENTE);
      }
      // En serie: una transacción es una sola conexión.
      const adopcionesPorMes = await this.repo.adopcionesPorMes(filtro, m);
      const adopcionesPorEspecie = await this.repo.adopcionesPorEspecie(filtro, m);
      const solicitudes = await this.repo.solicitudesPorEstado(filtro, m);
      const seguimientos = await this.repo.seguimientosPorEstado(filtro, hoy, m);
      const bienestar = await this.repo.seguimientosPorBienestar(filtro, m);
      const donacionesPorMes = await this.repo.donacionesPorMes(filtro, m);
      const donacionesPorTipo = await this.repo.donacionesPorTipo(filtro, m);
      return aEstadisticas({
        filtros: {
          fundacionId: filtro.fundacionId ?? null,
          desde: filtro.desde ?? null,
          hasta: filtro.hasta ?? null,
        },
        adopcionesPorMes,
        adopcionesPorEspecie,
        solicitudes,
        seguimientos,
        bienestar,
        donacionesPorMes,
        donacionesPorTipo,
      });
    });
  }
}
