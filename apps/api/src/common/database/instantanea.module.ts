import { Global, Module } from '@nestjs/common';
import { InstantaneaService } from './instantanea.service';

/** Global: lo usan `donaciones` y `reportes` sin acoplarse entre sí. */
@Global()
@Module({ providers: [InstantaneaService], exports: [InstantaneaService] })
export class InstantaneaModule {}
