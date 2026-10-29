import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type ArchivoDescargable, nombreDescarga } from '../storage/descarga';
import { STORAGE_SERVICE, type IStorageService } from '../storage/storage.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import { MENSAJE_FOTO_NO_EXISTE } from './seguimientos.constants';
import { SeguimientosRepository } from './seguimientos.repository';
import type { DuenoSeguimiento, PropietarioSeguimiento } from './seguimientos.types';

/**
 * Entrega las fotos privadas de un seguimiento: la fundación dueña ve todas (reporte y evidencias)
 * y el adoptante solo las de su propio reporte. La clave se busca con el filtro de propiedad en la
 * misma consulta y no sale de este servicio; ajeno o inexistente es el mismo 404.
 */
@Injectable()
export class EvidenciasService {
  constructor(
    private readonly repo: SeguimientosRepository,
    private readonly usuarios: UsuariosService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  async leer(
    seguimientoId: number,
    evidenciaId: number,
    propietario: PropietarioSeguimiento,
  ): Promise<ArchivoDescargable> {
    const dueno = await this.resolver(propietario);
    const clave = dueno && (await this.repo.claveDeFoto(seguimientoId, evidenciaId, dueno));
    if (!clave) throw new NotFoundException(MENSAJE_FOTO_NO_EXISTE);
    const archivo = await this.storage.leer(clave);
    return {
      ...archivo,
      nombreArchivo: nombreDescarga(
        `evidencia-seguimiento-${seguimientoId}`,
        evidenciaId,
        archivo.tipo,
      ),
    };
  }

  private async resolver(propietario: PropietarioSeguimiento): Promise<DuenoSeguimiento | null> {
    if (propietario.tipo === 'fundacion') return propietario;
    const adoptante = await this.usuarios.adoptantePorUsuarioId(propietario.usuarioId);
    return adoptante ? { tipo: 'adoptante', adoptanteId: adoptante.id } : null;
  }
}
