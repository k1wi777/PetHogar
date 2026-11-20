import Link from 'next/link';
import { cn } from '@/shared/lib/utils';

/** Cifra con su etiqueta en texto; con `href` toda la cifra es un enlace a la lista relacionada. */
export function CifraResumen({
  etiqueta,
  valor,
  href,
  className,
}: {
  etiqueta: string;
  valor: string | number;
  href?: string;
  className?: string;
}) {
  const cuerpo = (
    <>
      <span className="text-muted-foreground block text-sm break-words">{etiqueta}</span>
      <span className="font-heading block text-3xl font-bold break-words">{valor}</span>
    </>
  );
  const base = 'bg-muted/40 min-w-0 rounded-md px-3 py-2';
  if (href) {
    return (
      <Link href={href} className={cn(base, 'hover:bg-muted block min-h-11', className)}>
        {cuerpo}
      </Link>
    );
  }
  return <div className={cn(base, className)}>{cuerpo}</div>;
}
