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
