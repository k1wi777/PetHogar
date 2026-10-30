import type { Metadata } from 'next';
import Link from 'next/link';
import { AvisoSinPagos } from '@/features/donaciones/components/AvisoSinPagos';
import { Boton } from '@/shared/ui/Boton';

export const metadata: Metadata = {
  title: 'Cómo donar | PetHogar',
  description: 'Registra tu aporte a una fundación de mascotas. PetHogar no procesa pagos.',
};

const PASOS = [
  'Abre la ficha de una mascota en adopción de la fundación a la que quieres ayudar.',
  'Pulsa «Donar a esta fundación». Si aún no iniciaste sesión, te pediremos ingresar.',
  'Registra tu aporte (dinero o especie) y, si lo tienes, adjunta el comprobante.',
];

/** Página pública y estática: explica cómo donar sin exigir sesión hasta el momento de donar (R20a). */
export default function Pagina() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl">Cómo donar</h1>
      <p className="text-muted-foreground">
        Tu ayuda llega directamente a las fundaciones. En PetHogar dejas constancia de lo que
        aportaste en tres pasos.
      </p>
      <AvisoSinPagos />
      <ol className="flex list-decimal flex-col gap-3 pl-6 text-lg">
        {PASOS.map((paso) => (
          <li key={paso}>{paso}</li>
        ))}
      </ol>
      <Boton comoHijo className="self-start">
        <Link href="/adoptar">Ver mascotas y fundaciones</Link>
      </Boton>
    </div>
  );
}
