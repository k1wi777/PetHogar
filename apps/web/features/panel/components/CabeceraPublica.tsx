'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSesion } from '@/shared/auth/SesionProvider';
import { PANEL_POR_ROL } from '@/shared/lib/acceso';
import { cn } from '@/shared/lib/utils';
import { Boton } from '@/shared/ui/Boton';
import { Marca } from '@/shared/ui/Marca';
import { SaltarAlContenido } from '@/shared/ui/SaltarAlContenido';

const ENLACE =
  'inline-flex min-h-11 items-center rounded-full px-1.5 text-sm font-semibold transition-colors sm:px-3 sm:text-base';
const ACTUAL = 'bg-secondary text-secondary-foreground font-bold';
const BOTON = 'px-2.5 text-sm sm:px-5 sm:text-base';

/** Una sección incluye sus subrutas; las fichas de mascota pertenecen a «Adoptar». */
const SECCIONES: Readonly<Record<string, readonly string[]>> = {
  '/adoptar': ['/adoptar', '/mascotas'],
};

export function CabeceraPublica() {
  const { estado, usuario } = useSesion();
  const pathname = usePathname();
  const autenticado = estado === 'autenticado' && usuario;

  function actual(href: string): 'page' | undefined {
    const rutas = SECCIONES[href] ?? [href];
    return rutas.some((r) => pathname === r || pathname?.startsWith(`${r}/`)) ? 'page' : undefined;
  }

  function enlace(href: string, texto: string) {
    return (
      <Link
        href={href}
        aria-current={actual(href)}
        className={cn(ENLACE, actual(href) ? ACTUAL : 'hover:bg-muted')}
      >
        {texto}
      </Link>
    );
  }

  return (
    <>
      <SaltarAlContenido />
      <header className="bg-card border-border-suave border-b">
        {/* En móvil la marca flota: los enlaces la rodean y caben en dos filas sin cambiar su orden. */}
        <div className="mx-auto flow-root max-w-6xl px-3 py-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:px-4 sm:py-3">
          <Marca className="float-left mr-1 sm:mr-0" />
          <nav aria-label="Principal" className="sm:ml-auto">
            <ul className="text-right sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-1">
              <li className="inline-block">{enlace('/adoptar', 'Adoptar')}</li>
              <li className="inline-block">{enlace('/donar', 'Donar')}</li>
              <li className="inline-block">
                {autenticado ? (
                  <Boton comoHijo className={BOTON}>
                    <Link href={PANEL_POR_ROL[usuario.rol]}>Mi panel</Link>
                  </Boton>
                ) : (
                  <Boton
                    comoHijo
                    variante="contorno"
                    className={cn(BOTON, actual('/ingresar') && `border-primary ${ACTUAL}`)}
                  >
                    <Link href="/ingresar" aria-current={actual('/ingresar')}>
                      Ingresar
                    </Link>
                  </Boton>
                )}
              </li>
              {!autenticado && (
                <>
                  <li className="inline-block">{enlace('/registro', 'Registrarme')}</li>
                  <li className="inline-block">
                    {enlace('/registro-fundacion', 'Registrar fundación')}
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}
