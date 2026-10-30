'use client';

import Link from 'next/link';
import { useSesion } from '@/shared/auth/SesionProvider';
import { Boton } from '@/shared/ui/Boton';
import { rutaIngresoParaAdoptar, rutaSolicitud } from '../lib/solicitud';

/** «Quiero adoptar» según la sesión: anónimo ⇒ ingresar y volver; adoptante ⇒ formulario de solicitud; resto ⇒ nada. */
export function AccionAdoptar({ mascotaId }: { mascotaId: number }) {
  const { estado, usuario } = useSesion();

  // Espacio reservado mientras se restaura la sesión, para no mostrar un rol equivocado.
  if (estado === 'cargando') return <div aria-hidden="true" className="min-h-11" />;

  if (estado === 'autenticado' && usuario) {
    if (usuario.rol !== 'adoptante') return null;
    return (
      <Boton comoHijo>
        <Link href={rutaSolicitud(mascotaId)}>Quiero adoptar</Link>
      </Boton>
    );
  }

  return (
    <Boton comoHijo>
      <Link href={rutaIngresoParaAdoptar(mascotaId)}>Quiero adoptar</Link>
    </Boton>
  );
}
