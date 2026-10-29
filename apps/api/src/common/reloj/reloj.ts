import { Injectable } from '@nestjs/common';

/**
 * Fuente del instante actual, inyectable para que las reglas de fecha y las tareas programadas
 * puedan probarse con un reloj simulado.
 */
export abstract class Reloj {
  abstract ahora(): Date;
}

@Injectable()
export class RelojSistema extends Reloj {
  ahora(): Date {
    return new Date();
  }
}
