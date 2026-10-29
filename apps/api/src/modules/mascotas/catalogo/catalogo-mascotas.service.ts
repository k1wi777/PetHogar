import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desplazamiento, type Paginado, paginar } from '../../../common/pagination/paginar';
import type { PaginacionQueryDto } from '../../../common/pagination/paginacion-query.dto';
import { STORAGE_SERVICE, type IStorageService } from '../../storage/storage.interface';
import { FotosMascotaService } from '../fotos/fotos-mascota.service';
import { urlPublicaFoto } from '../fotos/url-foto';
import { HistorialService } from '../historial/historial.service';
import { MENSAJE_MASCOTA_NO_EXISTE } from '../mascotas.mensajes';
import type { EventoMedico } from '../mascotas.types';
import { CatalogoMascotasRepository } from './catalogo-mascotas.repository';
import type {
  FilaCatalogo,
  FilaFicha,
  FiltroCatalogo,
  MascotaCatalogo,
  MascotaFicha,
} from './catalogo.types';

/**
 * Catálogo público y ficha. Mapea de forma explícita (campo por campo): ninguna entidad cruda, y
 * las claves de almacenamiento solo se usan para obtener la URL pública. Una mascota que no esté
 * `disponible` (o cuya fundación no esté aprobada) no existe para el público.
 */
@Injectable()
export class CatalogoMascotasService {
  constructor(
    private readonly repo: CatalogoMascotasRepository,
    private readonly fotos: FotosMascotaService,
    private readonly historial: HistorialService,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  async listar(
    filtro: FiltroCatalogo,
    paginacion: PaginacionQueryDto,
  ): Promise<Paginado<MascotaCatalogo>> {
    const { skip, take } = desplazamiento(paginacion);
    const [total, filas] = await Promise.all([
      this.repo.contar(filtro),
      this.repo.listar(filtro, skip, take),
    ]);
    return paginar(
      filas.map((f) => this.aMascotaCatalogo(f)),
      total,
      paginacion,
    );
  }

  async obtenerFicha(id: number): Promise<MascotaFicha> {
    const fila = await this.repo.buscarFicha(id);
    if (!fila) throw new NotFoundException(MENSAJE_MASCOTA_NO_EXISTE);
    const [fotos, historial] = await Promise.all([
      this.fotos.listar(id),
      this.historial.listar(id),
    ]);
    return aFicha(fila, fotos, historial);
  }

  async obtenerHistorial(id: number): Promise<EventoMedico[]> {
    if (!(await this.repo.existeVisible(id)))
      throw new NotFoundException(MENSAJE_MASCOTA_NO_EXISTE);
    return this.historial.listar(id);
  }

  private aMascotaCatalogo(fila: FilaCatalogo): MascotaCatalogo {
    const url = fila.fotoCatalogoClave
      ? urlPublicaFoto(this.storage, fila.fotoCatalogoClave)
      : null;
    return {
      id: fila.id,
      nombre: fila.nombre,
      especie: fila.especie,
      raza: fila.raza,
      sexo: fila.sexo,
      edadMeses: fila.edadMeses,
      tamano: fila.tamano,
      ciudad: fila.ciudad,
      fundacion: { nombre: fila.fundacionNombre },
      fotoPrincipal: url ? { urlCatalogo: url } : null,
    };
  }
}

function aFicha(
  fila: FilaFicha,
  fotos: MascotaFicha['fotos'],
  historial: EventoMedico[],
): MascotaFicha {
  return {
    id: fila.id,
    nombre: fila.nombre,
    especie: fila.especie,
    raza: fila.raza,
    sexo: fila.sexo,
    edadMeses: fila.edadMeses,
    tamano: fila.tamano,
    color: fila.color,
    esterilizado: fila.esterilizado,
    vacunado: fila.vacunado,
    estadoSalud: fila.estadoSalud,
    descripcion: fila.descripcion,
    fechaPublicacion: fila.fechaPublicacion,
    // Únicos datos públicos de la fundación: ni correo, NIT, documento, teléfono ni dirección.
    fundacion: {
      id: fila.fundacionId,
      nombre: fila.fundacionNombre,
      ciudad: fila.fundacionCiudad,
      descripcion: fila.fundacionDescripcion,
    },
    fotos: fotos.map((f) => ({
      id: f.id,
      esPrincipal: f.esPrincipal,
      urlCatalogo: f.urlCatalogo,
      url: f.url,
    })),
    historial: historial.map((h) => ({
      id: h.id,
      tipo: h.tipo,
      fecha: h.fecha,
      descripcion: h.descripcion,
      veterinario: h.veterinario,
    })),
  };
}
