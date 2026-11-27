import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

/**
 * Composición común de las pantallas de acceso: una tarjeta sobre campo ciruela suave. Con
 * `conFoto`, desde `lg` añade un lateral decorativo (después en el DOM: no entra en el orden de
 * lectura del formulario ni se muestra en móvil).
 */
export function MarcoAcceso({
  children,
  conFoto = false,
  ancho = 'estrecho',
  className,
}: {
  children: ReactNode;
  conFoto?: boolean;
  /** `amplio` para los registros, con campos en dos columnas. */
  ancho?: 'estrecho' | 'amplio';
  className?: string;
}) {
  return (
    <div
      className={cn('bg-secondary min-h-[calc(100dvh-5rem)]', conFoto && 'lg:grid lg:grid-cols-2')}
    >
      <div className="flex items-start justify-center px-3 py-6 sm:px-6 sm:py-12">
        <div
          className={cn(
            'bg-card flex w-full min-w-0 flex-col gap-5 rounded-xl p-5 break-words shadow-sm sm:p-8',
            ancho === 'amplio' ? 'max-w-2xl' : 'max-w-md',
            className,
          )}
        >
          {children}
        </div>
      </div>
      {conFoto && (
        // El lateral solo existe desde `lg`; la imagen diferida no se descarga mientras está oculta.
        <div
          aria-hidden="true"
          className="bg-primary hidden items-center justify-center p-10 lg:flex"
        >
          <Image
            src="/portada/firulais.webp"
            alt=""
            width={800}
            height={996}
            unoptimized
            className="bg-acento h-auto max-h-[34rem] w-auto max-w-full rotate-2 rounded-xl p-2 shadow-lg"
          />
        </div>
      )}
    </div>
  );
}
