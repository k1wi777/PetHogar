import { Injectable } from '@nestjs/common';
import { InstantaneaService } from '../../common/database/instantanea.service';
import { Reloj } from '../../common/reloj/reloj';
import { hoyEnBogota } from '../../common/validation/fecha';
import { CatalogoMascotasService } from '../mascotas/catalogo/catalogo-mascotas.service';
import { FotoFichaService } from '../mascotas/catalogo/foto-ficha.service';
import type {
  ConsultaReporteDonacionesDto,
  ConsultaReporteSeguimientosDto,
  ConsultaReporteSolicitudesDto,
} from './dto/consultas-reporte.dto';
import { filtroDePeriodo } from './periodo';
import { filtro } from './pdf/documento';
import { PdfService } from './pdf/pdf.service';
import { plantillaFicha } from './pdf/plantillas/ficha';
import {
  plantillaDonaciones,
  plantillaSeguimientos,
  plantillaSolicitudes,
} from './pdf/plantillas/listados';
import { MAX_FILAS_PDF } from './reportes.constants';
import { ReportesRepository } from './reportes.repository';

/**
 * Orquesta los datos de cada reporte y su plantilla; el renderizado lo hace `PdfService`. Los datos
 * se leen en una instantánea que se cierra ANTES de renderizar: pdfmake no retiene la conexión.
 */
@Injectable()
export class ReportesPdfService {
  constructor(
    private readonly pdf: PdfService,
    private readonly reloj: Reloj,
    private readonly instantanea: InstantaneaService,
    private readonly repo: ReportesRepository,
    private readonly catalogo: CatalogoMascotasService,
    private readonly fotoFicha: FotoFichaService,
  ) {}

  /** 404 si la mascota no es visible (la regla «disponible + fundación aprobada» es la del catálogo). */
  async fichaMascota(id: number): Promise<Buffer> {
    const ficha = await this.catalogo.obtenerFicha(id);
    const foto = await this.fotoFicha.leerPrincipal(id);
    return this.pdf.generar(
      plantillaFicha({ ficha, foto, generadoEn: this.reloj.ahora(), logoSvg: this.pdf.logoSvg }),
    );
  }

  async solicitudes(fundacionId: number, consulta: ConsultaReporteSolicitudesDto): Promise<Buffer> {
    const f = filtroDePeriodo(fundacionId, consulta.desde, consulta.hasta);
    const listado = await this.instantanea.leer(async (m) => ({
      filas: await this.repo.listarSolicitudes(f, consulta.estado, MAX_FILAS_PDF, m),
      total: await this.repo.contarSolicitudes(f, consulta.estado, m),
    }));
    return this.pdf.generar(
      plantillaSolicitudes({
        listado,
        filtros: [
          filtro('Estado', consulta.estado),
          filtro('Desde', consulta.desde),
          filtro('Hasta', consulta.hasta),
        ],
        generadoEn: this.reloj.ahora(),
        logoSvg: this.pdf.logoSvg,
      }),
    );
  }

  async seguimientos(
    fundacionId: number,
    consulta: ConsultaReporteSeguimientosDto,
  ): Promise<Buffer> {
    const f = filtroDePeriodo(fundacionId, consulta.desde, consulta.hasta);
    const ahora = this.reloj.ahora();
    const hoy = hoyEnBogota(ahora);
    const listado = await this.instantanea.leer(async (m) => ({
      filas: await this.repo.listarSeguimientos(f, consulta.estado, hoy, MAX_FILAS_PDF, m),
      total: await this.repo.contarSeguimientos(f, consulta.estado, hoy, m),
    }));
    return this.pdf.generar(
      plantillaSeguimientos({
        listado,
        filtros: [
          filtro('Estado', consulta.estado),
          filtro('Desde', consulta.desde),
          filtro('Hasta', consulta.hasta),
        ],
        generadoEn: ahora,
        logoSvg: this.pdf.logoSvg,
      }),
    );
  }

  async donaciones(fundacionId: number, consulta: ConsultaReporteDonacionesDto): Promise<Buffer> {
    const f = filtroDePeriodo(fundacionId, consulta.desde, consulta.hasta);
    const datos = await this.instantanea.leer(async (m) => {
      const filas = await this.repo.listarDonaciones(
        fundacionId,
        f,
        consulta.tipo,
        MAX_FILAS_PDF,
        m,
      );
      const totales = await this.repo.totalesDonaciones(fundacionId, f, consulta.tipo, m);
      return { filas, totales };
    });
    return this.pdf.generar(
      plantillaDonaciones({
        listado: {
          filas: datos.filas,
          total: datos.totales.reduce((suma, t) => suma + t.cantidad, 0),
        },
        totales: datos.totales,
        filtros: [
          filtro('Tipo', consulta.tipo),
          filtro('Desde', consulta.desde),
          filtro('Hasta', consulta.hasta),
        ],
        generadoEn: this.reloj.ahora(),
        logoSvg: this.pdf.logoSvg,
      }),
    );
  }
}
