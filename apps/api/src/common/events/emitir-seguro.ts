import type { Logger } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Emite un evento ya confirmado: si un listener lanza, se registra y no deshace la operación ni
 * rompe la respuesta. Solo se invoca después del `COMMIT`.
 */
export function emitirSeguro(
  eventos: EventEmitter2,
  nombre: string,
  evento: object,
  logger: Logger,
): void {
  try {
    eventos.emit(nombre, evento);
  } catch (error) {
    logger.error(
      `Falló un listener de ${nombre}: ${error instanceof Error ? error.message : 'error desconocido'}`,
    );
  }
}
