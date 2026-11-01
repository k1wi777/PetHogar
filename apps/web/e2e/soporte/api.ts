import { API_URL, CLAVE_DEMO, CORREO_FUNDACION_DEMO, MAILPIT_URL } from './entorno';

/** PNG de 1x1 píxel: firma binaria real, que es lo que valida el backend. */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export const CLAVE_ADOPTANTE = 'ClaveSegura1';

const dormir = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

export class ErrorHttp extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/**
 * Login y registro tienen límites por minuto y por IP (3 a 5). Ante un 429 se espera a que se
 * renueve la ventana y se reintenta, de modo que el resultado no depende del punto del minuto.
 */
export async function conLimite<T>(accion: () => Promise<T>, intentos = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await accion();
    } catch (error) {
      if (!(error instanceof ErrorHttp && error.estado === 429) || i >= intentos) throw error;
      await dormir(61_000);
    }
  }
}

async function pedir<T>(ruta: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...resto } = init;
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...resto,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(typeof resto.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
  });
  if (!respuesta.ok) throw new ErrorHttp(respuesta.status, `${ruta}: ${await respuesta.text()}`);
  return respuesta.status === 204 ? (undefined as T) : ((await respuesta.json()) as T);
}

export function iniciarSesionApi(email: string, contrasena: string): Promise<string> {
  return conLimite(async () => {
    const { accessToken } = await pedir<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, contrasena }),
    });
    return accessToken;
  });
}

interface MensajeMailpit {
  ID: string;
  Subject: string;
  Created: string;
}

/** Texto del correo más reciente para `para` con asunto `asunto` posterior a `desde`. */
export async function esperarCorreo(
  para: string,
  asunto: RegExp,
  desde: number,
  esperaMs = 20_000,
): Promise<string> {
  const limite = Date.now() + esperaMs;
  while (Date.now() < limite) {
    const busqueda = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${para}`)}`,
    );
    const { messages } = (await busqueda.json()) as { messages: MensajeMailpit[] };
    const buscado = messages.find(
      (m) => asunto.test(m.Subject) && Date.parse(m.Created) >= desde - 2000,
    );
    if (buscado) {
      const detalle = await fetch(`${MAILPIT_URL}/api/v1/message/${buscado.ID}`);
      const { Text } = (await detalle.json()) as { Text: string };
      await fetch(`${MAILPIT_URL}/api/v1/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IDs: [buscado.ID] }),
      });
      return Text;
    }
    await dormir(300);
  }
  throw new Error(`No llegó a ${para} un correo con asunto ${asunto} en ${esperaMs} ms`);
}

export interface AdoptanteE2E {
  email: string;
  clave: string;
  nombre: string;
}

/** Adoptante nuevo y verificado por correo, con datos únicos por ejecución (R15). */
export async function crearAdoptanteVerificado(sufijo: string): Promise<AdoptanteE2E> {
  const email = `e2e-adoptante-${sufijo}@pethogar.test`;
  const desde = Date.now();
  await conLimite(() =>
    pedir('/auth/register/adoptante', {
      method: 'POST',
      body: JSON.stringify({
        primerNombre: 'Elena',
        primerApellido: `Prueba${sufijo.slice(-4)}`,
        tipoDocumento: 'CC',
        numeroDocumento: `E${sufijo}${Math.floor(Math.random() * 1e6)}`.slice(0, 20),
        fechaNacimiento: '1990-05-10',
        telefono: '3001234567',
        email,
        direccion: 'Calle 1 # 2-3',
        ciudad: 'Montería',
        contrasena: CLAVE_ADOPTANTE,
        aceptaPoliticaDatos: true,
      }),
    }),
  );
  const correo = await esperarCorreo(email, /Verifica tu correo/, desde);
  const token = /\/verificar-correo\?token=([^\s"<>&]+)/.exec(correo)?.[1];
  if (!token) throw new Error('El correo no trae el enlace de verificación');
  await conLimite(() =>
    pedir(`/auth/verify-email?token=${encodeURIComponent(decodeURIComponent(token))}`),
  );
  return { email, clave: CLAVE_ADOPTANTE, nombre: 'Elena' };
}

/**
 * La fundación demo publica una mascota nueva (por API): no consume las del seed. El catálogo se
 * cachea 60 s por URL en el servidor de Next, así que cada spec usa una edad distinta y filtra por
 * ella para no leer una página cacheada antes de que existiera la mascota.
 */
export async function publicarMascota(nombre: string, edadMeses = 12): Promise<number> {
  const token = await iniciarSesionApi(CORREO_FUNDACION_DEMO, CLAVE_DEMO);
  const especies = await pedir<Array<{ id: number }>>('/especies');
  const razas = await pedir<Array<{ id: number }>>(`/especies/${especies[0]!.id}/razas`);
  const mascota = await pedir<{ id: number }>('/mascotas', {
    method: 'POST',
    token,
    body: JSON.stringify({
      nombre,
      razaId: razas[0]!.id,
      sexo: 'macho',
      edadMeses,
      tamano: 'mediano',
      estadoSalud: 'Sano',
    }),
  });
  return mascota.id;
}

/** Da de baja la mascota de la ejecución para no dejar disponibles datos de prueba. */
export async function darDeBaja(mascotaId: number): Promise<void> {
  const token = await iniciarSesionApi(CORREO_FUNDACION_DEMO, CLAVE_DEMO);
  await pedir(`/mascotas/${mascotaId}/baja`, { method: 'PATCH', token }).catch(() => undefined);
}

/** «Hoy» es el día de Bogotá, como en la API. */
export function hoyBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}
