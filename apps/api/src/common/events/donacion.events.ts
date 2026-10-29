export class DonationRegistered {
  static readonly eventName = 'donation.registered';

  constructor(
    readonly donacionId: number,
    readonly fundacionId: number,
    readonly usuarioId: number | null,
  ) {}
}
