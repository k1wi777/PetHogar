import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

/** Bus de eventos de dominio; global porque `EventEmitter2` es transversal. */
@Global()
@Module({
  imports: [EventEmitterModule.forRoot({ wildcard: false, maxListeners: 20 })],
})
export class EventosModule {}
