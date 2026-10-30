import { NextResponse, type NextRequest } from 'next/server';
import { NOMBRE_INDICIO } from '@/shared/auth/indicio';
import { resolverAcceso } from '@/shared/lib/acceso';

/**
 * `proxy.ts` es el nombre vigente de `middleware.ts` en Next 16. Redirige antes de renderizar
 * según el indicio de sesión `ph_rol`; la autoridad real es la API (ver design.md §4).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const decision = resolverAcceso(pathname, request.cookies.get(NOMBRE_INDICIO)?.value, search);
  if (decision.tipo === 'redirigir') {
    return NextResponse.redirect(new URL(decision.destino, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/adoptante/:path*',
    '/fundacion/:path*',
    '/administrador/:path*',
    '/ingresar',
    '/registro',
    '/registro-fundacion',
    '/recuperar',
  ],
};
