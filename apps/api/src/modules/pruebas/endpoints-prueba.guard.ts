import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { esVerdadero, type EnvironmentVariables } from '../../config/env.validation';

/** Hace que los endpoints de prueba "no existan" (404) salvo con HABILITAR_ENDPOINTS_PRUEBA=true. */
@Injectable()
export class EndpointsPruebaGuard implements CanActivate {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  canActivate(): boolean {
    if (!esVerdadero(this.config.get('HABILITAR_ENDPOINTS_PRUEBA', { infer: true }))) {
      throw new NotFoundException();
    }
    return true;
  }
}
