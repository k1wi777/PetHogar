'use client';

import { ImageOff } from 'lucide-react';
import { Boton } from '@/shared/ui/Boton';
import { textoAlternativo } from '../lib/subida';
import type { FotoGestion } from '../types';

/** Una foto de la galería: miniatura, insignia «Principal» con texto y acciones con la posición en su nombre. */
export function TarjetaFotoGestion({
  foto,
  nombreMascota,
  posicion,
  total,
  ocupada,
  alMarcarPrincipal,
  alEliminar,
}: {
  foto: FotoGestion;
  nombreMascota: string;
  posicion: number;
  total: number;
  ocupada: boolean;
  alMarcarPrincipal: () => void;
  alEliminar: () => void;
}) {
  return (
    <li className="border-border-suave bg-card flex flex-col gap-3 rounded-lg border p-3">
      {foto.urlCatalogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL pública de la API; next/image no aporta aquí
        <img
          src={foto.urlCatalogo}
          alt={textoAlternativo(nombreMascota, posicion, total, foto.esPrincipal)}
          className="aspect-square w-full rounded object-cover"
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-1 rounded text-sm">
          <ImageOff className="size-8" aria-hidden="true" />
          Sin vista previa
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {foto.esPrincipal ? (
          <span className="bg-success text-success-foreground inline-flex rounded-full px-3 py-1 text-sm font-semibold">
            Principal
          </span>
        ) : (
          <Boton
            variante="contorno"
            disabled={ocupada}
            onClick={alMarcarPrincipal}
            aria-label={`Marcar la foto ${posicion} como principal`}
          >
            Hacer principal
          </Boton>
        )}
        <Boton
          variante="contorno"
          disabled={ocupada}
          onClick={alEliminar}
          aria-label={`Eliminar la foto ${posicion}`}
        >
          Eliminar
        </Boton>
      </div>
    </li>
  );
}
