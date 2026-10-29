import {
  type Relation,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoSeguimiento, EstadoSeguimiento, EstadoBienestar } from './seguimiento.enum';
import type { Adopcion } from '../../adopciones/entities/adopcion.entity';

@Index('idx_seguimiento_adopcion_estado', ['adopcionId', 'estado'])
// El cron nunca recorre toda la tabla: solo los pendientes de vencer.
@Index('idx_seguimiento_pendiente_fecha', ['fechaProgramada'], {
  where: `"estado" = 'programado'`,
})
// Evita el duplicado por doble clic: un solo seguimiento pendiente por adopción, tipo y fecha.
@Index('uq_seguimiento_pendiente', ['adopcionId', 'tipo', 'fechaProgramada'], {
  unique: true,
  where: `"estado" IN ('programado', 'vencido')`,
})
@Entity()
export class Seguimiento {
  @PrimaryGeneratedColumn('identity', {
    generatedIdentity: 'ALWAYS',
    primaryKeyConstraintName: 'pk_seguimiento',
  })
  id!: number;

  @Column({ type: 'int' })
  adopcionId!: number;

  @ManyToOne('Adopcion', { nullable: false })
  @JoinColumn({ name: 'adopcion_id', foreignKeyConstraintName: 'fk_seguimiento_adopcion' })
  adopcion!: Relation<Adopcion>;

  @Column({ type: 'enum', enum: TipoSeguimiento })
  tipo!: TipoSeguimiento;

  @Column({ type: 'date' })
  fechaProgramada!: string;

  @Column({ type: 'date', nullable: true })
  fechaRealizada: string | null;

  @Column({ type: 'enum', enum: EstadoSeguimiento, default: EstadoSeguimiento.Programado })
  estado!: EstadoSeguimiento;

  @Column({ type: 'enum', enum: EstadoBienestar, nullable: true })
  estadoBienestar: EstadoBienestar | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  observaciones: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reporteAdoptante: string | null;

  /** Marca persistente: el recordatorio de «vence pronto» se emite una sola vez. */
  @Column({ type: 'timestamptz', nullable: true })
  recordatorioEnviadoEn: Date | null;

  /** Primera entrega del reporte del adoptante; nulo mientras no haya enviado nada. */
  @Column({ type: 'timestamptz', nullable: true })
  reporteEnviadoEn: Date | null;
}
