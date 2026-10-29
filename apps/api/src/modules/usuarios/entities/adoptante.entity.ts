import {
  type Relation,
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Usuario } from '../../usuarios/entities/usuario.entity';

@Unique('uq_adoptante_usuario', ['usuarioId'])
@Unique('uq_adoptante_numero_documento', ['numeroDocumento'])
@Check('ck_adoptante_tipo_documento', `"tipo_documento" IN ('CC', 'CE', 'PA')`)
@Entity()
export class Adoptante {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_adoptante',
  })
  id!: number;

  @Column({ type: 'int' })
  usuarioId!: number;

  @ManyToOne('Usuario', { nullable: false })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_adoptante_usuario' })
  usuario!: Relation<Usuario>;

  @Column({ type: 'varchar', length: 40 })
  primerNombre!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  segundoNombre: string | null;

  @Column({ type: 'varchar', length: 40 })
  primerApellido!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  segundoApellido: string | null;

  @Column({ type: 'varchar', length: 5 })
  tipoDocumento!: string;

  @Column({ type: 'varchar', length: 20 })
  numeroDocumento!: string;

  @Column({ type: 'date' })
  fechaNacimiento!: string;

  @Column({ type: 'varchar', length: 150 })
  direccion!: string;

  @Column({ type: 'varchar', length: 60 })
  ciudad!: string;
}
