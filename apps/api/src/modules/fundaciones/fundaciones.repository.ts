import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Fundacion } from './entities/fundacion.entity';
import type { DatosNuevaFundacion } from './fundaciones.types';

@Injectable()
export class FundacionesRepository {
  constructor(@InjectRepository(Fundacion) private readonly fundaciones: Repository<Fundacion>) {}

  crear(datos: DatosNuevaFundacion, manager?: EntityManager): Promise<Fundacion> {
    const repo = manager?.getRepository(Fundacion) ?? this.fundaciones;
    return repo.save(
      repo.create({
        usuarioId: datos.usuarioId,
        nombre: datos.nombre,
        nit: datos.nit,
        direccion: datos.direccion,
        ciudad: datos.ciudad,
        descripcion: datos.descripcion,
        documentoUrl: datos.documentoClave,
      }),
    );
  }

  existeNit(nit: string): Promise<boolean> {
    return this.fundaciones.exists({ where: { nit } });
  }

  buscarPorUsuarioId(usuarioId: number): Promise<Fundacion | null> {
    return this.fundaciones.findOne({ where: { usuarioId } });
  }
}
