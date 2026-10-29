import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Especie } from './entities/especie.entity';
import { Raza } from './entities/raza.entity';

@Injectable()
export class CatalogosRepository {
  constructor(
    @InjectRepository(Especie) private readonly especies: Repository<Especie>,
    @InjectRepository(Raza) private readonly razas: Repository<Raza>,
  ) {}

  listarEspecies(): Promise<Especie[]> {
    return this.especies.find({ order: { nombre: 'ASC', id: 'ASC' } });
  }

  existeEspecie(id: number): Promise<boolean> {
    return this.especies.exists({ where: { id } });
  }

  listarRazas(especieId: number): Promise<Raza[]> {
    return this.razas.find({ where: { especieId }, order: { nombre: 'ASC', id: 'ASC' } });
  }

  existeRaza(id: number): Promise<boolean> {
    return this.razas.exists({ where: { id } });
  }
}
