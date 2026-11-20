'use client';

import { formatearMonto } from '@/shared/lib/monto';
import { useResumenAdministrador } from '../hooks/useResumenAdministrador';
import { CifraResumen } from './CifraResumen';
import { EnlaceAccion } from './EnlaceAccion';
import { FilaResumen, ListaFilas } from './FilaResumen';
import { RejillaResumen, SeccionResumen } from './SeccionResumen';
import { TarjetaNotificaciones } from './TarjetaNotificaciones';

export function PantallaResumenAdministrador() {
  const { fundaciones, estadisticas, notificaciones } = useResumenAdministrador();
  return (
    <div className="flex max-w-5xl min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Resumen</h1>
        <p className="text-muted-foreground">
          Las fundaciones que esperan validación y un vistazo a las cifras de la plataforma.
        </p>
      </div>

      <RejillaResumen>
        <SeccionResumen
          titulo="Fundaciones por validar"
          consulta={fundaciones}
          enlace={{ href: '/administrador/fundaciones', texto: 'Ver fundaciones por validar' }}
          esVacio={(d) => d.total === 0}
          vacio={{
            titulo: 'No hay fundaciones por validar',
            descripcion: 'Cuando una fundación se registre, aparecerá aquí para su revisión.',
            accion: <EnlaceAccion href="/administrador/fundaciones">Ver fundaciones</EnlaceAccion>,
          }}
        >
          {(d) => (
            <>
              <CifraResumen etiqueta="Esperan validación" valor={d.total} />
              <ListaFilas etiqueta="Fundaciones por validar, las más antiguas primero">
                {d.data.map((f) => (
                  <FilaResumen
                    key={f.id}
                    href={`/administrador/fundaciones/${f.id}`}
                    contexto="Fundación"
                    titulo={f.nombre}
                    detalle={f.ciudad}
                    estado="pendiente"
                  />
                ))}
              </ListaFilas>
            </>
          )}
        </SeccionResumen>

        <SeccionResumen
          titulo="Estadísticas de la plataforma"
          consulta={estadisticas}
          enlace={{ href: '/administrador/reportes', texto: 'Ver reportes y gráficas' }}
        >
          {(d) => (
            <div className="grid grid-cols-2 gap-3">
              <CifraResumen etiqueta="Adopciones" valor={d.adopciones.total} />
              <CifraResumen etiqueta="Solicitudes" valor={d.solicitudes.total} />
              <CifraResumen
                etiqueta="Solicitudes pendientes"
                valor={d.solicitudes.porEstado.pendiente}
              />
              <CifraResumen
                etiqueta="Seguimientos vencidos"
                valor={d.seguimientos.porEstado.vencido}
              />
              <CifraResumen etiqueta="Donaciones" valor={d.donaciones.total} />
              <CifraResumen
                etiqueta="Monto económico"
                valor={formatearMonto(d.donaciones.porTipo.economica.monto)}
              />
            </div>
          )}
        </SeccionResumen>

        <TarjetaNotificaciones consulta={notificaciones} href="/administrador/notificaciones" />
      </RejillaResumen>
    </div>
  );
}
