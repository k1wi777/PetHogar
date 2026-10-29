import type { Config } from 'jest';

// V12: solicitudes y adopciones contra Postgres, Mailpit y disco reales; no las recoge `pnpm test` (V3).
const config: Config = {
  rootDir: 'test',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.adopciones-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  testEnvironment: 'node',
  maxWorkers: 1,
  testTimeout: 120000,
};

export default config;
