import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Unique('uq_rol_nombre', ['nombre'])
@Entity()
export class Rol {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_rol',
  })
  id!: number;

  @Column({ type: 'varchar', length: 20 })
  nombre!: string;
}
