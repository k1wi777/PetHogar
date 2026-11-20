'use client';

import { formatearFecha } from '@/shared/lib/fechas';
import { useResumenAdoptante } from '../hooks/useResumenAdoptante';
import { AccesosRapidos } from './AccesosRapidos';
import { CifraResumen } from './CifraResumen';
import { EnlaceAccion } from './EnlaceAccion';
import { FilaResumen, ListaFilas } from './FilaResumen';
import { RejillaResumen, SeccionResumen } from './SeccionResumen';
import { TarjetaNotificaciones } from './TarjetaNotificaciones';
import { TarjetaSeguimientos } from './TarjetaSeguimientos';

const rutaSeguimiento = (id: number) => `/adoptante/adopciones/seguimientos/${id}`;

export function PantallaResumenAdoptante() {
  const { solicitudes, adopciones, seguimientos, notificaciones } = useResumenAdoptante();
  return (
    <div className="flex min-w-0 max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Inicio</h1>
        <p className="text-muted-foreground">
          Así van tus solicitudes, tus adopciones y tus seguimientos.
        </p>
      </div>

      <AccesosRapidos
        accesos={[
          { href: '/adoptar', texto: 'Buscar mascotas', principal: true },
          { href: '/adoptante/donar', texto: 'Donar a una fundación' },
        ]}
      />

      <RejillaResumen>
        <SeccionResumen
          titulo="Mis solicitudes"
          consulta={solicitudes}
          enlace={{ href: '/adoptante/solicitudes', texto: 'Ver todas mis solicitudes' }}
          esVacio={(d) => d.total === 0}
          vacio={{
            titulo: 'Aún no has enviado solicitudes',
            descripcion: 'Cuando encuentres una mascota que te enamore, solicítala desde su ficha.',
            accion: <EnlaceAccion href="/adoptar">Buscar mascotas</EnlaceAccion>,
          }}
        >
          {(d) => (
            <>
              <div className="grid grid-cols-2 gap-3">
                <CifraResumen etiqueta="Enviadas" valor={d.total} />
                <CifraResumen etiqueta="Pendientes" valor={d.pendientes} />
              </div>
              <ListaFilas etiqueta="Solicitudes recientes">
                {d.recientes.map((s) => (
                  <FilaResumen
                    key={s.id}
                    href={`/adoptante/solicitudes/${s.id}`}
                    contexto="Solicitud de"
                    titulo={s.mascota.nombre}
                    detalle={`${s.fundacion.nombre} · ${formatearFecha(s.fechaSolicitud)}`}
                    estado={s.estado}
                  />
                ))}
              </ListaFilas>
            </>
          )}
        </SeccionResumen>

        <SeccionResumen
          titulo="Mis adopciones activas"
          consulta={adopciones}
          enlace={{ href: '/adoptante/adopciones', texto: 'Ver mis adopciones' }}
          esVacio={(d) => d.total === 0}
          vacio={{
            titulo: 'Todavía no tienes adopciones activas',
            descripcion: 'Cuando una fundación apruebe tu solicitud, tu adopción aparecerá aquí.',
            accion: <EnlaceAccion href="/adoptar">Buscar mascotas</EnlaceAccion>,
          }}
        >
          {(d) => (
            <>
              <CifraResumen etiqueta="Adopciones activas" valor={d.total} />
              <ListaFilas etiqueta="Adopciones recientes">
                {d.data.map((a) => (
                  <FilaResumen
                    key={a.id}
                    titulo={a.mascota.nombre}
                    detalle={`${a.fundacion.nombre} · entregada el ${formatearFecha(a.fechaEntrega)}`}
                  />
                ))}
              </ListaFilas>
            </>
          )}
        </SeccionResumen>

        <TarjetaSeguimientos
          consulta={seguimientos}
          rutaLista="/adoptante/adopciones"
          rutaDetalle={rutaSeguimiento}
          contraparte={(s) => s.fundacion?.nombre}
        />

        <TarjetaNotificaciones consulta={notificaciones} href="/adoptante/notificaciones" />
      </RejillaResumen>
    </div>
  );
}
