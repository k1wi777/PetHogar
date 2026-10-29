import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import type { Entorno } from '../auth/helpers';
import { esperarMensajes, mensajesPara } from '../auth/mailpit';

export { esperarMensajes, mensajesPara };
export {
  adoptanteConSesion,
  adopcionActiva,
  ENVIAR_FORMULARIO,
  relojSimulado,
  tareas,
} from '../seguimientos/helpers';
export {
  type AdoptantePrueba,
  con,
  EJECUTABLE,
  fechaBogota,
  fundacionAprobada,
  type FundacionPrueba,
  jpeg,
  mascotaPublicada,
  PDF,
  png,
  SVG,
  violacionesDeClaves,
} from '../adopciones/helpers';

/**
 * Los listeners son asíncronos: se espera por sondeo, con tiempo máximo, nunca con un `sleep`
 * fijo. Devuelve el primer valor distinto de `null`/`undefined`/`false`.
 */
export async function esperarHasta<T>(
  consulta: () => Promise<T | null | undefined | false>,
  descripcion: string,
  tiempoMs = 10_000,
): Promise<T> {
  const limite = Date.now() + tiempoMs;
  for (;;) {
    const valor = await consulta();
    if (valor) return valor;
    if (Date.now() > limite) {
      throw new Error(`Tiempo agotado esperando: ${descripcion}`);
    }
    await new Promise((resolver) => setTimeout(resolver, 100));
  }
}

export interface FilaNotificacion {
  id: number;
  usuario_id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  entidad: string | null;
  entidad_id: number | null;
  clave: string | null;
}

export const notificacionesDe = (e: Entorno, usuarioId: number): Promise<FilaNotificacion[]> =>
  e.ds.query('SELECT * FROM notificacion WHERE usuario_id = $1 ORDER BY id', [usuarioId]);

export const notificacionesConClave = (
  e: Entorno,
  usuarioId: number,
  clave: string,
): Promise<FilaNotificacion[]> =>
  e.ds.query('SELECT * FROM notificacion WHERE usuario_id = $1 AND clave = $2 ORDER BY id', [
    usuarioId,
    clave,
  ]);

/** Espera (sondeo) la notificación con esa clave y la devuelve. */
export const esperarNotificacion = (
  e: Entorno,
  usuarioId: number,
  clave: string,
  tiempoMs?: number,
): Promise<FilaNotificacion> =>
  esperarHasta(
    async () => (await notificacionesConClave(e, usuarioId, clave))[0],
    `notificación ${clave} del usuario ${usuarioId}`,
    tiempoMs,
  );

export async function usuarioIdDe(e: Entorno, email: string): Promise<number> {
  const [{ id }]: { id: number }[] = await e.ds.query('SELECT id FROM usuario WHERE email = $1', [
    email,
  ]);
  return id;
}

export async function usuarioIdDeFundacion(e: Entorno, fundacionId: number): Promise<number> {
  const [{ usuario_id }]: { usuario_id: number }[] = await e.ds.query(
    'SELECT usuario_id FROM fundacion WHERE id = $1',
    [fundacionId],
  );
  return usuario_id;
}

export const contar = async (e: Entorno, sql: string, params: unknown[] = []): Promise<number> =>
  Number(((await e.ds.query(sql, params)) as { n: string }[])[0].n);

/** Archivos de `uploads/privado/donaciones` (comprobantes). */
export const archivosDonaciones = (uploads: string): string[] => {
  const carpeta = path.join(uploads, 'privado', 'donaciones');
  return existsSync(carpeta) ? readdirSync(carpeta).sort() : [];
};

export const enDisco = (uploads: string, clave: string): boolean =>
  existsSync(path.join(uploads, clave));

/** Monto en céntimos exactos (sin `Number`): `"1500.50"` → `150050n`. */
export function centimos(monto: string): bigint {
  const [enteros, decimales = ''] = monto.split('.');
  return BigInt(enteros) * 100n + BigInt(decimales.padEnd(2, '0'));
}

/** Claves y datos que ninguna respuesta de V14 puede traer. */
export const PROHIBIDAS_V14 =
  /^(comprobanteUrl|comprobante_url|clave|contrasena|password|numeroDocumento|tipoDocumento|fechaNacimiento|direccion|nit|documentoUrl|usuarioId|usuario_id|email|telefono|correo)$/i;

/** Correos recibidos por `email` con ese asunto exacto (la bandeja de Mailpit es compartida). */
export const correosConAsunto = async (email: string, asunto: string) =>
  (await mensajesPara(email)).filter((m) => m.asunto === asunto);

/** Espera (sondeo) a que lleguen al menos `cantidad` correos con ese asunto. */
export const esperarCorreos = (email: string, asunto: string, cantidad = 1, tiempoMs?: number) =>
  esperarHasta(
    async () => {
      const lista = await correosConAsunto(email, asunto);
      return lista.length >= cantidad ? lista : null;
    },
    `${cantidad} correo(s) «${asunto}» para ${email}`,
    tiempoMs,
  );
