import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_EMAIL } from '../../src/database/seeds/seed.demo';

/**
 * Descarga los cuatro PDF de la fundación demo (ficha de una mascota y reportes de solicitudes,
 * seguimientos y donaciones) a `muestras-pdf/` en la raíz del repositorio (ignorada por Git), para
 * revisar a mano acentos, tablas y totales. Se sobrescriben en cada ejecución.
 *
 * Requiere la API levantada y `seed:demo` ejecutado. Variables: `PORT` y `SEED_DEMO_PASSWORD` (se leen
 * de apps/api/.env si existe), `DEMO_API_URL` (por defecto `http://localhost:$PORT/api`) y `DEMO_PDF_DIR`.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..');

function leerEntorno(): void {
  const archivoEnv = join(__dirname, '..', '..', '.env');
  if (existsSync(archivoEnv)) process.loadEnvFile(archivoEnv);
}

async function pedir(url: string, cabeceras: Record<string, string> = {}): Promise<Response> {
  try {
    return await fetch(url, { headers: cabeceras });
  } catch {
    throw new Error(
      `No se pudo conectar con la API en ${url}. Levanta Docker Compose (docker compose up -d) y la API (pnpm dev), o indica DEMO_API_URL.`,
    );
  }
}

async function main(): Promise<void> {
  leerEntorno();
  const base = process.env.DEMO_API_URL ?? `http://localhost:${process.env.PORT ?? 3001}/api`;
  const contrasena = process.env.SEED_DEMO_PASSWORD;
  if (!contrasena)
    throw new Error('Falta SEED_DEMO_PASSWORD (la misma con la que ejecutaste seed:demo).');

  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, contrasena }),
  }).catch(() => {
    throw new Error(
      `No se pudo conectar con la API en ${base}. Levántala con pnpm dev o indica DEMO_API_URL.`,
    );
  });
  if (login.status !== 200) {
    throw new Error(
      `No se pudo iniciar sesión como ${DEMO_EMAIL} (HTTP ${login.status}). ¿Ejecutaste seed:demo con esa contraseña?`,
    );
  }
  const { accessToken } = (await login.json()) as { accessToken: string };
  const autorizacion = { Authorization: `Bearer ${accessToken}` };

  const catalogo = await pedir(`${base}/mascotas?limit=1`);
  const primera = ((await catalogo.json()) as { data?: { id: number }[] }).data?.[0];
  if (catalogo.status !== 200 || !primera) {
    throw new Error('El catálogo no tiene mascotas: ejecuta seed:demo.');
  }

  const descargas: { archivo: string; ruta: string; auth: boolean }[] = [
    { archivo: `ficha-${primera.id}.pdf`, ruta: `/mascotas/${primera.id}/ficha.pdf`, auth: false },
    { archivo: 'solicitudes.pdf', ruta: '/fundacion/reportes/solicitudes.pdf', auth: true },
    { archivo: 'seguimientos.pdf', ruta: '/fundacion/reportes/seguimientos.pdf', auth: true },
    { archivo: 'donaciones.pdf', ruta: '/fundacion/reportes/donaciones.pdf', auth: true },
  ];
  const destino = process.env.DEMO_PDF_DIR ?? join(RAIZ, 'muestras-pdf');
  mkdirSync(destino, { recursive: true });

  for (const d of descargas) {
    const res = await pedir(`${base}${d.ruta}`, d.auth ? autorizacion : {});
    const datos = Buffer.from(await res.arrayBuffer());
    if (res.status !== 200 || datos.subarray(0, 4).toString('latin1') !== '%PDF') {
      throw new Error(`${d.ruta} no devolvió un PDF válido (HTTP ${res.status}).`);
    }
    const archivo = join(destino, d.archivo);
    writeFileSync(archivo, datos);
    process.stdout.write(`${archivo} (${datos.length} bytes)\n`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
