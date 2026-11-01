'use client';

import { PaginaError } from '@/shared/ui/PaginaError';

export default function ErrorInesperado({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="contenido">
      <PaginaError reset={reset} />
    </main>
  );
}
