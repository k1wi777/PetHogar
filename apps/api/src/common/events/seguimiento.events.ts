export class FollowUpScheduled {
  static readonly eventName = 'follow-up.scheduled';

  constructor(
    readonly seguimientoId: number,
    readonly adopcionId: number,
    readonly fechaProgramada: Date,
  ) {}
}

export class FollowUpReportReceived {
  static readonly eventName = 'follow-up.report-received';

  constructor(
    readonly seguimientoId: number,
    readonly adopcionId: number,
  ) {}
}

export class FollowUpOverdue {
  static readonly eventName = 'follow-up.overdue';

  constructor(
    readonly seguimientoId: number,
    readonly adopcionId: number,
  ) {}
}

export class WellbeingAlertRaised {
  static readonly eventName = 'wellbeing-alert.raised';

  constructor(
    readonly seguimientoId: number,
    readonly adopcionId: number,
    readonly mascotaId: number,
    readonly fundacionId: number,
  ) {}
}
