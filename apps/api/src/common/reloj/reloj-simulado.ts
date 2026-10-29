import { Reloj } from './reloj';

/** Doble de `Reloj` para pruebas: el instante se fija a mano y no avanza solo. */
export class RelojSimulado extends Reloj {
  constructor(private instante: Date) {
    super();
  }

  ahora(): Date {
    return new Date(this.instante);
  }

  fijar(instante: Date | string): void {
    this.instante = new Date(instante);
  }
}
