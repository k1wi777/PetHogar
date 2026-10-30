'use client';

import Link from 'next/link';
import { useSesion } from '@/shared/auth/SesionProvider';
import { PANEL_POR_ROL } from '@/shared/lib/acceso';
import { Boton } from '@/shared/ui/Boton';
import { SaltarAlContenido } from '@/shared/ui/SaltarAlContenido';

const ENLACE = 'hover:bg-muted inline-flex min-h-11 items-center rounded-md px-3 font-medium';

export function CabeceraPublica() {
  const { estado, usuario } = useSesion();
  return (
    <>
      <SaltarAlContenido />
      <header className="bg-card border-border-suave border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2">
          <Link href="/" className="font-heading text-primary text-2xl font-extrabold">
            PetHogar
          </Link>
          <nav aria-label="Principal" className="ml-auto">
            <ul className="flex flex-wrap items-center justify-end gap-1">
              <li>
                <Link href="/adoptar" className={ENLACE}>
                  Adoptar
                </Link>
              </li>
              <li>
                <Link href="/adoptante/donar" className={ENLACE}>
                  Donar
                </Link>
              </li>
              <li>
                {estado === 'autenticado' && usuario ? (
                  <Boton comoHijo>
                    <Link href={PANEL_POR_ROL[usuario.rol]}>Mi panel</Link>
                  </Boton>
                ) : (
                  <Boton comoHijo variante="contorno">
                    <Link href="/ingresar">Ingresar</Link>
                  </Boton>
                )}
              </li>
              {!(estado === 'autenticado' && usuario) && (
                <>
                  <li>
                    <Link href="/registro" className={ENLACE}>
                      Registrarme
                    </Link>
                  </li>
                  <li>
                    <Link href="/registro-fundacion" className={ENLACE}>
                      Registrar fundación
                    </Link>
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
