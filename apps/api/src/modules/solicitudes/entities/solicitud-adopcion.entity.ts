import {
  type Relation,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoSolicitud } from './solicitud-adopcion.enum';
import type { Adoptante } from '../../usuarios/entities/adoptante.entity';
import type { Mascota } from '../../mascotas/entities/mascota.entity';

@Index('uq_solicitud_pendiente', ['adoptanteId', 'mascotaId'], {
  unique: true,
  where: `"estado" = 'pendiente'`,
})
@Index('idx_solicitud_adopcion_mascota', ['mascotaId'])
@Entity()
export class SolicitudAdopcion {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_solicitud_adopcion',
  })
  id!: number;

  @Column({ type: 'int' })
  adoptanteId!: number;

  @ManyToOne('Adoptante', { nullable: false })
  @JoinColumn({ name: 'adoptante_id', foreignKeyConstraintName: 'fk_solicitud_adopcion_adoptante' })
  adoptante!: Relation<Adoptante>;

  @Column({ type: 'int' })
  mascotaId!: number;

  @ManyToOne('Mascota', { nullable: false })
  @JoinColumn({ name: 'mascota_id', foreignKeyConstraintName: 'fk_solicitud_adopcion_mascota' })
  mascota!: Relation<Mascota>;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fechaSolicitud!: Date;

  @Column({ type: 'varchar', length: 500 })
  motivo!: string;

  @Column({ type: 'varchar', length: 30 })
  tipoVivienda!: string;

  @Column({ type: 'boolean' })
  tieneOtrasMascotas!: boolean;

  @Column({ type: 'varchar', length: 255 })
  formularioUrl!: string;

  @Column({ type: 'enum', enum: EstadoSolicitud, default: EstadoSolicitud.Pendiente })
  estado!: EstadoSolicitud;

  @Column({ type: 'varchar', length: 300, nullable: true })
  observacion: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fechaRespuesta: Date | null;
}
