'use client';

import { ImagePlus } from 'lucide-react';
import { useId, useState, type ChangeEvent, type DragEvent } from 'react';
import { cn } from '@/shared/lib/utils';

/**
 * Elegir fotos por teclado (un `<input type="file">` real con su etiqueta) o arrastrándolas; ambas
 * vías llaman a `alElegir`. El arrastre es una mejora: nunca es la única forma de añadir fotos.
 */
export function ZonaCarga({
  alElegir,
  deshabilitada,
  descripcion,
}: {
  alElegir: (archivos: File[]) => void;
  deshabilitada: boolean;
  descripcion: string;
}) {
  const id = useId();
  const [arrastrando, setArrastrando] = useState(false);

  function alCambiar(e: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = ''; // permite elegir de nuevo el mismo archivo
    if (archivos.length > 0) alElegir(archivos);
  }

  function alSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastrando(false);
    if (deshabilitada) return;
    const archivos = Array.from(e.dataTransfer.files);
    if (archivos.length > 0) alElegir(archivos);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!deshabilitada) setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={alSoltar}
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center',
        arrastrando ? 'border-primary bg-secondary' : 'border-border',
      )}
    >
      <ImagePlus className="text-muted-foreground size-10" aria-hidden="true" />
      <p className="max-w-prose">
        {arrastrando
          ? 'Suelta las fotos aquí'
          : deshabilitada
            ? descripcion
            : 'Arrastra tus fotos hasta aquí o elígelas con el botón.'}
      </p>
      <input
        id={id}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        className="peer sr-only"
        disabled={deshabilitada}
        onChange={alCambiar}
      />
      <label
        htmlFor={id}
        className={cn(
          'bg-primary text-primary-foreground inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 py-2 text-base font-semibold',
          'peer-focus-visible:outline-foreground peer-focus-visible:outline-4 peer-focus-visible:outline-offset-2',
          deshabilitada && 'pointer-events-none opacity-60',
        )}
      >
        Elegir fotos
      </label>
      {!deshabilitada && <p className="text-muted-foreground text-sm">{descripcion}</p>}
    </div>
  );
}
