import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Unique('uq_especie_nombre', ['nombre'])
@Entity()
export class Especie {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_especie',
  })
  id!: number;

  @Column({ type: 'varchar', length: 40 })
  nombre!: string;
}
