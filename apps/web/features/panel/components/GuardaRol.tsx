'use client';

import { WifiOff } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { Rol } from '@/shared/api/tipos';
import { useSesion } from '@/shared/auth/SesionProvider';
import { RUTA_INGRESAR } from '@/shared/lib/acceso';
import { Boton } from '@/shared/ui/Boton';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { SinPermiso } from '@/shared/ui/PaginaMensaje';
import { Skeleton } from '@/shared/ui/Skeleton';

/**
 * Guarda de cliente de un panel: valida el rol REAL de `GET /auth/me` (el indicio del proxy nunca
 * es autoridad) y no renderiza el contenido si no corresponde (R15).
 */
export function GuardaRol({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { estado, usuario, motivoSinConexion, reintentar } = useSesion();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (estado === 'anonimo') {
      const consulta = typeof window === 'undefined' ? '' : window.location.search;
      router.replace(`${RUTA_INGRESAR}?siguiente=${encodeURIComponent(`${pathname}${consulta}`)}`);
    }
  }, [estado, pathname, router]);

  if (estado === 'cargando' || estado === 'anonimo') {
    return <Skeleton className="mx-auto my-16 h-40 max-w-3xl" etiqueta="Verificando tu sesión" />;
  }
  if (estado === 'sin-conexion') {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <EstadoVacio
          icono={WifiOff}
          titulo={
            motivoSinConexion === 'limite'
              ? 'Hay demasiados intentos en este momento'
              : 'No pudimos conectar con el servidor'
          }
          descripcion={
            motivoSinConexion === 'limite'
              ? 'Espera un minuto y vuelve a intentarlo. Tu sesión sigue guardada.'
              : 'Revisa tu conexión o inténtalo en unos minutos. Tu sesión sigue guardada.'
          }
          accion={<Boton onClick={reintentar}>Reintentar</Boton>}
        />
      </div>
    );
  }
  if (!usuario || usuario.rol !== rol) return <SinPermiso />;
  return <>{children}</>;
}
