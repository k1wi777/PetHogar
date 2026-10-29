import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type ArchivoDescargable, nombreDescarga } from '../storage/descarga';
import { STORAGE_SERVICE, type IStorageService } from '../storage/storage.interface';
import { MENSAJE_COMPROBANTE_NO_EXISTE } from './donaciones.constants';
import { DonacionesRepository } from './donaciones.repository';

/**
 * Entrega el comprobante privado de una donación solo a la fundación dueña. La clave se busca
 * con `fundacion_id` en la misma consulta y no sale de este servicio: ajena = inexistente = sin
 * comprobante = 404.
 */
@Injectable()
export class ComprobanteService {
  constructor(
    private readonly repo: DonacionesRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  async leer(donacionId: number, fundacionId: number): Promise<ArchivoDescargable> {
    const clave = await this.repo.claveComprobanteDeFundacion(donacionId, fundacionId);
    if (!clave) throw new NotFoundException(MENSAJE_COMPROBANTE_NO_EXISTE);
    const archivo = await this.storage.leer(clave);
    return {
      ...archivo,
      nombreArchivo: nombreDescarga('comprobante-donacion', donacionId, archivo.tipo),
    };
  }
}
