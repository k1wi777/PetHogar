import { expect, test, type Page } from '@playwright/test';
import {
  CLAVE_ADMIN,
  CLAVE_DEMO,
  CORREO_ADMIN,
  CORREO_ADOPTANTE_DEMO,
  CORREO_FUNDACION_DEMO,
} from './soporte/entorno';
import { auditar } from './soporte/axe';
import { cargar, ingresar } from './soporte/ui';

interface Resumen {
  contexto: string;
  ruta: string;
  email: string;
  clave: string;
  /** Tarjetas (secciones con nombre) que el seed demo debe dejar visibles. */
  tarjetas: string[];
}

const TECNICO = /undefined|\[object|Error:|NaN/;

/** Espera a que todas las tarjetas terminen de cargar (sin esqueletos ni `aria-busy`). */
async function esperarCarga(page: Page): Promise<void> {
  await expect(page.locator('h1')).toHaveCount(1);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Cargando' })).toHaveCount(0);
}

/**
 * Un solo login por rol (5/min en la API): carga el inicio del panel contra el seed demo y
 * comprueba el contenido, los textos prohibidos, axe y el desborde a 360 px.
 */
function resumenDe({ contexto, ruta, email, clave, tarjetas }: Resumen) {
  test(`${contexto}: el resumen carga sin «próximamente» ni texto técnico, accesible y a 360 px`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await ingresar(page, email, clave);
      await page.setViewportSize({ width: 1280, height: 900 });
      await cargar(page, ruta);
      await esperarCarga(page);

      for (const nombre of tarjetas) {
        await expect(page.getByRole('region', { name: nombre })).toBeVisible();
      }
      const texto = (await page.locator('main').innerText()).trim();
      expect(texto).not.toMatch(/próximamente/i);
      expect(texto).not.toMatch(TECNICO);
      expect(texto).not.toContain('No pudimos cargar');
      expect(await auditar(page), 'axe a 1280 px').toEqual([]);

      await page.setViewportSize({ width: 360, height: 900 });
      await page.waitForTimeout(250);
      expect(await page.locator('h1').count()).toBe(1);
      expect(await auditar(page), 'axe a 360 px').toEqual([]);
      const medidas = await page.evaluate(() => ({
        contenido: document.documentElement.scrollWidth,
        ventana: window.innerWidth,
      }));
      expect(medidas.contenido, 'scrollWidth a 360 px').toBeLessThanOrEqual(medidas.ventana);
    } finally {
      await ctx.close();
    }
  });
}

resumenDe({
  contexto: 'Adoptante',
  ruta: '/adoptante',
  email: CORREO_ADOPTANTE_DEMO,
  clave: CLAVE_DEMO,
  tarjetas: ['Mis solicitudes', 'Mis adopciones activas', 'Seguimientos', 'Notificaciones'],
});

resumenDe({
  contexto: 'Fundación',
  ruta: '/fundacion',
  email: CORREO_FUNDACION_DEMO,
  clave: CLAVE_DEMO,
  tarjetas: [
    'Mis mascotas',
    'Solicitudes pendientes',
    'Seguimientos',
    'Donaciones del mes',
    'Notificaciones',
  ],
});

resumenDe({
  contexto: 'Administrador',
  ruta: '/administrador',
  email: CORREO_ADMIN,
  clave: CLAVE_ADMIN,
  tarjetas: ['Fundaciones por validar', 'Estadísticas de la plataforma', 'Notificaciones'],
});
