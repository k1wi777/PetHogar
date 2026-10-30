'use client';

import { GuardaFundacionAprobada } from '@/shared/ui/GuardaFundacionAprobada';
import { FormularioMascota } from './FormularioMascota';

export function PantallaNuevaMascota() {
  return (
    <GuardaFundacionAprobada>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl">Publicar mascota</h1>
          <p className="text-muted-foreground max-w-prose">
            Completa los datos. Al publicarla podrás añadirle fotos y su historial médico.
          </p>
        </div>
        <FormularioMascota modo="crear" />
      </div>
    </GuardaFundacionAprobada>
  );
}
