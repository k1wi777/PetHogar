import { expect, test, type Page } from '@playwright/test';
import {
  CLAVE_ADMIN,
  CLAVE_DEMO,
  CORREO_ADMIN,
  CORREO_ADOPTANTE_DEMO,
  CORREO_FUNDACION_DEMO,
} from './soporte/entorno';
import { auditar } from './soporte/axe';
import { cargar, ingresar, primerEnlace } from './soporte/ui';

const ANCHOS = [360, 768, 1280] as const;

interface Pantalla {
  nombre: string;
  ruta: string | ((page: Page) => Promise<string>);
}

/** Espera a que la pantalla termine de cargar: un h1 y sin esqueletos ni cargas pendientes. */
async function listaParaAuditar(page: Page): Promise<void> {
  await expect(page.locator('h1').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Revisa una pantalla y devuelve sus hallazgos como texto (vacío si está bien). */
async function revisar(page: Page, pantalla: Pantalla): Promise<string[]> {
  const problemas: string[] = [];
  try {
    const ruta = typeof pantalla.ruta === 'string' ? pantalla.ruta : await pantalla.ruta(page);
    // Se carga una vez y solo se redimensiona: la maquetación es CSS y así se respeta el límite
    // de peticiones de la API.
    await page.setViewportSize({ width: ANCHOS[0], height: 900 });
    await cargar(page, ruta);
    await listaParaAuditar(page);
    for (const ancho of ANCHOS) {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.waitForTimeout(250);
      const medidas = await page.evaluate(() => ({
        contenido: document.documentElement.scrollWidth,
        ventana: window.innerWidth,
      }));
      if (medidas.contenido > medidas.ventana) {
        problemas.push(
          `${ruta} @${ancho}px: scrollWidth ${medidas.contenido} > ${medidas.ventana}`,
        );
      }
      if (ancho === 1280 || ancho === 360) {
        for (const g of await auditar(page)) {
          problemas.push(`${ruta} @${ancho}px: ${g.impacto} ${g.regla} -> ${g.nodos.join(' | ')}`);
        }
        const h1 = await page.locator('h1').count();
        if (h1 !== 1) problemas.push(`${ruta} @${ancho}px: ${h1} elementos h1 (debe haber 1)`);
      }
    }
  } catch (error) {
    problemas.push(
      `${pantalla.nombre}: no se pudo revisar (${(error as Error).message.split('\n')[0]})`,
    );
  }
  return problemas;
}

/**
 * Una sola prueba por contexto (un solo login, límite de 5/min): recorre todas las pantallas y
 * falla al final con el informe completo, en vez de detenerse en la primera.
 */
function pruebasDeContexto(
  contexto: string,
  pantallas: Pantalla[],
  sesion?: { email: string; clave: string },
) {
  test(`${contexto}: axe sin violaciones graves, un h1 y sin desborde a 360/768/1280`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      if (sesion) await ingresar(page, sesion.email, sesion.clave);
      const informe: string[] = [];
      for (const pantalla of pantallas) informe.push(...(await revisar(page, pantalla)));
      expect(informe, informe.join('\n')).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
}

pruebasDeContexto('Contexto público', [
  { nombre: 'Inicio', ruta: '/' },
  { nombre: 'Catálogo', ruta: '/adoptar' },
  {
    nombre: 'Ficha de mascota',
    ruta: (page) => primerEnlace(page, '/adoptar', /^\/mascotas\/\d+$/),
  },
  { nombre: 'Cómo donar', ruta: '/donar' },
  { nombre: 'Ingresar', ruta: '/ingresar' },
  { nombre: 'Registro de adoptante', ruta: '/registro' },
  { nombre: 'Registro de fundación', ruta: '/registro-fundacion' },
  { nombre: 'Recuperar contraseña', ruta: '/recuperar' },
  { nombre: 'Página 404', ruta: '/esta-ruta-no-existe' },
]);

pruebasDeContexto(
  'Contexto del adoptante',
  [
    { nombre: 'Inicio del adoptante', ruta: '/adoptante' },
    { nombre: 'Mis solicitudes', ruta: '/adoptante/solicitudes' },
    {
      nombre: 'Detalle de solicitud',
      ruta: (page) =>
        primerEnlace(page, '/adoptante/solicitudes', /^\/adoptante\/solicitudes\/\d+/),
    },
    {
      nombre: 'Nueva solicitud',
      ruta: async (page) =>
        `/adoptante/solicitudes/nueva?mascota=${(await primerEnlace(page, '/adoptar', /^\/mascotas\/\d+$/)).split('/').pop()}`,
    },
    { nombre: 'Mis adopciones', ruta: '/adoptante/adopciones' },
    { nombre: 'Donar', ruta: '/adoptante/donar' },
    { nombre: 'Notificaciones', ruta: '/adoptante/notificaciones' },
  ],
  { email: CORREO_ADOPTANTE_DEMO, clave: CLAVE_DEMO },
);

pruebasDeContexto(
  'Contexto de la fundación',
  [
    { nombre: 'Resumen', ruta: '/fundacion' },
    { nombre: 'Mis mascotas', ruta: '/fundacion/mascotas' },
    { nombre: 'Nueva mascota', ruta: '/fundacion/mascotas/nueva' },
    {
      nombre: 'Ficha de gestión',
      ruta: (page) => primerEnlace(page, '/fundacion/mascotas', /^\/fundacion\/mascotas\/\d+/),
    },
    { nombre: 'Solicitudes recibidas', ruta: '/fundacion/solicitudes' },
    {
      nombre: 'Revisión de solicitud',
      ruta: (page) =>
        primerEnlace(page, '/fundacion/solicitudes', /^\/fundacion\/solicitudes\/\d+/),
    },
    { nombre: 'Adopciones y seguimientos', ruta: '/fundacion/adopciones' },
    { nombre: 'Donaciones', ruta: '/fundacion/donaciones' },
    { nombre: 'Registrar aporte', ruta: '/fundacion/donaciones/nueva' },
    { nombre: 'Reportes', ruta: '/fundacion/reportes' },
    { nombre: 'Notificaciones', ruta: '/fundacion/notificaciones' },
  ],
  { email: CORREO_FUNDACION_DEMO, clave: CLAVE_DEMO },
);

pruebasDeContexto(
  'Contexto del administrador',
  [
    { nombre: 'Resumen', ruta: '/administrador' },
    { nombre: 'Fundaciones', ruta: '/administrador/fundaciones' },
    {
      nombre: 'Detalle de fundación',
      ruta: (page) =>
        primerEnlace(
          page,
          '/administrador/fundaciones?estado=aprobada',
          /^\/administrador\/fundaciones\/\d+/,
        ),
    },
    { nombre: 'Usuarios', ruta: '/administrador/usuarios' },
    { nombre: 'Reportes', ruta: '/administrador/reportes' },
    { nombre: 'Notificaciones', ruta: '/administrador/notificaciones' },
  ],
  { email: CORREO_ADMIN, clave: CLAVE_ADMIN },
);

test('Gráficas de dona: cada rebanada va separada por un trazo de 2 px del color de la tarjeta', async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await ingresar(page, CORREO_FUNDACION_DEMO, CLAVE_DEMO);
    await cargar(page, '/fundacion/reportes');
    // La dona está en la pestaña «Solicitudes» (también en Seguimientos y Donaciones).
    await page.getByRole('tab', { name: 'Solicitudes' }).click();
    const rebanadas = page.locator('.recharts-pie-sector path');
    await expect(rebanadas.first()).toBeVisible({ timeout: 30_000 });
    const trazos = await rebanadas.evaluateAll((paths) =>
      paths.map((p) => {
        const c = getComputedStyle(p);
        return { trazo: c.stroke, ancho: parseFloat(c.strokeWidth) };
      }),
    );
    expect(trazos.length).toBeGreaterThanOrEqual(2);
    for (const t of trazos) {
      expect(t.trazo).toBe('rgb(255, 255, 255)');
      expect(t.ancho).toBeGreaterThanOrEqual(2);
    }
    // Además del color, cada serie lleva su patrón SVG.
    expect(await page.locator('svg pattern').count()).toBeGreaterThanOrEqual(1);
  } finally {
    await ctx.close();
  }
});
