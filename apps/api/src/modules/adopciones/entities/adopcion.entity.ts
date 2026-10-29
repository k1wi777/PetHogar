import {
  type Relation,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EstadoAdopcion } from './adopcion.enum';
import type { SolicitudAdopcion } from '../../solicitudes/entities/solicitud-adopcion.entity';

@Unique('uq_adopcion_solicitud', ['solicitudId'])
@Entity()
export class Adopcion {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_adopcion',
  })
  id!: number;

  @Column({ type: 'int' })
  solicitudId!: number;

  @ManyToOne('SolicitudAdopcion', { nullable: false })
  @JoinColumn({ name: 'solicitud_id', foreignKeyConstraintName: 'fk_adopcion_solicitud' })
  solicitud!: Relation<SolicitudAdopcion>;

  @Column({ type: 'date' })
  fechaEntrega!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actaUrl: string | null;

  @Column({ type: 'enum', enum: EstadoAdopcion, default: EstadoAdopcion.Activa })
  estado!: EstadoAdopcion;

  @Column({ type: 'varchar', length: 300, nullable: true })
  motivoCierre: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fechaCierre: Date | null;
}
