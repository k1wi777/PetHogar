import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type ArchivoDescargable, nombreDescarga } from '../storage/descarga';
import { STORAGE_SERVICE, type IStorageService } from '../storage/storage.interface';
import { UsuariosService } from '../usuarios/usuarios.service';
import { SolicitudesRepository } from './solicitudes.repository';
import { MENSAJE_SOLICITUD_NO_EXISTE, type PropietarioSolicitud } from './solicitudes.types';

/**
 * Entrega el formulario privado de una solicitud solo a su fundación dueña o a su adoptante autor.
 * La clave se busca con el filtro de propiedad en la misma consulta y no sale de este servicio.
 */
@Injectable()
export class FormularioService {
  constructor(
    private readonly repo: SolicitudesRepository,
    private readonly usuarios: UsuariosService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  async leer(solicitudId: number, propietario: PropietarioSolicitud): Promise<ArchivoDescargable> {
    const clave = await this.claveDe(solicitudId, propietario);
    if (!clave) throw new NotFoundException(MENSAJE_SOLICITUD_NO_EXISTE);
    const archivo = await this.storage.leer(clave);
    return {
      ...archivo,
      nombreArchivo: nombreDescarga('formulario-solicitud', solicitudId, archivo.tipo),
    };
  }

  private async claveDe(id: number, propietario: PropietarioSolicitud): Promise<string | null> {
    if (propietario.tipo === 'fundacion') {
      return this.repo.claveFormularioDeFundacion(id, propietario.fundacionId);
    }
    const adoptante = await this.usuarios.adoptantePorUsuarioId(propietario.usuarioId);
    return adoptante ? this.repo.claveFormularioDeAdoptante(id, adoptante.id) : null;
  }
}
