import { defineConfig } from '@playwright/test';

// El stack (Postgres, Mailpit, API y `next start`) lo levanta el operador: ver V6 en verification.md.
const VARIABLES = [
  'E2E_BASE_URL',
  'E2E_API_URL',
  'E2E_MAILPIT_URL',
  'E2E_DEMO_PASSWORD',
  'E2E_ADMIN_PASSWORD',
] as const;
const faltan = VARIABLES.filter((v) => !process.env[v]);
if (faltan.length > 0) {
  throw new Error(
    `Faltan variables para el e2e: ${faltan.join(', ')}. Sigue el procedimiento V6 de .rei/docs/project/verification.md.`,
  );
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // Una sola worker y specs en serie: login y registro tienen límites por minuto en la API.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'e2e/.resultados',
  use: {
    baseURL: process.env.E2E_BASE_URL,
    // Chrome del sistema: no descarga navegadores. Sin Chrome: `pnpm exec playwright install chromium`.
    channel: 'chrome',
    headless: true,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
  },
});
