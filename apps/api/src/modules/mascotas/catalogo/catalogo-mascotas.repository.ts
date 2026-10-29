import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { EstadoValidacion } from '../../fundaciones/entities/fundacion.enum';
import { FotoMascota } from '../entities/foto-mascota.entity';
import { Mascota } from '../entities/mascota.entity';
import { EstadoMascota } from '../entities/mascota.enum';
import type { FiltroCatalogo, FilaCatalogo, FilaFicha } from './catalogo.types';

/**
 * Lectura pública del catálogo. EXCEPCIÓN ACOTADA a «un módulo no usa el repository de otro»:
 * una sola consulta de solo lectura une `mascota` con `raza`, `especie`, `fundacion` y la foto
 * principal mediante las relaciones declaradas en las entidades, y selecciona columnas concretas.
 * No inyecta ningún repository ajeno; así la paginación, el filtro de ciudad y la foto principal
 * salen de una consulta sin N+1.
 */
@Injectable()
export class CatalogoMascotasRepository {
  constructor(@InjectRepository(Mascota) private readonly mascotas: Repository<Mascota>) {}

  /** Disponibles de fundaciones aprobadas, con los filtros opcionales (todos parametrizados). */
  private visibles(filtro: FiltroCatalogo = {}): SelectQueryBuilder<Mascota> {
    const consulta = this.mascotas
      .createQueryBuilder('m')
      .innerJoin('m.raza', 'r')
      .innerJoin('r.especie', 'e')
      .innerJoin('m.fundacion', 'f')
      .where('m.estado = :estado', { estado: EstadoMascota.Disponible })
      // La fundación aprobada hoy no puede revertirse, pero el catálogo no debe depender de ello.
      .andWhere('f.estadoValidacion = :aprobada', { aprobada: EstadoValidacion.Aprobada });
    if (filtro.especieId !== undefined) {
      consulta.andWhere('r.especieId = :especieId', { especieId: filtro.especieId });
    }
    if (filtro.tamano !== undefined) {
      consulta.andWhere('m.tamano = :tamano', { tamano: filtro.tamano });
    }
    if (filtro.edadMinMeses !== undefined) {
      consulta.andWhere('m.edadMeses >= :edadMin', { edadMin: filtro.edadMinMeses });
    }
    if (filtro.edadMaxMeses !== undefined) {
      consulta.andWhere('m.edadMeses <= :edadMax', { edadMax: filtro.edadMaxMeses });
    }
    if (filtro.ciudad !== undefined) {
      // Igualdad exacta normalizada («bogota» = «Bogotá»); no es una búsqueda por prefijo, así
      // que no hay comodines LIKE que escapar. `fundacion` es una tabla pequeña: sin índice propio.
      consulta.andWhere('unaccent(lower(f.ciudad)) = unaccent(lower(:ciudad))', {
        ciudad: filtro.ciudad,
      });
    }
    return consulta;
  }

  contar(filtro: FiltroCatalogo): Promise<number> {
    return this.visibles(filtro).getCount();
  }

  /** Orden `fecha_publicacion DESC, id DESC` (índice `idx_mascota_catalogo`; el id estabiliza la paginación). */
  listar(filtro: FiltroCatalogo, skip: number, take: number): Promise<FilaCatalogo[]> {
    return this.visibles(filtro)
      .leftJoin(FotoMascota, 'fp', 'fp.mascotaId = m.id AND fp.esPrincipal = true')
      .select('m.id', 'id')
      .addSelect('m.nombre', 'nombre')
      .addSelect('e.nombre', 'especie')
      .addSelect('r.nombre', 'raza')
      .addSelect('m.sexo', 'sexo')
      .addSelect('m.edadMeses', 'edadMeses')
      .addSelect('m.tamano', 'tamano')
      .addSelect('f.ciudad', 'ciudad')
      .addSelect('f.nombre', 'fundacionNombre')
      .addSelect('fp.urlCatalogo', 'fotoCatalogoClave')
      .orderBy('m.fechaPublicacion', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .offset(skip)
      .limit(take)
      .getRawMany<FilaCatalogo>();
  }

  /** Solo existe para el público si está disponible y su fundación aprobada. */
  async existeVisible(id: number): Promise<boolean> {
    return (await this.visibles().andWhere('m.id = :id', { id }).getCount()) > 0;
  }

  async buscarFicha(id: number): Promise<FilaFicha | null> {
    const fila = await this.visibles()
      .andWhere('m.id = :id', { id })
      .select('m.id', 'id')
      .addSelect('m.nombre', 'nombre')
      .addSelect('e.nombre', 'especie')
      .addSelect('r.nombre', 'raza')
      .addSelect('m.sexo', 'sexo')
      .addSelect('m.edadMeses', 'edadMeses')
      .addSelect('m.tamano', 'tamano')
      .addSelect('m.color', 'color')
      .addSelect('m.esterilizado', 'esterilizado')
      .addSelect('m.vacunado', 'vacunado')
      .addSelect('m.estadoSalud', 'estadoSalud')
      .addSelect('m.descripcion', 'descripcion')
      .addSelect('m.fechaPublicacion', 'fechaPublicacion')
      .addSelect('f.id', 'fundacionId')
      .addSelect('f.nombre', 'fundacionNombre')
      .addSelect('f.ciudad', 'fundacionCiudad')
      .addSelect('f.descripcion', 'fundacionDescripcion')
      .getRawOne<FilaFicha>();
    return fila ?? null;
  }
}
