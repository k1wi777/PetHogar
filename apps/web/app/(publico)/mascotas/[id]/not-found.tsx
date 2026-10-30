import Link from 'next/link';
import { Boton } from '@/shared/ui/Boton';
import { PaginaMensaje } from '@/shared/ui/PaginaMensaje';

export default function MascotaNoEncontrada() {
  return (
    <PaginaMensaje
      codigo="404"
      titulo="No encontramos a esta mascota"
      accion={
        <Boton comoHijo>
          <Link href="/adoptar">Ver mascotas disponibles</Link>
        </Boton>
      }
    >
      Puede que ya haya sido adoptada o que el enlace no sea correcto. Mira a las demás mascotas que
      esperan un hogar.
    </PaginaMensaje>
  );
}
