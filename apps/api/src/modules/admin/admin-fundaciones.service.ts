import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FoundationValidated } from '../../common/events';
import type { Paginado } from '../../common/pagination/paginar';
import type { PaginacionQueryDto } from '../../common/pagination/paginacion-query.dto';
import type { EstadoValidacion } from '../fundaciones/entities/fundacion.enum';
import { FundacionesService } from '../fundaciones/fundaciones.service';
import type {
  DecisionValidacion,
  FundacionAdminDetalle,
  FundacionAdminResumen,
} from '../fundaciones/fundaciones.types';
import { IStorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { EXTENSION_POR_TIPO, type TipoArchivo } from '../storage/storage.constants';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { FundacionAdminDetalleDto, FundacionAdminResumenDto } from './dto/respuestas.dto';

export interface DocumentoDescargable {
  buffer: Buffer;
  tipo: TipoArchivo;
  tamano: number;
  /** Nombre construido por nosotros; nunca el de almacenamiento. */
  nombreArchivo: string;
}

/** Orquesta fundaciones (dueña de la tabla) y usuarios (contacto); no tiene tablas propias. */
@Injectable()
export class AdminFundacionesService {
  private readonly logger = new Logger(AdminFundacionesService.name);

  constructor(
    private readonly fundaciones: FundacionesService,
    private readonly usuarios: UsuariosService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
    private readonly eventos: EventEmitter2,
  ) {}

  async listar(
    estado: EstadoValidacion,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<FundacionAdminResumenDto>> {
    const pagina = await this.fundaciones.listarPorEstado(estado, paginacion);
    return { ...pagina, data: pagina.data.map(aResumenDto) };
  }

  async obtener(id: number): Promise<FundacionAdminDetalleDto> {
    return this.armarDetalle(await this.fundaciones.obtenerDetalle(id));
  }

  /** Entrega el documento privado leyéndolo del almacenamiento; la clave no sale de este método. */
  async obtenerDocumento(id: number): Promise<DocumentoDescargable> {
    const clave = await this.fundaciones.obtenerClaveDocumento(id);
    const archivo = await this.storage.leer(clave);
    return {
      ...archivo,
      nombreArchivo: `documento-fundacion-${id}.${EXTENSION_POR_TIPO[archivo.tipo]}`,
    };
  }

  async decidir(
    id: number,
    decision: DecisionValidacion,
    observacion: string | undefined,
  ): Promise<FundacionAdminDetalleDto> {
    const texto = observacion?.trim() ? observacion.trim() : null;
    const detalle = await this.fundaciones.decidirValidacion(id, decision, texto);
    this.emitir(new FoundationValidated(id, decision, texto));
    return this.armarDetalle(detalle);
  }

  /** La decisión ya está guardada: un listener que falle no debe deshacerla ni romper la respuesta. */
  private emitir(evento: FoundationValidated): void {
    try {
      this.eventos.emit(FoundationValidated.eventName, evento);
    } catch (error) {
      this.logger.error(
        `Falló un listener de ${FoundationValidated.eventName} (fundación ${evento.fundacionId}): ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }

  private async armarDetalle(detalle: FundacionAdminDetalle): Promise<FundacionAdminDetalleDto> {
    const contacto = await this.usuarios.obtenerPerfil(detalle.usuarioId);
    return {
      ...aResumenDto(detalle),
      direccion: detalle.direccion,
      descripcion: detalle.descripcion,
      observacionValidacion: detalle.observacionValidacion,
      contacto: { email: contacto?.email ?? '', telefono: contacto?.telefono ?? '' },
      documento: { url: `/api/admin/fundaciones/${detalle.id}/documento` },
    };
  }
}

function aResumenDto(f: FundacionAdminResumen): FundacionAdminResumenDto {
  return {
    id: f.id,
    nombre: f.nombre,
    nit: f.nit,
    ciudad: f.ciudad,
    estadoValidacion: f.estadoValidacion,
    fechaValidacion: f.fechaValidacion,
  };
}
