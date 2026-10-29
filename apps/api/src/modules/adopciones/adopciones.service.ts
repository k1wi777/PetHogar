import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { desplazamiento, type Paginado, paginar } from '../../common/pagination/paginar';
import type { PaginacionQueryDto } from '../../common/pagination/paginacion-query.dto';
import { type ArchivoDescargable, nombreDescarga } from '../storage/descarga';
import { MENSAJE_ARCHIVO_VACIO } from '../storage/storage.constants';
import { STORAGE_SERVICE, type IStorageService } from '../storage/storage.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AdopcionesRepository } from './adopciones.repository';
import {
  MENSAJE_ADOPCION_NO_EXISTE,
  type AdopcionDeAdoptante,
  type AdopcionDeFundacion,
  type FiltroAdopciones,
  type PropietarioAdopcion,
} from './adopciones.types';
import { EstadoAdopcion } from './entities/adopcion.enum';

const MENSAJE_SIN_ACTA = 'La adopción todavía no tiene acta';
const MENSAJE_CERRADA = 'La adopción ya está cerrada y no admite un acta nueva';

/** Dueño de `adopcion`: creación (en la transacción de la aprobación), listados por rol y acta. */
@Injectable()
export class AdopcionesService {
  private readonly logger = new Logger(AdopcionesService.name);

  constructor(
    private readonly repo: AdopcionesRepository,
    private readonly usuarios: UsuariosService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  /** Paso 4 de la aprobación: nace `activa` dentro de la transacción del orquestador. */
  crear(solicitudId: number, fechaEntrega: string, manager: EntityManager): Promise<number> {
    return this.repo.insertar(solicitudId, fechaEntrega, manager);
  }

  async listarMias(
    usuarioId: number,
    filtro: FiltroAdopciones,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<AdopcionDeAdoptante>> {
    const adoptante = await this.usuarios.adoptantePorUsuarioId(usuarioId);
    if (!adoptante) throw new ForbiddenException('Esta acción es exclusiva de adoptantes');
    const { skip, take } = desplazamiento(paginacion);
    const [filas, total] = await this.repo.listarDeAdoptante(adoptante.id, filtro, skip, take);
    return paginar(filas, total, paginacion);
  }

  async listarDeFundacion(
    fundacionId: number,
    filtro: FiltroAdopciones,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<AdopcionDeFundacion>> {
    const { skip, take } = desplazamiento(paginacion);
    const [filas, total] = await this.repo.listarDeFundacion(fundacionId, filtro, skip, take);
    return paginar(filas, total, paginacion);
  }

  /**
   * Sube o reemplaza el acta de una adopción activa de la fundación. Guarda el archivo nuevo,
   * actualiza la clave bajo el bloqueo de la adopción y, ya confirmado, borra el archivo anterior.
   * Un fallo antes del commit borra el archivo nuevo.
   */
  async subirActa(id: number, fundacionId: number, archivo?: Buffer): Promise<AdopcionDeFundacion> {
    if (!archivo) throw new BadRequestException('Debes adjuntar el acta firmada');
    if (archivo.length === 0) throw new BadRequestException(MENSAJE_ARCHIVO_VACIO);
    const estado = await this.repo.buscarEstadoDeFundacion(id, fundacionId);
    if (!estado) throw new NotFoundException(MENSAJE_ADOPCION_NO_EXISTE);
    if (estado !== EstadoAdopcion.Activa) throw new ConflictException(MENSAJE_CERRADA);

    let nueva: string | undefined;
    let anterior: string | null;
    try {
      const guardado = await this.storage.guardar(
        { buffer: archivo },
        { categoria: 'documento', carpeta: 'solicitudes' },
      );
      nueva = guardado.clave;
      const clave = nueva;
      anterior = await this.repo.enTransaccion(async (manager) => {
        const fila = await this.repo.bloquearParaActa(manager, id, fundacionId);
        if (!fila) throw new NotFoundException(MENSAJE_ADOPCION_NO_EXISTE);
        if (fila.estado !== EstadoAdopcion.Activa) throw new ConflictException(MENSAJE_CERRADA);
        await this.repo.actualizarActa(manager, id, clave);
        return fila.actaClave;
      });
    } catch (error) {
      if (nueva) await this.eliminarArchivo(nueva);
      throw error;
    }
    if (anterior) await this.eliminarArchivo(anterior);

    const adopcion = await this.repo.obtenerDeFundacion(id, fundacionId);
    if (!adopcion) throw new NotFoundException(MENSAJE_ADOPCION_NO_EXISTE);
    return adopcion;
  }

  /** Acta para la fundación dueña o el adoptante de la adopción; cualquier otro recibe 404. */
  async leerActa(id: number, propietario: PropietarioAdopcion): Promise<ArchivoDescargable> {
    const clave = await this.claveActaDe(id, propietario);
    if (clave === undefined) throw new NotFoundException(MENSAJE_ADOPCION_NO_EXISTE);
    if (clave === null) throw new NotFoundException(MENSAJE_SIN_ACTA);
    const archivo = await this.storage.leer(clave);
    return { ...archivo, nombreArchivo: nombreDescarga('acta-adopcion', id, archivo.tipo) };
  }

  private async claveActaDe(
    id: number,
    propietario: PropietarioAdopcion,
  ): Promise<string | null | undefined> {
    if (propietario.tipo === 'fundacion') {
      return this.repo.claveActaDeFundacion(id, propietario.fundacionId);
    }
    const adoptante = await this.usuarios.adoptantePorUsuarioId(propietario.usuarioId);
    return adoptante ? this.repo.claveActaDeAdoptante(id, adoptante.id) : undefined;
  }

  /** Un fallo al limpiar se registra y nunca oculta el error original ni rompe la operación. */
  private async eliminarArchivo(clave: string): Promise<void> {
    try {
      await this.storage.eliminar(clave);
    } catch (error) {
      this.logger.warn(
        `No se pudo eliminar el archivo ${clave}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
