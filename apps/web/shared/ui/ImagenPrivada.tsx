'use client';

import { ImageOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { http } from '@/shared/api/http';
import { rutaDeEnlace } from '@/shared/lib/enlaces';
import { Boton } from './Boton';

/**
 * Foto privada: se pide con la sesión como `Blob` (caché por ruta) y se muestra con un object URL
 * que se revoca al desmontar o al cambiar. Un fallo (incluido el 429) no se reintenta solo.
 */
export function ImagenPrivada({
  url,
  alt,
  className,
}: {
  /** Ruta que entregó la API (`/api/…`). */
  url: string;
  alt: string;
  className?: string;
}) {
  const consulta = useQuery({
    queryKey: ['imagen-privada', url],
    queryFn: async () => (await http.descargar(rutaDeEnlace(url))).blob,
    staleTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [src, setSrc] = useState<string | null>(null);
  const blob = consulta.data;

  useEffect(() => {
    if (!blob) return;
    const objeto = URL.createObjectURL(blob);
    // El object URL es un recurso externo que se crea y se libera con el efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrc(objeto);
    return () => {
      URL.revokeObjectURL(objeto);
      setSrc(null);
    };
  }, [blob]);

  if (consulta.isError) {
    return (
      <div
        role="alert"
        className="border-border-suave flex min-h-32 min-w-0 flex-col items-center justify-center gap-2 rounded-md border p-3 text-center text-sm"
      >
        <ImageOff className="text-muted-foreground size-6" aria-hidden="true" />
        <p>No pudimos cargar la foto.</p>
        <Boton
          variante="contorno"
          onClick={() => void consulta.refetch()}
          cargando={consulta.isFetching}
        >
          Reintentar
        </Boton>
      </div>
    );
  }
  if (!src) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="bg-muted min-h-32 animate-pulse rounded-md"
        aria-label="Cargando foto"
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- es un object URL local, next/image no aplica
  return <img src={src} alt={alt} className={className ?? 'h-auto max-w-full rounded-md'} />;
}
