import { cva } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

export type TonoBadge = 'exito' | 'aviso' | 'info' | 'peligro' | 'neutro';

const tonos = cva('inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold', {
  variants: {
    tono: {
      exito: 'bg-success text-success-foreground',
      aviso: 'bg-warning text-warning-foreground',
      info: 'bg-info text-info-foreground',
      peligro: 'bg-destructive text-destructive-foreground',
      neutro: 'bg-neutral text-neutral-foreground',
    },
  },
});

/** Texto en español y tono de cada estado del dominio. El estado siempre se comunica con texto. */
export const ESTADOS: Readonly<Record<string, { texto: string; tono: TonoBadge }>> = {
  // mascota
  disponible: { texto: 'Disponible', tono: 'exito' },
  en_proceso: { texto: 'En proceso', tono: 'info' },
  adoptada: { texto: 'Adoptada', tono: 'neutro' },
  inactiva: { texto: 'Inactiva', tono: 'neutro' },
  // solicitud
  pendiente: { texto: 'Pendiente', tono: 'aviso' },
  aprobada: { texto: 'Aprobada', tono: 'exito' },
  rechazada: { texto: 'Rechazada', tono: 'peligro' },
  cancelada: { texto: 'Cancelada', tono: 'neutro' },
  // seguimiento
  programado: { texto: 'Programado', tono: 'info' },
  vencido: { texto: 'Vencido', tono: 'peligro' },
  realizado: { texto: 'Realizado', tono: 'exito' },
  cancelado: { texto: 'Cancelado', tono: 'neutro' },
  // adopción
  activa: { texto: 'Activa', tono: 'exito' },
  finalizada: { texto: 'Finalizada', tono: 'neutro' },
  revocada: { texto: 'Revocada', tono: 'peligro' },
};

export function BadgeEstado({ estado, className }: { estado: string; className?: string }) {
  const definicion = ESTADOS[estado] ?? { texto: estado, tono: 'neutro' as const };
  return (
    <span className={cn(tonos({ tono: definicion.tono }), className)}>{definicion.texto}</span>
  );
}
