import { AlertTriangle } from 'lucide-react';
import { describirError } from '@/shared/lib/errores-usuario';
import { Boton } from './Boton';

/**
 * Error amable de una lista o pantalla de datos, con «Reintentar».
 * No toca la sesión: un fallo de red nunca debe cerrarla.
 */
export function EstadoError({
  titulo = 'No pudimos cargar esta información',
  error,
  mensaje,
  alReintentar,
  reintentando = false,
}: {
  titulo?: string;
  /** Error capturado: el traductor único elige el mensaje según la causa (red, límite, servidor…). */
  error?: unknown;
  mensaje?: string;
  alReintentar: () => void;
  reintentando?: boolean;
}) {
  const texto =
    mensaje ?? (error ? describirError(error).mensaje : 'Revisa tu conexión e inténtalo de nuevo.');
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-card flex flex-col items-center gap-3 rounded-lg border p-8 text-center"
    >
      <AlertTriangle className="text-destructive size-10" aria-hidden="true" />
      <h2 className="font-heading text-xl font-bold">{titulo}</h2>
      <p className="text-muted-foreground max-w-prose">{texto}</p>
      <Boton variante="contorno" onClick={alReintentar} cargando={reintentando}>
        Reintentar
      </Boton>
    </div>
  );
}
