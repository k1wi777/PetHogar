import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// V17: pruebas lentas contra la API real. No las recoge `pnpm test` (que solo busca `*.test.{ts,tsx}`).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['test/api/**/*.api-test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
