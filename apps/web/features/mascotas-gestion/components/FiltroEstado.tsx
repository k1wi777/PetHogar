'use client';

import { ESTADOS } from '@/shared/ui/BadgeEstado';
import { Campo } from '@/shared/ui/Campo';
import { Selector } from '@/shared/ui/Selector';
import { ESTADOS_MASCOTA, type EstadoMascota } from '../types';

const TODOS = 'todos';
const OPCIONES = [
  { valor: TODOS, texto: 'Todas' },
  ...ESTADOS_MASCOTA.map((e) => ({ valor: e, texto: ESTADOS[e]?.texto ?? e })),
];

export function FiltroEstado({
  valor,
  onCambio,
}: {
  valor: EstadoMascota | undefined;
  onCambio: (estado: EstadoMascota | undefined) => void;
}) {
  return (
    <div className="max-w-xs">
      <Campo etiqueta="Estado">
        <Selector
          opciones={OPCIONES}
          valor={valor ?? TODOS}
          onCambio={(v) => onCambio(v === TODOS ? undefined : (v as EstadoMascota))}
        />
      </Campo>
    </div>
  );
}
