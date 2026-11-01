'use client';

import { PaginaError } from '@/shared/ui/PaginaError';

/** Conserva el shell del panel (cabecera y navegación) cuando falla solo el contenido. */
export default function ErrorDelPanel({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PaginaError reset={reset} />;
}
