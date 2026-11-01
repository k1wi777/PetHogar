import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  PNG_1X1,
  crearAdoptanteVerificado,
  darDeBaja,
  publicarMascota,
  type AdoptanteE2E,
} from './soporte/api';
import { CLAVE_DEMO, CORREO_FUNDACION_DEMO } from './soporte/entorno';
import { cargar, esperarSesion, ingresar, primerEnlace } from './soporte/ui';

// Recorre el flujo de adopción SIN ratón (R12): solo Tab, Shift+Tab, flechas, Espacio, Enter y
// Escape. La única excepción es el selector de archivos del sistema, que no se automatiza con
// teclado: el campo se alcanza con Tab y el archivo se adjunta con setInputFiles.
const EJECUCION = Date.now().toString(36);
const EDAD_MESES = 13;
const NOMBRE_MASCOTA = `Teclado${EJECUCION}`.slice(0, 40);

/** Pulsa Tab hasta que `objetivo` tenga el foco; falla si no se alcanza en `maximo` pulsaciones. */
async function tabHasta(page: Page, objetivo: Locator, maximo = 80): Promise<void> {
  for (let i = 0; i < maximo; i++) {
    if (
      await objetivo
        .evaluate((el) => el === document.activeElement, undefined, { timeout: 500 })
        .catch(() => false)
    ) {
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`El foco no llegó a ${objetivo} con Tab en ${maximo} pulsaciones`);
}

/** El control enfocado debe mostrar un indicador (contorno o sombra) distinto de «ninguno». */
async function conFocoVisible(objetivo: Locator): Promise<void> {
  const estilo = await objetivo.evaluate((el) => {
    const c = getComputedStyle(el);
    return {
      contorno: c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0,
      sombra: c.boxShadow !== 'none',
    };
  });
  expect(estilo.contorno || estilo.sombra, 'indicador de foco visible').toBe(true);
}

test.describe('Flujo de adopción solo con teclado', () => {
  test.describe.configure({ mode: 'serial' });
  let adoptante: AdoptanteE2E;
  let mascotaId: number;

  test.beforeAll(async () => {
    adoptante = await crearAdoptanteVerificado(`k${EJECUCION}`);
    mascotaId = await publicarMascota(NOMBRE_MASCOTA, EDAD_MESES);
  });
  test.afterAll(async () => {
    if (mascotaId) await darDeBaja(mascotaId);
  });

  test('de ingresar a «Mis solicitudes» sin tocar el ratón', async ({ page }) => {
    // Ingreso: el primer foco es «Saltar al contenido». La API limita los logins por minuto y por
    // IP (5): si se alcanza, se espera la siguiente ventana y se repite el ingreso con teclado.
    for (let intento = 1; ; intento++) {
      await page.goto('/ingresar');
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
      await conFocoVisible(page.getByRole('link', { name: 'Saltar al contenido' }));
      await tabHasta(page, page.getByLabel('Correo electrónico'));
      await page.keyboard.type(adoptante.email);
      await page.keyboard.press('Tab');
      await page.keyboard.type(adoptante.clave);
      await tabHasta(page, page.getByRole('button', { name: 'Ingresar' }));
      await conFocoVisible(page.getByRole('button', { name: 'Ingresar' }));
      await page.keyboard.press('Enter');
      const entro = await page
        .waitForURL(/\/adoptante/, { timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      if (entro) break;
      const limite = await page.getByText(/demasiados intentos/i).isVisible();
      if (!limite || intento >= 3) break;
      await page.waitForTimeout(61_000);
    }
    await expect(page).toHaveURL(/\/adoptante/);
    await esperarSesion(page);

    // Catálogo: buscar con el formulario nativo y abrir la ficha.
    await cargar(page, `/adoptar?edadMin=${EDAD_MESES}&edadMax=${EDAD_MESES}`);
    await tabHasta(page, page.getByRole('button', { name: 'Buscar' }));
    await page.keyboard.press('Enter');
    await esperarSesion(page);
    const enlace = page.getByRole('link', { name: new RegExp(NOMBRE_MASCOTA) }).first();
    await tabHasta(page, enlace, 200);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: NOMBRE_MASCOTA })).toBeVisible();

    // Ficha: «Quiero adoptar».
    const adoptar = page.getByRole('link', { name: 'Quiero adoptar' });
    await tabHasta(page, adoptar);
    await conFocoVisible(adoptar);
    await page.keyboard.press('Enter');

    // Solicitud: texto, radios con flechas, documento y envío.
    await tabHasta(page, page.getByLabel('¿Por qué quieres adoptar?'));
    await page.keyboard.type('Tengo patio y mucho tiempo libre');
    await tabHasta(page, page.getByRole('radio', { name: 'Casa' }));
    await page.keyboard.press('Space');
    await expect(page.getByRole('radio', { name: 'Casa' })).toBeChecked();
    await tabHasta(page, page.getByRole('radio', { name: 'Sí', exact: true }));
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('radio', { name: 'No', exact: true })).toBeChecked();
    const archivo = page.getByLabel('Formulario de adopción firmado');
    await tabHasta(page, archivo);
    await archivo.setInputFiles({ name: 'formulario.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await tabHasta(page, page.getByRole('button', { name: 'Revisar mi solicitud' }));
    await page.keyboard.press('Enter');
    await tabHasta(page, page.getByRole('button', { name: 'Confirmar y enviar' }));
    await page.keyboard.press('Enter');
    const exito = page.getByRole('heading', { name: 'Enviamos tu solicitud' });
    await expect(exito).toBeVisible();
    // Tras el envío el foco no se pierde en <body>.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.tagName ?? 'BODY'))
      .not.toBe('BODY');

    // «Mis solicitudes» por el menú, con teclado, y estado visible.
    await cargar(page, '/adoptante');
    await tabHasta(page, page.getByRole('link', { name: 'Mis solicitudes' }).first());
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Mis solicitudes' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: NOMBRE_MASCOTA })).toContainText(
      'Pendiente',
    );

    // Detalle y diálogo de cancelación: atrapa el foco, Escape cierra y devuelve el foco.
    const ver = page.getByRole('link', {
      name: new RegExp(`Ver detalle de la solicitud para ${NOMBRE_MASCOTA}`),
    });
    await tabHasta(page, ver, 120);
    await page.keyboard.press('Enter');
    const cancelar = page.getByRole('button', { name: 'Cancelar solicitud' });
    await tabHasta(page, cancelar, 120);
    await page.keyboard.press('Enter');
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const dentro = await dialogo.evaluate((el) => el.contains(document.activeElement));
      expect(dentro, `Tab ${i + 1} sigue dentro del diálogo`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(cancelar).toBeFocused();
  });
});

test.describe('Pestañas con teclado', () => {
  test('las flechas mueven entre pestañas de la ficha de gestión', async ({ page }) => {
    await ingresar(page, CORREO_FUNDACION_DEMO, CLAVE_DEMO);
    const href = await primerEnlace(page, '/fundacion/mascotas', /^\/fundacion\/mascotas\/\d+/);
    await cargar(page, href);
    const datos = page.getByRole('tab', { name: 'Datos' });
    await tabHasta(page, datos);
    await conFocoVisible(datos);
    await expect(datos).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    const fotos = page.getByRole('tab', { name: 'Fotos' });
    await expect(fotos).toBeFocused();
    await expect(fotos).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Historial médico' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('Home');
    await expect(datos).toHaveAttribute('aria-selected', 'true');
    // El panel activo es alcanzable con Tab (foco gestionado en pestañas).
    await page.keyboard.press('Tab');
    const enPanel = await page.evaluate(
      () => document.activeElement?.closest('[role="tabpanel"]') !== null,
    );
    expect(enPanel).toBe(true);
  });
});
