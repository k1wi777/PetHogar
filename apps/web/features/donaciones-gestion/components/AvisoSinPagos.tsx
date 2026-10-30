import { Info } from 'lucide-react';

/** Aviso fijo y no descartable: PetHogar no es una pasarela de pagos. */
export function AvisoSinPagos({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={`border-info-foreground bg-info text-info-foreground flex items-start gap-3 rounded-lg border-2 p-4 ${className ?? ''}`}
    >
      <Info className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
      <p>
        <strong>PetHogar no procesa pagos.</strong> Solo registra el aporte y su comprobante: el
        dinero o los insumos se entregan directamente a la fundación.
      </p>
    </div>
  );
}
