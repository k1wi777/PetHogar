/** Una fundación acaba de registrarse y espera la validación de un administrador. */
export class FoundationRegistered {
  static readonly eventName = 'foundation.registered';
  constructor(readonly fundacionId: number) {}
}

export class FoundationValidated {
  static readonly eventName = 'foundation.validated';

  constructor(
    readonly fundacionId: number,
    readonly decision: 'aprobada' | 'rechazada',
    readonly observacion: string | null,
  ) {}
}
