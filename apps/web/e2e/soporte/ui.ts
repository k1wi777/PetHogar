import { expect, type Page } from '@playwright/test';

const LIMITE = /demasiados intentos/i;

/**
 * Ingresa por el formulario real y espera a salir de /ingresar. Si la API responde con su límite
 * de logins por minuto (5 por IP) espera a que se renueve la ventana y reintenta.
 */
export async function ingresar(
  page: Page,
  email: string,
  clave: string,
  siguiente?: string,
): Promise<void> {
  const destino = siguiente ? `/ingresar?siguiente=${encodeURIComponent(siguiente)}` : '/ingresar';
  for (let intento = 1; ; intento++) {
    await page.goto(destino);
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: false }).first().fill(clave);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    const limite = page.getByRole('alert').filter({ hasText: LIMITE });
    const salio = page.waitForURL((url) => !url.pathname.startsWith('/ingresar'), {
      timeout: 15_000,
    });
    const alcanzado = limite.waitFor({ timeout: 15_000 });
    const resultado = await Promise.race([
      salio.then(() => 'ok' as const),
      alcanzado.then(() => 'limite' as const),
    ]).catch(() => 'nada' as const);
    // Evita rechazos sin atender de la promesa que no ganó la carrera.
    salio.catch(() => undefined);
    alcanzado.catch(() => undefined);
    if (resultado === 'ok') {
      await esperarSesion(page);
      return;
    }
    if (resultado === 'limite' && intento < 3) {
      await page.waitForTimeout(61_000);
      continue;
    }
    await expect(page).not.toHaveURL(/\/ingresar/);
    return;
  }
}

export async function primerEnlace(page: Page, desde: string, patron: RegExp): Promise<string> {
  await cargar(page, desde);
  const enlaces = page.locator('a[href]');
  await expect
    .poll(
      async () =>
        (await enlaces.evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))).filter(
          (h) => patron.test(h),
        ).length,
      { message: `enlace ${patron} en ${desde}` },
    )
    .toBeGreaterThan(0);
  const hrefs = await enlaces.evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
  return hrefs.find((h) => patron.test(h))!;
}

/**
 * Carga una pantalla. La API limita a 100 peticiones por minuto y por IP: si la sesión no se
 * pudo restaurar por ese límite se espera a la siguiente ventana y se reintenta una vez.
 */
export async function cargar(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta);
  if (await hayIndicioDeSesion(page)) await esperarSesion(page);
  const limite = page.getByText(/demasiados intentos/i);
  if (await limite.isVisible().catch(() => false)) {
    await page.waitForTimeout(61_000);
    await page.goto(ruta);
  }
}

/**
 * Espera a que la sesión esté restaurada (el front la renueva con `POST /auth/refresh` al cargar).
 * Navegar a otro documento con ese refresh en vuelo aborta la respuesta que rota la cookie y la
 * API lo interpreta como reutilización y revoca las sesiones: por eso toda carga completa de un
 * usuario autenticado termina aquí antes de seguir. Si aparece /ingresar sin esperarlo, falla ya.
 */
export async function esperarSesion(page: Page): Promise<void> {
  const restaurada = page
    .getByRole('link', { name: 'Mi panel' })
    .or(page.getByRole('button', { name: /Cerrar sesión/ }));
  const limite = page.getByText(/demasiados intentos/i);
  // La API limita a 100 peticiones por minuto y por IP: si la restauración chocó con ese límite
  // el front lo avisa («Hay demasiados intentos»); se espera la siguiente ventana y se recarga.
  for (let intento = 1; ; intento++) {
    const estado = await expect
      .poll(
        async () => {
          if (new URL(page.url()).pathname.startsWith('/ingresar')) {
            throw new Error(`Se perdió la sesión: la página terminó en ${page.url()}`);
          }
          if ((await restaurada.count()) > 0) return 'ok';
          return (await limite.count()) > 0 ? 'limite' : 'esperando';
        },
        { message: 'la sesión no se restauró', timeout: 30_000, intervals: [250, 500, 1000] },
      )
      .not.toBe('esperando')
      .then(() => 'listo')
      .catch((error: Error) => {
        if (error.message.includes('Se perdió la sesión')) throw error;
        return 'agotado';
      });
    if (estado === 'agotado') throw new Error('la sesión no se restauró en 30 s');
    if ((await restaurada.count()) > 0) break;
    if (intento >= 3) throw new Error('la API siguió limitando las peticiones tras 3 esperas');
    await page.waitForTimeout(61_000);
    await page.reload();
  }
  await page.waitForLoadState('networkidle');
}

/** El indicio `ph_rol` lo fija el front al ingresar: sin él la visita es anónima. */
async function hayIndicioDeSesion(page: Page): Promise<boolean> {
  return (await page.context().cookies()).some((c) => c.name === 'ph_rol');
}
