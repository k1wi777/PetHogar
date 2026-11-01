import { expect, test } from '@playwright/test';
import { crearAdoptanteVerificado, type AdoptanteE2E } from './soporte/api';
import { CLAVE_DEMO, CORREO_FUNDACION_DEMO } from './soporte/entorno';
import { ingresar } from './soporte/ui';

// Verifica (no implementa) el Task `login-destino-segun-rol`: un `siguiente` del panel de otro
// rol nunca debe terminar en el 403, sino en el panel del propio rol.
const EJECUCION = Date.now().toString(36);

test.describe('Login con «siguiente» de otro rol', () => {
  let adoptante: AdoptanteE2E;

  test.beforeAll(async () => {
    adoptante = await crearAdoptanteVerificado(`x${EJECUCION}`);
  });

  test('un adoptante con destino de la fundación llega a su propio panel, sin 403', async ({
    page,
  }) => {
    await ingresar(page, adoptante.email, adoptante.clave, '/fundacion/solicitudes');
    await expect(page).toHaveURL(/\/adoptante(\/|$|\?)/);
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.getByText('No tienes permiso para ver esta página')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: /panel|principal/i }).first()).toBeVisible();
  });

  test('una fundación con destino del adoptante llega a su propio panel, sin 403', async ({
    page,
  }) => {
    await ingresar(page, CORREO_FUNDACION_DEMO, CLAVE_DEMO, '/adoptante/solicitudes');
    await expect(page).toHaveURL(/\/fundacion(\/|$|\?)/);
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.getByText('No tienes permiso para ver esta página')).toHaveCount(0);
  });

  test('un destino del propio rol se respeta', async ({ page }) => {
    await ingresar(page, adoptante.email, adoptante.clave, '/adoptante/solicitudes');
    await expect(page).toHaveURL(/\/adoptante\/solicitudes/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mis solicitudes' })).toBeVisible();
  });
});
