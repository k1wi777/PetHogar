import {
  type Relation,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Usuario } from '../../usuarios/entities/usuario.entity';

@Index('idx_notificacion_usuario_leida', ['usuarioId', 'leida'])
@Entity()
export class Notificacion {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_notificacion',
  })
  id!: number;

  @Column({ type: 'int' })
  usuarioId!: number;

  @ManyToOne('Usuario', { nullable: false })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_notificacion_usuario' })
  usuario!: Relation<Usuario>;

  @Column({ type: 'varchar', length: 30 })
  tipo!: string;

  @Column({ type: 'varchar', length: 100 })
  titulo!: string;

  @Column({ type: 'varchar', length: 300 })
  mensaje!: string;

  @Column({ type: 'boolean', default: false })
  leida!: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fechaCreacion!: Date;
}
