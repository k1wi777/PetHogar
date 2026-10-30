'use client';

import { ErrorCarga } from '@/features/catalogo/components/ErrorCarga';

export default function ErrorFicha({ reset }: { error: Error; reset: () => void }) {
  return <ErrorCarga titulo="No pudimos cargar la ficha" reset={reset} />;
}
