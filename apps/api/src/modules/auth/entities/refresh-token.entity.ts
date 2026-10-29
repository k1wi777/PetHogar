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
import type { Usuario } from '../../usuarios/entities/usuario.entity';

@Unique('uq_refresh_token_hash', ['tokenHash'])
@Index('idx_refresh_token_usuario', ['usuarioId'])
@Entity()
export class RefreshToken {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_refresh_token',
  })
  id!: number;

  @Column({ type: 'int' })
  usuarioId!: number;

  @ManyToOne('Usuario', { nullable: false })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_refresh_token_usuario' })
  usuario!: Relation<Usuario>;

  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiraEn!: Date;

  @Column({ type: 'boolean', default: false })
  revocado!: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fechaCreacion!: Date;
}
