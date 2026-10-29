import { Inject, Injectable, Logger } from '@nestjs/common';
import { STORAGE_SERVICE, type IStorageService } from '../../storage/storage.interface';
import { FotosMascotaRepository } from '../fotos/fotos-mascota.repository';

export interface FotoFicha {
  buffer: Buffer;
  tipo: 'image/jpeg' | 'image/png';
}

/**
 * Lee del disco la foto principal (versión de catálogo) para la ficha en PDF. Las claves de
 * almacenamiento no salen de este módulo. Si no hay foto o el archivo falta, devuelve `null`: la
 * ficha se genera igual, sin foto.
 */
@Injectable()
export class FotoFichaService {
  private readonly logger = new Logger(FotoFichaService.name);

  constructor(
    private readonly fotos: FotosMascotaRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  async leerPrincipal(mascotaId: number): Promise<FotoFicha | null> {
    const [principal] = await this.fotos.listar(mascotaId);
    // Las claves `demo/…` del seed no son archivos reales.
    if (!principal || !principal.urlCatalogo.startsWith('publico/')) return null;
    try {
      const archivo = await this.storage.leer(principal.urlCatalogo);
      if (archivo.tipo !== 'image/jpeg' && archivo.tipo !== 'image/png') return null;
      return { buffer: archivo.buffer, tipo: archivo.tipo };
    } catch (error) {
      this.logger.warn(`La foto de la mascota ${mascotaId} no se pudo leer: ${String(error)}`);
      return null;
    }
  }
}
