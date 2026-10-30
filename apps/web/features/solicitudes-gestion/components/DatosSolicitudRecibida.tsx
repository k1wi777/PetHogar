import type { ReactNode } from 'react';
import { formatearFecha } from '@/shared/lib/fechas';
import { BotonDescarga } from '@/shared/ui/BotonDescarga';
import { ETIQUETA_VIVIENDA, type DetalleSolicitudRecibida } from '../types';

const CORREO = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="font-semibold">{etiqueta}</dt>
      <dd className="min-w-0 break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

const CLASE_TARJETA =
  'border-border-suave bg-card grid gap-x-4 gap-y-3 rounded-lg border p-4 sm:grid-cols-[10rem_1fr]';

/** Datos que el backend expone del adoptante (nunca documento ni dirección) y de la solicitud. */
export function DatosSolicitudRecibida({ s }: { s: DetalleSolicitudRecibida }) {
  const a = s.adoptante;
  const telefono = a.telefono.replace(/[^\d+]/g, '');
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="titulo-adoptante" className="flex flex-col gap-2">
        <h2 id="titulo-adoptante" className="text-2xl">
          Adoptante
        </h2>
        <dl className={CLASE_TARJETA}>
          <Fila etiqueta="Nombre">{a.nombreCompleto}</Fila>
          <Fila etiqueta="Correo">
            {CORREO.test(a.email) ? (
              <a href={`mailto:${a.email}`} className="text-primary break-all underline">
                {a.email}
              </a>
            ) : (
              a.email
            )}
          </Fila>
          <Fila etiqueta="Teléfono">
            {telefono ? (
              <a href={`tel:${telefono}`} className="text-primary underline">
                {a.telefono}
              </a>
            ) : (
              a.telefono
            )}
          </Fila>
          <Fila etiqueta="Ciudad">{a.ciudad}</Fila>
        </dl>
      </section>
      <section aria-labelledby="titulo-solicitud" className="flex flex-col gap-2">
        <h2 id="titulo-solicitud" className="text-2xl">
          Solicitud
        </h2>
        <dl className={CLASE_TARJETA}>
          <Fila etiqueta="Enviada el">{formatearFecha(s.fechaSolicitud)}</Fila>
          <Fila etiqueta="Motivo">{s.motivo}</Fila>
          <Fila etiqueta="Tipo de vivienda">{ETIQUETA_VIVIENDA[s.tipoVivienda]}</Fila>
          <Fila etiqueta="Otras mascotas">{s.tieneOtrasMascotas ? 'Sí' : 'No'}</Fila>
        </dl>
        <BotonDescarga
          url={s.formulario.url}
          nombreBase={`formulario-solicitud-${s.id}`}
          etiqueta="Descargar formulario firmado"
        />
      </section>
    </div>
  );
}
