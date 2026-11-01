'use client';

import { Toaster as Sonner, toast } from 'sonner';

/** Región de avisos (`aria-live`); los mensajes se lanzan con `toast.exito` / `toast.error`. */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      duration={6000}
      // La región es `aria-live="polite"`; sus textos por defecto vienen en inglés.
      customAriaLabel="Avisos"
      toastOptions={{ closeButtonAriaLabel: 'Cerrar aviso' }}
    />
  );
}

export const aviso = {
  exito: (mensaje: string) => toast.success(mensaje),
  error: (mensaje: string) => toast.error(mensaje),
  info: (mensaje: string) => toast(mensaje),
};
