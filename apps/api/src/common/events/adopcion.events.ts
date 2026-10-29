export class AdoptionRequestCreated {
  static readonly eventName = 'adoption-request.created';

  constructor(
    readonly solicitudId: number,
    readonly mascotaId: number,
    readonly fundacionId: number,
    readonly adoptanteId: number,
  ) {}
}

export class AdoptionApproved {
  static readonly eventName = 'adoption.approved';

  constructor(
    readonly solicitudId: number,
    readonly adopcionId: number,
    readonly mascotaId: number,
    readonly fundacionId: number,
    readonly adoptanteId: number,
  ) {}
}

/** Una adopción activa se cerró (`finalizada` o `revocada`); se emite tras el `COMMIT`. */
export class AdoptionClosed {
  static readonly eventName = 'adoption.closed';
  constructor(
    readonly adopcionId: number,
    readonly estado: 'finalizada' | 'revocada',
    readonly mascotaId: number,
    readonly fundacionId: number,
    readonly adoptanteId: number,
  ) {}
}

export class AdoptionRejected {
  static readonly eventName = 'adoption.rejected';

  constructor(
    readonly solicitudId: number,
    readonly mascotaId: number,
    readonly fundacionId: number,
    readonly adoptanteId: number,
    readonly observacion: string | null,
    /** true cuando se rechaza por haberse aprobado otra solicitud de la misma mascota. */
    readonly automatica: boolean,
  ) {}
}
