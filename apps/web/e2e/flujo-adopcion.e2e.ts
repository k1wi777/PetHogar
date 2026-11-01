import { expect, test } from '@playwright/test';
import {
  PNG_1X1,
  crearAdoptanteVerificado,
  darDeBaja,
  hoyBogota,
  publicarMascota,
  type AdoptanteE2E,
} from './soporte/api';
import { CLAVE_DEMO, CORREO_FUNDACION_DEMO } from './soporte/entorno';
import { cargar, esperarSesion, ingresar } from './soporte/ui';

// Datos propios por ejecución (R15): adoptante y mascota nuevos; el seed no se consume.
const EJECUCION = Date.now().toString(36);
const EDAD_MESES = 12;
const NOMBRE_MASCOTA = `Flujo${EJECUCION}`.slice(0, 40);

test.describe.configure({ mode: 'serial' });

test.describe('Flujo principal de adopción', () => {
  let adoptante: AdoptanteE2E;
  let mascotaId: number;

  test.beforeAll(async () => {
    adoptante = await crearAdoptanteVerificado(EJECUCION);
    mascotaId = await publicarMascota(NOMBRE_MASCOTA, EDAD_MESES);
  });

  test.afterAll(async () => {
    if (mascotaId) await darDeBaja(mascotaId);
  });

  test('el adoptante busca la mascota, solicita, la fundación aprueba y el adoptante ve la adopción', async ({
    browser,
    page,
  }) => {
    // 1. El adoptante ingresa, busca en el catálogo y abre la ficha.
    await ingresar(page, adoptante.email, adoptante.clave);
    await expect(page).toHaveURL(/\/adoptante/);
    await cargar(page, `/adoptar?edadMin=${EDAD_MESES}&edadMax=${EDAD_MESES}`);
    await page.getByRole('button', { name: 'Buscar' }).click();
    await esperarSesion(page);
    const enlace = page.getByRole('link', { name: new RegExp(NOMBRE_MASCOTA) }).first();
    await expect(enlace).toBeVisible();
    await enlace.click();
    await expect(page.getByRole('heading', { level: 1, name: NOMBRE_MASCOTA })).toBeVisible();

    // 2. Solicita con formulario y documento; revisa el resumen y confirma.
    await page.getByRole('link', { name: 'Quiero adoptar' }).click();
    await page.getByLabel('¿Por qué quieres adoptar?').fill('Tengo patio y mucho tiempo libre');
    await page.getByRole('radio', { name: 'Casa' }).check();
    await page.getByRole('radio', { name: 'No', exact: true }).check();
    await page
      .getByLabel('Formulario de adopción firmado')
      .setInputFiles({ name: 'formulario.png', mimeType: 'image/png', buffer: PNG_1X1 });
    await page.getByRole('button', { name: 'Revisar mi solicitud' }).click();
    await page.getByRole('button', { name: 'Confirmar y enviar' }).click();
    await expect(page.getByRole('heading', { name: 'Enviamos tu solicitud' })).toBeVisible();

    // 3. «Mis solicitudes» la muestra pendiente.
    await cargar(page, '/adoptante/solicitudes');
    const solicitud = page.getByRole('listitem').filter({ hasText: NOMBRE_MASCOTA });
    await expect(solicitud).toContainText('Pendiente');

    // 4. La fundación demo (otra sesión) revisa y aprueba con fecha y diálogo.
    const contextoFundacion = await browser.newContext();
    const fundacion = await contextoFundacion.newPage();
    await ingresar(fundacion, CORREO_FUNDACION_DEMO, CLAVE_DEMO);
    await cargar(fundacion, '/fundacion/solicitudes?estado=pendiente');
    await fundacion
      .getByRole('link', { name: new RegExp(`Revisar la solicitud de .* para ${NOMBRE_MASCOTA}`) })
      .click();
    await fundacion.getByRole('radio', { name: 'Aprobar la solicitud' }).check();
    await fundacion.getByLabel('Fecha de entrega').fill(hoyBogota());
    await fundacion.getByRole('button', { name: 'Continuar' }).click();
    const dialogo = fundacion.getByRole('dialog');
    await dialogo.getByRole('button', { name: 'Sí, aprobar y crear la adopción' }).click();
    await expect(dialogo).toBeHidden();
    await expect(fundacion.getByText('Aprobada').first()).toBeVisible();
    await contextoFundacion.close();

    // 5. El adoptante ve la adopción y la notificación de la decisión.
    await cargar(page, '/adoptante/adopciones');
    await expect(
      page.getByRole('listitem').filter({ hasText: NOMBRE_MASCOTA }).first(),
    ).toBeVisible();
    await cargar(page, '/adoptante/solicitudes');
    await expect(page.getByRole('listitem').filter({ hasText: NOMBRE_MASCOTA })).toContainText(
      'Aprobada',
    );
    await cargar(page, '/adoptante/notificaciones');
    await expect(page.getByText(new RegExp(NOMBRE_MASCOTA)).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
