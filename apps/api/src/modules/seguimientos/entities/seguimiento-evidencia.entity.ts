import {
  type Relation,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Seguimiento } from '../../seguimientos/entities/seguimiento.entity';

@Entity()
export class SeguimientoEvidencia {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_seguimiento_evidencia',
  })
  id!: number;

  @Column({ type: 'int' })
  seguimientoId!: number;

  @ManyToOne('Seguimiento', { nullable: false })
  @JoinColumn({
    name: 'seguimiento_id',
    foreignKeyConstraintName: 'fk_seguimiento_evidencia_seguimiento',
  })
  seguimiento!: Relation<Seguimiento>;

  @Column({ type: 'varchar', length: 255 })
  url!: string;
}
