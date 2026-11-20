import type { UseQueryResult } from '@tanstack/react-query';
import { CifraResumen } from './CifraResumen';
import { SeccionResumen } from './SeccionResumen';

export function TarjetaNotificaciones({
  consulta,
  href,
}: {
  consulta: UseQueryResult<number>;
  href: string;
}) {
  return (
    <SeccionResumen
      titulo="Notificaciones"
      consulta={consulta}
      enlace={{ href, texto: 'Ver mis notificaciones' }}
    >
      {(n) => (
        <>
          <CifraResumen etiqueta="Sin leer" valor={n} />
          {n === 0 && <p className="text-muted-foreground">No tienes avisos pendientes.</p>}
        </>
      )}
    </SeccionResumen>
  );
}
