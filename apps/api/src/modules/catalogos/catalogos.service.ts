import { Injectable, NotFoundException } from '@nestjs/common';
import { CatalogosRepository } from './catalogos.repository';
import type { EspecieResumen, RazaResumen } from './catalogos.types';

export const MENSAJE_ESPECIE_NO_EXISTE = 'La especie no existe';

/** Dueño de `especie` y `raza`. Solo lectura: el catálogo lo define el seed. */
@Injectable()
export class CatalogosService {
  constructor(private readonly repo: CatalogosRepository) {}

  async listarEspecies(): Promise<EspecieResumen[]> {
    const especies = await this.repo.listarEspecies();
    return especies.map((e) => ({ id: e.id, nombre: e.nombre }));
  }

  async listarRazas(especieId: number): Promise<RazaResumen[]> {
    if (!(await this.repo.existeEspecie(especieId))) {
      throw new NotFoundException(MENSAJE_ESPECIE_NO_EXISTE);
    }
    const razas = await this.repo.listarRazas(especieId);
    return razas.map((r) => ({ id: r.id, nombre: r.nombre }));
  }

  /** Para que `mascotas` valide la raza sin tocar este repository. */
  existeRaza(id: number): Promise<boolean> {
    return this.repo.existeRaza(id);
  }
}
