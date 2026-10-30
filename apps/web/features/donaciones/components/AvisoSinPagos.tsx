import { Info } from 'lucide-react';

/** Aviso fijo y no descartable: PetHogar no es una pasarela de pagos (R16). */
export function AvisoSinPagos({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={`border-info-foreground bg-info text-info-foreground flex items-start gap-3 rounded-lg border-2 p-4 ${className ?? ''}`}
    >
      <Info className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
      <p>
        <strong>PetHogar no procesa pagos.</strong> Aquí solo registras el aporte que ya hiciste
        directamente a la fundación; adjunta el comprobante si lo tienes.
      </p>
    </div>
  );
}
