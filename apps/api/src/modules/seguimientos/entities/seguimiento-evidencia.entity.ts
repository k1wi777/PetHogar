import {
  type Relation,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrigenEvidencia } from './seguimiento.enum';
import type { Seguimiento } from '../../seguimientos/entities/seguimiento.entity';

// Postgres no indexa las claves foráneas.
@Index('idx_seguimiento_evidencia_seguimiento', ['seguimientoId'])
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

  @Column({
    type: 'enum',
    enum: OrigenEvidencia,
    enumName: 'origen_evidencia',
    default: OrigenEvidencia.Fundacion,
  })
  origen!: OrigenEvidencia;
}
