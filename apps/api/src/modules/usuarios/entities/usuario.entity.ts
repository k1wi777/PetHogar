import {
  type Relation,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Rol } from '../../usuarios/entities/rol.entity';

@Unique('uq_usuario_email', ['email'])
@Entity()
export class Usuario {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_usuario',
  })
  id!: number;

  @Column({ type: 'int' })
  rolId!: number;

  @ManyToOne('Rol', { nullable: false })
  @JoinColumn({ name: 'rol_id', foreignKeyConstraintName: 'fk_usuario_rol' })
  rol!: Relation<Rol>;

  @Column({ type: 'varchar', length: 100 })
  email!: string;

  @Column({ type: 'varchar', length: 200 })
  contrasena!: string;

  @Column({ type: 'varchar', length: 15 })
  telefono!: string;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fechaCreacion!: Date;

  @Column({ type: 'boolean', default: false })
  emailVerificado!: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tokenVerificacionHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  tokenVerificacionExpira: Date | null;

  @Column({ type: 'int', default: 0 })
  intentosFallidos!: number;

  @Column({ type: 'timestamptz', nullable: true })
  bloqueadoHasta: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  resetCodeHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resetCodeExpira: Date | null;

  @Column({ type: 'int', default: 0 })
  resetCodeIntentos!: number;

  @Column({ type: 'boolean', default: false })
  aceptaPoliticaDatos!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  fechaAceptacion: Date | null;
}
