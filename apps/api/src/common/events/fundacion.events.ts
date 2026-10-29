export class FoundationValidated {
  static readonly eventName = 'foundation.validated';

  constructor(
    readonly fundacionId: number,
    readonly decision: 'aprobada' | 'rechazada',
    readonly observacion: string | null,
  ) {}
}
