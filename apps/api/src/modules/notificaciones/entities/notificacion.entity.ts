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
@Index('idx_notificacion_usuario_fecha', ['usuarioId', 'fechaCreacion', 'id'])
// Deduplicación por destinatario: un aviso repetido choca con este índice y no crea otra fila.
@Index('uq_notificacion_clave', ['usuarioId', 'clave'], {
  unique: true,
  where: '"clave" IS NOT NULL',
})
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

  /** Entidad relacionada (`solicitud`, `seguimiento`…); el front elige la pantalla. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  entidad: string | null;

  @Column({ type: 'int', nullable: true })
  entidadId: number | null;

  /** Clave de deduplicación `<evento>:<id>`; nunca se expone. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  clave: string | null;

  @Column({ type: 'boolean', default: false })
  leida!: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fechaCreacion!: Date;
}
