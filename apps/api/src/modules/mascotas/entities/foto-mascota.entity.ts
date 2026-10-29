import {
  type Relation,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Mascota } from '../../mascotas/entities/mascota.entity';

@Index('idx_foto_mascota_mascota', ['mascotaId'])
@Index('uq_foto_principal', ['mascotaId'], { unique: true, where: '"es_principal" = true' })
@Entity()
export class FotoMascota {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_foto_mascota',
  })
  id!: number;

  @Column({ type: 'int' })
  mascotaId!: number;

  @ManyToOne('Mascota', { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mascota_id', foreignKeyConstraintName: 'fk_foto_mascota_mascota' })
  mascota!: Relation<Mascota>;

  /** Clave de almacenamiento de la versión grande (no una URL). */
  @Column({ type: 'varchar', length: 255 })
  url!: string;

  /** Clave de almacenamiento de la miniatura del catálogo (no una URL). */
  @Column({ type: 'varchar', length: 255 })
  urlCatalogo!: string;

  @Column({ type: 'boolean', default: false })
  esPrincipal!: boolean;
}
