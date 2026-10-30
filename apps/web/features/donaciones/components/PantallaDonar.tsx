'use client';

import { HeartHandshake } from 'lucide-react';
import Link from 'next/link';
import { Boton } from '@/shared/ui/Boton';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { useFundacionDestino } from '../hooks/useDonaciones';
import { AvisoSinPagos } from './AvisoSinPagos';
import { FormularioDonacion } from './FormularioDonacion';

/** Sin fundación válida en la URL no hay formulario: se explica cómo elegirla (R17a). */
export function PantallaDonar() {
  const fundacion = useFundacionDestino();
  if (!fundacion) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <h1 className="text-3xl">Donar</h1>
        <AvisoSinPagos />
        <EstadoVacio
          icono={HeartHandshake}
          titulo="Primero elige a quién donar"
          descripcion="Para donar, abre la ficha de una mascota y pulsa «Donar a esta fundación»."
          accion={
            <Boton comoHijo>
              <Link href="/adoptar">Ver mascotas en adopción</Link>
            </Boton>
          }
        />
      </div>
    );
  }
  return <FormularioDonacion key={fundacion.id} fundacion={fundacion} />;
}
