import { Global, Module } from '@nestjs/common';
import { Reloj, RelojSistema } from './reloj';

/** Global y sustituible: los tests reemplazan el provider `Reloj` por un doble con fecha fija. */
@Global()
@Module({
  providers: [{ provide: Reloj, useClass: RelojSistema }],
  exports: [Reloj],
})
export class RelojModule {}
