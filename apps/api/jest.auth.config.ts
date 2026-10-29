import type { Config } from 'jest';

// V10: autenticación contra Postgres y Mailpit reales; no las recoge `pnpm test` (V3).
const config: Config = {
  rootDir: 'test',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.auth-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  testEnvironment: 'node',
  maxWorkers: 1,
  testTimeout: 60000,
};

export default config;
