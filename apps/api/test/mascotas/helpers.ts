import { readdirSync } from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import type request from 'supertest';
import { ADMIN, bearer, type Entorno } from '../auth/helpers';

export interface FundacionPrueba {
  id: number;
  email: string;
  access: string;
}

const color = { r: 40, g: 120, b: 200 };

/** Imágenes reales y diminutas (2×2 o del tamaño pedido) generadas en memoria. */
export const jpeg = (ancho = 2, alto = 2): Promise<Buffer> =>
  sharp({ create: { width: ancho, height: alto, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
export const png = (ancho = 2, alto = 2): Promise<Buffer> =>
  sharp({
    create: { width: ancho, height: alto, channels: 4, background: { ...color, alpha: 0.5 } },
  })
    .png()
    .toBuffer();

export const PDF = Buffer.from('%PDF-1.7\nno-es-una-imagen\n%%EOF');

/**
 * Registra una fundación y la deja aprobada con la ciudad indicada. La primera se aprueba por la
 * API de administración (flujo real); `via: 'sql'` acelera las demás.
 */
export async function fundacionAprobada(
  e: Entorno,
  ciudad: string,
  via: 'api' | 'sql' = 'sql',
  adminAccess?: string,
): Promise<FundacionPrueba> {
  const email = e.nuevoCorreo();
  const nit = `95${e.sufijo}${Math.floor(Math.random() * 1000)}`.slice(0, 20);
  await e.registrarFundacion(email, nit, `Refugio ${ciudad}`).expect(201);
  await e.ds.query('UPDATE usuario SET email_verificado = true WHERE email = $1', [email]);
  await e.ds.query('UPDATE fundacion SET ciudad = $1 WHERE nit = $2', [ciudad, nit]);
  const [{ id }]: { id: number }[] = await e.ds.query('SELECT id FROM fundacion WHERE nit = $1', [
    nit,
  ]);
  if (via === 'api') {
    await e
      .patch(`/admin/fundaciones/${id}/validacion`)
      .set(
        'Authorization',
        bearer(adminAccess ?? (await e.sesion(ADMIN.email, ADMIN.clave)).access),
      )
      .send({ decision: 'aprobada' })
      .expect(200);
  } else {
    await e.ds.query(
      `UPDATE fundacion SET estado_validacion = 'aprobada', fecha_validacion = now() WHERE id = $1`,
      [id],
    );
  }
  return { id, email, access: (await e.sesion(email)).access };
}

/** Archivos de `uploads/publico/mascotas` (los únicos que crea esta Feature). */
export const archivosDeMascotas = (uploads: string): string[] =>
  readdirSync(path.join(uploads, 'publico', 'mascotas')).sort();

export const CUERPO_MASCOTA = {
  nombre: 'Luna',
  razaId: 1,
  sexo: 'hembra',
  edadMeses: 12,
  tamano: 'mediano',
  estadoSalud: 'Sana y desparasitada',
  color: 'Café',
  esterilizado: true,
  vacunado: true,
  descripcion: 'Cariñosa',
};

export const con = (r: request.Test, access: string): request.Test =>
  r.set('Authorization', bearer(access));

// Barrido de claves y datos privados en las respuestas reales (R23).
const CLAVE_PROHIBIDA =
  /^(nit|documento|documentoUrl|documento_url|email|correo|contrasena|password|telefono|direccion|logo|usuarioId|clave)$/i;
const VALOR_STORAGE = /(^|[\s"'])(publico|privado)\/[a-z-]+\//;

export function violaciones(valor: unknown, ruta = '$'): string[] {
  if (Array.isArray(valor)) return valor.flatMap((v, i) => violaciones(v, `${ruta}[${i}]`));
  if (typeof valor === 'string') return VALOR_STORAGE.test(valor) ? [`${ruta}=${valor}`] : [];
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => [
      ...(CLAVE_PROHIBIDA.test(k) ? [`${ruta}.${k}`] : []),
      ...violaciones(v, `${ruta}.${k}`),
    ]);
  }
  return [];
}
