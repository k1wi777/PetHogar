import type { Config } from 'jest';

// V5: flujo completo de la API (Supertest) contra Postgres, Mailpit y disco reales; no lo recoge
// `pnpm test` (V3).
const config: Config = {
  rootDir: 'test/e2e',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../../tsconfig.json' }] },
  testEnvironment: 'node',
  maxWorkers: 1,
  testTimeout: 120000,
};

export default config;
