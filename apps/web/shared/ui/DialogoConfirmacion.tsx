'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { Boton } from './Boton';

export interface DialogoConfirmacionProps {
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  titulo: string;
  descripcion: ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  destructivo?: boolean;
  cargando?: boolean;
  onConfirmar: () => void;
}

/** Confirma una acción explícitamente: foco atrapado, Escape y «Cancelar» cierran sin ejecutar. */
export function DialogoConfirmacion({
  abierto,
  onAbiertoChange,
  titulo,
  descripcion,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  destructivo = false,
  cargando = false,
  onConfirmar,
}: DialogoConfirmacionProps) {
  return (
    <Dialog.Root open={abierto} onOpenChange={onAbiertoChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="bg-card fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg p-6 shadow-xl">
          <Dialog.Title className="font-heading text-xl font-bold">{titulo}</Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-2">
            {descripcion}
          </Dialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Boton variante="contorno" disabled={cargando}>
                {textoCancelar}
              </Boton>
            </Dialog.Close>
            <Boton
              variante={destructivo ? 'destructivo' : 'primario'}
              cargando={cargando}
              onClick={onConfirmar}
            >
              {textoConfirmar}
            </Boton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
