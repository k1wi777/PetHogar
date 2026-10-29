import {
  type Relation,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoHistorialMedico } from './historial-medico.enum';
import type { Mascota } from '../../mascotas/entities/mascota.entity';

@Entity()
export class HistorialMedico {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_historial_medico',
  })
  id!: number;

  @Column({ type: 'int' })
  mascotaId!: number;

  @ManyToOne('Mascota', { nullable: false })
  @JoinColumn({ name: 'mascota_id', foreignKeyConstraintName: 'fk_historial_medico_mascota' })
  mascota!: Relation<Mascota>;

  @Column({ type: 'enum', enum: TipoHistorialMedico })
  tipo!: TipoHistorialMedico;

  @Column({ type: 'date' })
  fecha!: string;

  @Column({ type: 'varchar', length: 300 })
  descripcion!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  veterinario: string | null;
}
