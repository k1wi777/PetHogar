import type { Config } from 'jest';

// V9: pruebas contra Mailpit y disco real; no las recoge `pnpm test` (V3).
const config: Config = {
  rootDir: 'test',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.infra-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  testEnvironment: 'node',
  maxWorkers: 1,
  testTimeout: 30000,
};

export default config;
