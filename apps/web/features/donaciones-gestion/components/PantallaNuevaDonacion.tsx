'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Boton } from '@/shared/ui/Boton';
import { GuardaFundacionAprobada } from '@/shared/ui/GuardaFundacionAprobada';
import { RUTA_DONACIONES } from '../lib/consulta';
import { AvisoSinPagos } from './AvisoSinPagos';
import { FormularioDonacionManual } from './FormularioDonacionManual';

export function PantallaNuevaDonacion() {
  return (
    <GuardaFundacionAprobada>
      <div className="flex max-w-3xl flex-col gap-6">
        <Boton comoHijo variante="fantasma" className="self-start">
          <Link href={RUTA_DONACIONES}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver a donaciones
          </Link>
        </Boton>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl">Registrar un aporte</h1>
          <p className="text-muted-foreground max-w-prose">
            Anota aquí los aportes que recibiste en persona, con su comprobante si lo tienes.
          </p>
        </div>
        <AvisoSinPagos />
        <FormularioDonacionManual />
      </div>
    </GuardaFundacionAprobada>
  );
}
