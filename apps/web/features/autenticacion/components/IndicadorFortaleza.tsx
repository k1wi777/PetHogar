import { Check, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { TEXTO_NIVEL, evaluarFortaleza, type NivelFortaleza } from '../lib/fortaleza';

const SEGMENTOS: Readonly<Record<NivelFortaleza, number>> = {
  vacia: 0,
  debil: 1,
  media: 2,
  fuerte: 3,
};
const COLOR: Readonly<Record<NivelFortaleza, string>> = {
  vacia: 'bg-border',
  debil: 'bg-destructive',
  media: 'bg-warning',
  fuerte: 'bg-success',
};

/**
 * Muestra el nivel con texto (no solo color) y la lista de criterios de la política. La región
 * `aria-live` solo cambia cuando cambia el nivel, así no se anuncia cada tecla.
 */
export function IndicadorFortaleza({ contrasena }: { contrasena: string }) {
  const { criterios, nivel } = evaluarFortaleza(contrasena);
  const activos = SEGMENTOS[nivel];
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p aria-live="polite" className="font-semibold">
        {TEXTO_NIVEL[nivel]}
      </p>
      <div aria-hidden="true" className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn('h-2 flex-1 rounded-full', n <= activos ? COLOR[nivel] : 'bg-border')}
          />
        ))}
      </div>
      <ul aria-label="Requisitos de la contraseña" className="flex flex-col gap-1">
        {criterios.map((c) => (
          <li key={c.clave} className="flex items-center gap-2">
            {c.cumplido ? (
              <Check className="text-success size-4 shrink-0" aria-hidden="true" />
            ) : (
              <X className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {c.texto}: <span className="font-semibold">{c.cumplido ? 'Cumple' : 'Falta'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
