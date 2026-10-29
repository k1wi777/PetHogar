import type { CookieOptions, Response } from 'express';

export const NOMBRE_COOKIE_REFRESH = 'refresh_token';
/** La cookie solo viaja a los endpoints de auth (también tras un rewrite same-origin que conserve `/api`). */
export const RUTA_COOKIE_REFRESH = '/api/auth';

/** Lee una cookie de la cabecera `Cookie` (sin `cookie-parser`). El valor del refresh es base64url: no requiere decodificación. */
export function leerCookie(cabecera: string | undefined, nombre: string): string | undefined {
  for (const par of (cabecera ?? '').split(';')) {
    const separador = par.indexOf('=');
    if (separador > 0 && par.slice(0, separador).trim() === nombre) {
      return par.slice(separador + 1).trim() || undefined;
    }
  }
  return undefined;
}

function opciones(segura: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: segura, path: RUTA_COOKIE_REFRESH };
}

export function escribirCookieRefresh(
  res: Response,
  token: string,
  segura: boolean,
  vigenciaMs: number,
): void {
  res.cookie(NOMBRE_COOKIE_REFRESH, token, { ...opciones(segura), maxAge: vigenciaMs });
}

export function borrarCookieRefresh(res: Response, segura: boolean): void {
  res.clearCookie(NOMBRE_COOKIE_REFRESH, opciones(segura));
}
