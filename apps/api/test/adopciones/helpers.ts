import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import type request from 'supertest';
import { bearer, type Entorno } from '../auth/helpers';
import { CUERPO_MASCOTA, type FundacionPrueba } from '../mascotas/helpers';

export { fundacionAprobada, jpeg, PDF, png } from '../mascotas/helpers';
export type { FundacionPrueba } from '../mascotas/helpers';

export interface AdoptantePrueba {
  email: string;
  access: string;
  /** `adoptante.id` (no el del usuario): es el que viaja en los eventos. */
  id: number;
}

export const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>');
export const EJECUTABLE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

/** Claves de almacenamiento y datos que ninguna respuesta puede traer. */
const CLAVE_PROHIBIDA =
  /^(formularioUrl|formulario_url|actaUrl|acta_url|clave|contrasena|password|numeroDocumento|tipoDocumento|fechaNacimiento|direccion|nit|documentoUrl|tokenVerificacionHash|usuarioId)$/i;
const VALOR_STORAGE = /(^|[\s"'/])(publico|privado)\/[a-z-]+\//;

export function violacionesDeClaves(
  valor: unknown,
  ruta = '$',
  prohibidas = CLAVE_PROHIBIDA,
): string[] {
  if (Array.isArray(valor)) {
    return valor.flatMap((v, i) => violacionesDeClaves(v, `${ruta}[${i}]`, prohibidas));
  }
  if (typeof valor === 'string') return VALOR_STORAGE.test(valor) ? [`${ruta}=${valor}`] : [];
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => [
      ...(prohibidas.test(k) ? [`${ruta}.${k}`] : []),
      ...violacionesDeClaves(v, `${ruta}.${k}`, prohibidas),
    ]);
  }
  return [];
}

/** Para respuestas dirigidas a un adoptante: además, nada del contacto de la fundación. */
export const CLAVE_PROHIBIDA_ADOPTANTE = new RegExp(
  `${CLAVE_PROHIBIDA.source.slice(0, -2)}|email|telefono)$`,
  'i',
);

export const con = (r: request.Test, access: string): request.Test =>
  r.set('Authorization', bearer(access));

/** Archivos de `uploads/privado/solicitudes` (formularios y actas). */
export const archivosPrivados = (uploads: string): string[] => {
  const carpeta = path.join(uploads, 'privado', 'solicitudes');
  return existsSync(carpeta) ? readdirSync(carpeta).sort() : [];
};

/** Día actual en Bogotá más `dias` días (YYYY-MM-DD). */
export function fechaBogota(dias = 0): string {
  const base = new Date(Date.now() + dias * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base);
}

export async function adoptanteConSesion(e: Entorno): Promise<AdoptantePrueba> {
  const email = await e.adoptanteVerificado();
  const [{ id }]: { id: number }[] = await e.ds.query(
    `SELECT a.id FROM adoptante a JOIN usuario u ON u.id = a.usuario_id WHERE u.email = $1`,
    [email],
  );
  return { email, access: (await e.sesion(email)).access, id };
}

export async function mascotaPublicada(
  e: Entorno,
  f: FundacionPrueba,
  razaId: number,
  nombre = 'Luna',
): Promise<number> {
  const res = await con(e.post('/mascotas'), f.access)
    .send({ ...CUERPO_MASCOTA, razaId, nombre })
    .expect(201);
  return res.body.id as number;
}
