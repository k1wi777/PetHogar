import { PawPrint } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/shared/lib/utils';

/** Logotipo de texto con la huella sobre mango; el icono es decorativo: el nombre es «PetHogar». */
export function Marca({ className, claseIcono }: { className?: string; claseIcono?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        'font-heading text-primary inline-flex min-h-11 items-center gap-1.5 rounded-full text-xl font-extrabold sm:gap-2 sm:text-2xl',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'bg-acento text-acento-foreground flex size-7 -rotate-12 items-center justify-center rounded-full sm:size-9',
          claseIcono,
        )}
      >
        <PawPrint className="size-4 sm:size-5" />
      </span>
      PetHogar
    </Link>
  );
}
