import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { type EnvironmentVariables, esVerdadero } from '../../../config/env.validation';
import { ZONA_HORARIA_TAREAS } from '../seguimientos.constants';
import { SeguimientosTareasService } from './seguimientos-tareas.service';

export const JOB_VENCIDOS = 'seguimientos-vencidos';
export const JOB_RECORDATORIOS = 'seguimientos-recordatorios';

/**
 * Registra los jobs por código en lugar de con `@Cron(...)`: los decoradores resuelven la
 * expresión al importar el archivo, antes de que el entorno esté validado. Con las tareas
 * deshabilitadas no se crea ningún temporizador. Cada job captura y registra sus errores: una
 * excepción en el cron nunca derriba el proceso.
 */
@Injectable()
export class SeguimientosCronRegistro implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SeguimientosCronRegistro.name);
  private readonly registrados: string[] = [];
  private readonly enCurso = new Set<string>();

  constructor(
    private readonly registro: SchedulerRegistry,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly tareas: SeguimientosTareasService,
  ) {}

  onApplicationBootstrap(): void {
    if (!esVerdadero(this.config.get('SEGUIMIENTOS_CRON_HABILITADO', { infer: true }))) {
      this.logger.log('Tareas programadas de seguimientos deshabilitadas');
      return;
    }
    this.registrar(
      JOB_VENCIDOS,
      this.config.get('SEGUIMIENTOS_CRON_VENCIDOS', { infer: true }),
      () => this.tareas.marcarVencidos(),
    );
    this.registrar(
      JOB_RECORDATORIOS,
      this.config.get('SEGUIMIENTOS_CRON_RECORDATORIOS', { infer: true }),
      () => this.tareas.emitirRecordatorios(),
    );
  }

  onModuleDestroy(): void {
    for (const nombre of this.registrados.splice(0)) this.registro.deleteCronJob(nombre);
  }

  /** Ejecuta una tarea sin dejar escapar errores y sin solaparse con la misma tarea en curso. */
  async ejecutar(nombre: string, tarea: () => Promise<number>): Promise<void> {
    if (this.enCurso.has(nombre)) {
      this.logger.warn(`La tarea ${nombre} sigue en curso: se omite esta ejecución`);
      return;
    }
    this.enCurso.add(nombre);
    try {
      const afectados = await tarea();
      this.logger.log(`Tarea ${nombre}: ${afectados} seguimiento(s) procesado(s)`);
    } catch (error) {
      this.logger.error(
        `Falló la tarea ${nombre}: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.enCurso.delete(nombre);
    }
  }

  private registrar(nombre: string, expresion: string, tarea: () => Promise<number>): void {
    const job = CronJob.from({
      cronTime: expresion,
      onTick: () => {
        void this.ejecutar(nombre, tarea);
      },
      start: false,
      timeZone: ZONA_HORARIA_TAREAS,
    });
    this.registro.addCronJob(nombre, job);
    this.registrados.push(nombre);
    job.start();
    this.logger.log(`Tarea ${nombre} programada (${expresion}, ${ZONA_HORARIA_TAREAS})`);
  }
}
