import {
  type Relation,
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoDonacion } from './donacion.enum';
import type { Usuario } from '../../usuarios/entities/usuario.entity';
import type { Fundacion } from '../../fundaciones/entities/fundacion.entity';

@Check('ck_donacion_monto', '"monto" IS NULL OR "monto" >= 0')
@Index('idx_donacion_fundacion_fecha', ['fundacionId', 'fecha', 'id'])
@Entity()
export class Donacion {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_donacion',
  })
  id!: number;

  @Column({ type: 'int' })
  fundacionId!: number;

  @ManyToOne('Fundacion', { nullable: false })
  @JoinColumn({ name: 'fundacion_id', foreignKeyConstraintName: 'fk_donacion_fundacion' })
  fundacion!: Relation<Fundacion>;

  @Column({ type: 'int', nullable: true })
  usuarioId: number | null;

  @ManyToOne('Usuario', { nullable: true })
  @JoinColumn({ name: 'usuario_id', foreignKeyConstraintName: 'fk_donacion_usuario' })
  usuario!: Relation<Usuario>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nombreDonante: string | null;

  @Column({ type: 'enum', enum: TipoDonacion })
  tipo!: TipoDonacion;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  monto: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  descripcionEspecie: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  comprobanteUrl: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fecha!: Date;
}
