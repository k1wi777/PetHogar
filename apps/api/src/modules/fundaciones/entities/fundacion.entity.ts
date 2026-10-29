import {
  type Relation,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { EstadoValidacion } from './fundacion.enum';
import type { Usuario } from '../../usuarios/entities/usuario.entity';

@Unique('uq_fundacion_usuario', ['usuarioId'])
@Unique('uq_fundacion_nit', ['nit'])
@Index('idx_fundacion_ciudad', ['ciudad'])
@Entity()
export class Fundacion {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_fundacion',
  })
  id!: number;

  @Column({ type: 'int' })
  usuarioId!: number;

  @ManyToOne('Usuario', { nullable: false })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_fundacion_usuario' })
  usuario!: Relation<Usuario>;

  @Column({ type: 'varchar', length: 120 })
  nombre!: string;

  @Column({ type: 'varchar', length: 20 })
  nit!: string;

  @Column({ type: 'varchar', length: 150 })
  direccion!: string;

  @Column({ type: 'varchar', length: 60 })
  ciudad!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logo: string | null;

  @Column({ type: 'varchar', length: 255 })
  documentoUrl!: string;

  @Column({ type: 'enum', enum: EstadoValidacion, default: EstadoValidacion.Pendiente })
  estadoValidacion!: EstadoValidacion;

  @Column({ type: 'varchar', length: 300, nullable: true })
  observacionValidacion: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fechaValidacion: Date | null;
}
