import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('responde que la API está operativa', () => {
    expect(new HealthController().comprobar()).toEqual({ status: 'ok' });
  });
});
