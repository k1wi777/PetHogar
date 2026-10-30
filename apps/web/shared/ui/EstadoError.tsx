import { AlertTriangle } from 'lucide-react';
import { Boton } from './Boton';

/**
 * Error amable de una lista o pantalla de datos, con «Reintentar».
 * No toca la sesión: un fallo de red nunca debe cerrarla.
 */
export function EstadoError({
  titulo = 'No pudimos cargar esta información',
  mensaje = 'Revisa tu conexión e inténtalo de nuevo.',
  alReintentar,
  reintentando = false,
}: {
  titulo?: string;
  mensaje?: string;
  alReintentar: () => void;
  reintentando?: boolean;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-card flex flex-col items-center gap-3 rounded-lg border p-8 text-center"
    >
      <AlertTriangle className="text-destructive size-10" aria-hidden="true" />
      <h2 className="font-heading text-xl font-bold">{titulo}</h2>
      <p className="text-muted-foreground max-w-prose">{mensaje}</p>
      <Boton variante="contorno" onClick={alReintentar} cargando={reintentando}>
        Reintentar
      </Boton>
    </div>
  );
}
