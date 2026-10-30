'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { esErrorApi, mensajeDe } from '@/shared/api/errores';
import { descargarArchivo } from '@/shared/lib/descarga';
import { Boton } from './Boton';

type Resultado = { tipo: 'ok'; nombre: string } | { tipo: 'error'; mensaje: string } | null;

/**
 * Descarga un archivo privado con la sesión. El fallo se muestra junto al botón (nunca cierra la
 * sesión) y el botón sigue disponible para reintentar.
 */
export function BotonDescarga({
  url,
  nombreBase,
  etiqueta,
  className,
}: {
  /** Ruta que entregó la API (`/api/…`). */
  url: string;
  /** Nombre del archivo sin extensión. */
  nombreBase: string;
  etiqueta: string;
  className?: string;
}) {
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<Resultado>(null);

  async function descargar() {
    if (cargando) return;
    setCargando(true);
    setResultado(null);
    try {
      const nombre = await descargarArchivo(url, nombreBase);
      setResultado({ tipo: 'ok', nombre });
    } catch (error) {
      setResultado({
        tipo: 'error',
        mensaje:
          esErrorApi(error) && error.estado === 404
            ? 'Este archivo ya no está disponible.'
            : mensajeDe(error),
      });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Boton
        variante="contorno"
        onClick={descargar}
        cargando={cargando}
        className={className ?? 'w-full sm:w-auto'}
      >
        {!cargando && <Download className="size-4" aria-hidden="true" />}
        {cargando ? 'Descargando…' : etiqueta}
      </Boton>
      <div role={resultado?.tipo === 'error' ? 'alert' : 'status'} className="text-sm">
        {resultado?.tipo === 'ok' && (
          <p className="text-muted-foreground break-words">
            Listo: guardamos «{resultado.nombre}» en tus descargas.
          </p>
        )}
        {resultado?.tipo === 'error' && (
          <p className="text-destructive break-words">{resultado.mensaje}</p>
        )}
      </div>
    </div>
  );
}
