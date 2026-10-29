import type { Config } from 'jest';

// V15: barrido de claves, límites de subida, estadísticas con cifras conocidas, índices y respaldo con
// restauración contra Postgres, Mailpit y disco reales; no las recoge `pnpm test` (V3).
const config: Config = {
  rootDir: 'test/calidad',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.calidad-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../../tsconfig.json' }] },
  testEnvironment: 'node',
  maxWorkers: 1,
  testTimeout: 240000,
};

export default config;
