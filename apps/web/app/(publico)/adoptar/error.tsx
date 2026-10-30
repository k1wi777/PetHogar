'use client';

import { ErrorCarga } from '@/features/catalogo/components/ErrorCarga';

// El texto es fijo: en producción Next oculta el mensaje real de los errores del servidor.
export default function ErrorCatalogo({ reset }: { error: Error; reset: () => void }) {
  return <ErrorCarga titulo="No pudimos cargar las mascotas" reset={reset} />;
}
