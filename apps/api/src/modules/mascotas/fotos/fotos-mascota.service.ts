import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { MENSAJE_SOLO_IMAGENES } from '../../storage/storage.constants';
import { STORAGE_SERVICE, type IStorageService } from '../../storage/storage.interface';
import { detectarTipo } from '../../storage/tipo-archivo';
import { MascotasRepository } from '../mascotas.repository';
import { MENSAJE_MASCOTA_NO_EXISTE } from '../mascotas.mensajes';
import type { FotoMascota } from '../entities/foto-mascota.entity';
import type { FotoGestion } from '../mascotas.types';
import { FotosMascotaRepository } from './fotos-mascota.repository';
import { ProcesadorImagenService } from './procesador-imagen.service';
import { urlPublicaFoto } from './url-foto';

export const MAX_FOTOS_POR_MASCOTA = 6;
export const MENSAJE_LIMITE_FOTOS = `Solo puedes subir hasta ${MAX_FOTOS_POR_MASCOTA} fotos por mascota`;
const MENSAJE_FOTO_NO_EXISTE = 'La foto no existe';

/** Dueño de `foto_mascota`: subida (con procesamiento), principal y borrado. */
@Injectable()
export class FotosMascotaService {
  private readonly logger = new Logger(FotosMascotaService.name);

  constructor(
    private readonly fotos: FotosMascotaRepository,
    private readonly mascotas: MascotasRepository,
    private readonly procesador: ProcesadorImagenService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  async listar(mascotaId: number): Promise<FotoGestion[]> {
    return (await this.fotos.listar(mascotaId)).map((f) => this.aFoto(f));
  }

  /**
   * 1) propiedad y conteo previo (solo para fallar rápido); 2) procesar y guardar las dos
   * versiones fuera de la transacción; 3) transacción con bloqueo de la mascota, conteo
   * definitivo e inserción; 4) cualquier fallo de 2–3 elimina los archivos ya guardados.
   */
  async subir(mascotaId: number, fundacionId: number, imagen?: Buffer): Promise<FotoGestion> {
    if (!imagen || imagen.length === 0) {
      throw new BadRequestException('Debes enviar una imagen en el campo "foto"');
    }
    const tipo = detectarTipo(imagen);
    if (tipo !== 'image/jpeg' && tipo !== 'image/png') {
      throw new BadRequestException(MENSAJE_SOLO_IMAGENES);
    }
    if (!(await this.mascotas.buscarDeFundacion(mascotaId, fundacionId))) {
      throw new NotFoundException(MENSAJE_MASCOTA_NO_EXISTE);
    }
    if ((await this.fotos.contar(mascotaId)).total >= MAX_FOTOS_POR_MASCOTA) {
      throw new ConflictException(MENSAJE_LIMITE_FOTOS);
    }

    const guardadas: string[] = [];
    try {
      const { catalogo, grande } = await this.procesador.procesar(imagen);
      const opciones = { categoria: 'imagen', carpeta: 'mascotas' } as const;
      const versionCatalogo = await this.storage.guardar({ buffer: catalogo }, opciones);
      guardadas.push(versionCatalogo.clave);
      const versionGrande = await this.storage.guardar({ buffer: grande }, opciones);
      guardadas.push(versionGrande.clave);

      const foto = await this.fotos.enTransaccion(async (manager) => {
        if (!(await this.mascotas.bloquearDeFundacion(manager, mascotaId, fundacionId))) {
          throw new NotFoundException(MENSAJE_MASCOTA_NO_EXISTE);
        }
        const conteo = await this.fotos.contar(mascotaId, manager);
        if (conteo.total >= MAX_FOTOS_POR_MASCOTA)
          throw new ConflictException(MENSAJE_LIMITE_FOTOS);
        return this.fotos.insertar(manager, {
          mascotaId,
          url: versionGrande.clave,
          urlCatalogo: versionCatalogo.clave,
          esPrincipal: conteo.principales === 0,
        });
      });
      return this.aFoto(foto);
    } catch (error) {
      await this.eliminarArchivos(guardadas);
      throw error;
    }
  }

  /** Bajo el bloqueo de la mascota deja exactamente una principal. */
  async marcarPrincipal(
    mascotaId: number,
    fotoId: number,
    fundacionId: number,
  ): Promise<FotoGestion[]> {
    await this.fotos.enTransaccion(async (manager) => {
      await this.bloquearPropia(manager, mascotaId, fundacionId);
      if (!(await this.fotos.existe(manager, mascotaId, fotoId))) {
        throw new NotFoundException(MENSAJE_FOTO_NO_EXISTE);
      }
      await this.fotos.marcarPrincipal(manager, mascotaId, fotoId);
    });
    return this.listar(mascotaId);
  }

  /** Borra la fila (promoviendo otra principal si hacía falta) y, ya confirmada, sus dos archivos. */
  async eliminar(mascotaId: number, fotoId: number, fundacionId: number): Promise<void> {
    const borrada = await this.fotos.enTransaccion(async (manager) => {
      await this.bloquearPropia(manager, mascotaId, fundacionId);
      const resultado = await this.fotos.eliminar(manager, mascotaId, fotoId);
      if (!resultado) throw new NotFoundException(MENSAJE_FOTO_NO_EXISTE);
      if (resultado.esPrincipal) await this.fotos.promoverMenor(manager, mascotaId);
      return resultado;
    });
    await this.eliminarArchivos([borrada.url, borrada.urlCatalogo]);
  }

  private async bloquearPropia(
    manager: EntityManager,
    mascotaId: number,
    fundacionId: number,
  ): Promise<void> {
    if (!(await this.mascotas.bloquearDeFundacion(manager, mascotaId, fundacionId))) {
      throw new NotFoundException(MENSAJE_MASCOTA_NO_EXISTE);
    }
  }

  /** Limpieza: un fallo al borrar se registra, nunca oculta el error original ni rompe la operación. */
  private async eliminarArchivos(claves: string[]): Promise<void> {
    for (const clave of claves) {
      try {
        await this.storage.eliminar(clave);
      } catch (error) {
        this.logger.warn(
          `No se pudo eliminar el archivo ${clave}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private aFoto(foto: FotoMascota): FotoGestion {
    return {
      id: foto.id,
      esPrincipal: foto.esPrincipal,
      urlCatalogo: urlPublicaFoto(this.storage, foto.urlCatalogo),
      url: urlPublicaFoto(this.storage, foto.url),
    };
  }
}
