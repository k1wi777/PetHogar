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
import { SexoMascota, TamanoMascota, EstadoMascota } from './mascota.enum';
import type { Fundacion } from '../../fundaciones/entities/fundacion.entity';
import type { Raza } from '../../catalogos/entities/raza.entity';

@Check('ck_mascota_edad_meses', '"edad_meses" >= 0')
@Index('idx_mascota_catalogo', ['fechaPublicacion', 'id'], { where: '"estado" = \'disponible\'' })
@Index('idx_mascota_estado', ['estado'])
@Index('idx_mascota_fundacion', ['fundacionId'])
@Index('idx_mascota_raza', ['razaId'])
@Entity()
export class Mascota {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_mascota',
  })
  id!: number;

  @Column({ type: 'int' })
  fundacionId!: number;

  @ManyToOne('Fundacion', { nullable: false })
  @JoinColumn({ name: 'fundacion_id', foreignKeyConstraintName: 'fk_mascota_fundacion' })
  fundacion!: Relation<Fundacion>;

  @Column({ type: 'int' })
  razaId!: number;

  @ManyToOne('Raza', { nullable: false })
  @JoinColumn({ name: 'raza_id', foreignKeyConstraintName: 'fk_mascota_raza' })
  raza!: Relation<Raza>;

  @Column({ type: 'varchar', length: 60 })
  nombre!: string;

  @Column({ type: 'enum', enum: SexoMascota })
  sexo!: SexoMascota;

  @Column({ type: 'int' })
  edadMeses!: number;

  @Column({ type: 'enum', enum: TamanoMascota })
  tamano!: TamanoMascota;

  @Column({ type: 'varchar', length: 40, nullable: true })
  color: string | null;

  @Column({ type: 'boolean', default: false })
  esterilizado!: boolean;

  @Column({ type: 'boolean', default: false })
  vacunado!: boolean;

  @Column({ type: 'varchar', length: 200 })
  estadoSalud!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcion: string | null;

  @Column({ type: 'enum', enum: EstadoMascota, default: EstadoMascota.Disponible })
  estado!: EstadoMascota;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fechaPublicacion!: Date;
}
