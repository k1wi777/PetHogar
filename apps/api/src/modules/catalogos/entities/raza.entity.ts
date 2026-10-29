import {
  type Relation,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Especie } from '../../catalogos/entities/especie.entity';

@Unique('uq_raza_especie_nombre', ['especieId', 'nombre'])
@Entity()
export class Raza {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_raza',
  })
  id!: number;

  @Column({ type: 'int' })
  especieId!: number;

  @ManyToOne('Especie', { nullable: false })
  @JoinColumn({ name: 'especie_id', foreignKeyConstraintName: 'fk_raza_especie' })
  especie!: Relation<Especie>;

  @Column({ type: 'varchar', length: 60 })
  nombre!: string;
}
