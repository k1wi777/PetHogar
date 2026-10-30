'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSesion } from '@/shared/auth/SesionProvider';
import { Boton } from '@/shared/ui/Boton';
import { rutaIngresoParaAdoptar } from '../lib/solicitud';

const AVISO = 'Estamos terminando esta parte: pronto podrás enviar tu solicitud desde aquí.';

/** «Quiero adoptar» según la sesión: anónimo ⇒ ingresar y volver; adoptante ⇒ acción provisional; resto ⇒ nada. */
export function AccionAdoptar({ mascotaId }: { mascotaId: number }) {
  const { estado, usuario } = useSesion();
  const [avisar, setAvisar] = useState(false);

  // Espacio reservado mientras se restaura la sesión, para no mostrar un rol equivocado.
  if (estado === 'cargando') return <div aria-hidden="true" className="min-h-11" />;

  if (estado === 'autenticado' && usuario) {
    if (usuario.rol !== 'adoptante') return null;
    return (
      <div className="flex flex-col gap-2">
        <Boton onClick={() => setAvisar(true)}>Quiero adoptar</Boton>
        <p role="status" className="text-muted-foreground text-sm">
          {avisar ? AVISO : ''}
        </p>
      </div>
    );
  }

  return (
    <Boton comoHijo>
      <Link href={rutaIngresoParaAdoptar(mascotaId)}>Quiero adoptar</Link>
    </Boton>
  );
}
