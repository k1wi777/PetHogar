'use client';

import { useEffect, useRef, useState } from 'react';
import { textoAnuncio } from '../lib/anuncio';

export const DURACION_ANUNCIO_MS = 5_000;

/**
 * Región `aria-live` educada, siempre en el DOM y oculta a la vista: solo recibe texto cuando
 * el contador aumenta, y se vacía unos segundos después para poder repetir el anuncio.
 */
export function AnuncioContador({ cantidad }: { cantidad: number | undefined }) {
  const anterior = useRef<number | undefined>(undefined);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    const nuevo = textoAnuncio(anterior.current, cantidad);
    if (cantidad !== undefined) anterior.current = cantidad;
    if (!nuevo) return;
    setTexto(nuevo);
    const espera = setTimeout(() => setTexto(''), DURACION_ANUNCIO_MS);
    return () => clearTimeout(espera);
  }, [cantidad]);

  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only" data-testid="anuncio-contador">
      {texto}
    </p>
  );
}
