'use client';

import { formatearFecha, formatearFechaBogota } from '@/shared/lib/fechas';
import { formatearMonto } from '@/shared/lib/monto';
import { GuardaFundacionAprobada } from '@/shared/ui/GuardaFundacionAprobada';
import { useResumenFundacion } from '../hooks/useResumenFundacion';
import type { EstadoMascota } from '../types';
import { AccesosRapidos } from './AccesosRapidos';
import { CifraResumen } from './CifraResumen';
import { EnlaceAccion } from './EnlaceAccion';
import { FilaResumen, ListaFilas } from './FilaResumen';
import { RejillaResumen, SeccionResumen } from './SeccionResumen';
import { TarjetaNotificaciones } from './TarjetaNotificaciones';
import { TarjetaSeguimientos } from './TarjetaSeguimientos';

const ETIQUETA_MASCOTA: ReadonlyArray<readonly [EstadoMascota, string]> = [
  ['disponible', 'Disponibles'],
  ['en_proceso', 'En proceso'],
  ['adoptada', 'Adoptadas'],
  ['inactiva', 'Inactivas'],
];

const rutaSeguimiento = (id: number) => `/fundacion/adopciones/seguimientos/${id}`;

/**
 * El `h1` va fuera de la guarda: sin la fundación aprobada no se monta el contenido (y, por
 * tanto, no hay peticiones operativas), pero la pantalla conserva su encabezado.
 */
export function PantallaResumenFundacion() {
  return (
    <div className="flex max-w-5xl min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Resumen</h1>
        <p className="text-muted-foreground">
          Lo más importante de tu fundación: mascotas, solicitudes, seguimientos y donaciones del
          mes.
        </p>
      </div>
      <GuardaFundacionAprobada>
        <ResumenFundacionAprobada />
      </GuardaFundacionAprobada>
    </div>
  );
}

function ResumenFundacionAprobada() {
  const { mascotas, solicitudes, seguimientos, donaciones, notificaciones } = useResumenFundacion();
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AccesosRapidos
        accesos={[
          { href: '/fundacion/mascotas/nueva', texto: 'Publicar mascota', principal: true },
          { href: '/fundacion/donaciones/nueva', texto: 'Registrar donación' },
        ]}
      />

      <RejillaResumen>
        <SeccionResumen
          titulo="Mis mascotas"
          consulta={mascotas}
          enlace={{ href: '/fundacion/mascotas', texto: 'Ver todas las mascotas' }}
          esVacio={(d) => Object.values(d).every((n) => n === 0)}
          vacio={{
            titulo: 'Aún no has publicado mascotas',
            descripcion: 'Publica la primera para que los adoptantes puedan conocerla.',
            accion: <EnlaceAccion href="/fundacion/mascotas/nueva">Publicar mascota</EnlaceAccion>,
          }}
        >
          {(d) => (
            <div className="grid grid-cols-2 gap-3">
              {ETIQUETA_MASCOTA.map(([estado, etiqueta]) => (
                <CifraResumen
                  key={estado}
                  etiqueta={etiqueta}
                  valor={d[estado]}
                  href={`/fundacion/mascotas?estado=${estado}`}
                />
              ))}
            </div>
          )}
        </SeccionResumen>

        <SeccionResumen
          titulo="Solicitudes pendientes"
          consulta={solicitudes}
          enlace={{ href: '/fundacion/solicitudes?estado=pendiente', texto: 'Ver solicitudes' }}
          esVacio={(d) => d.total === 0}
          vacio={{
            titulo: 'No tienes solicitudes por revisar',
            descripcion: 'Cuando un adoptante solicite una mascota, la verás aquí.',
            accion: <EnlaceAccion href="/fundacion/solicitudes">Ver solicitudes</EnlaceAccion>,
          }}
        >
          {(d) => (
            <>
              <CifraResumen etiqueta="Por revisar" valor={d.total} />
              <ListaFilas etiqueta="Solicitudes pendientes recientes">
                {d.data.map((s) => (
                  <FilaResumen
                    key={s.id}
                    href={`/fundacion/solicitudes/${s.id}`}
                    contexto="Solicitud para"
                    titulo={s.mascota.nombre}
                    detalle={`${s.adoptante.nombreCompleto} · ${formatearFecha(s.fechaSolicitud)}`}
                    estado={s.estado}
                  />
                ))}
              </ListaFilas>
            </>
          )}
        </SeccionResumen>

        <TarjetaSeguimientos
          consulta={seguimientos}
          rutaLista="/fundacion/adopciones"
          rutaDetalle={rutaSeguimiento}
          contraparte={(s) => s.adoptante?.nombreCompleto}
        />

        <SeccionResumen
          titulo="Donaciones del mes"
          consulta={donaciones}
          enlace={{ href: '/fundacion/donaciones', texto: 'Ver donaciones' }}
          esVacio={(d) => d.total === 0}
          vacio={{
            titulo: 'Este mes aún no hay donaciones',
            descripcion: 'Registra los aportes que recibas con su comprobante.',
            accion: (
              <EnlaceAccion href="/fundacion/donaciones/nueva">Registrar donación</EnlaceAccion>
            ),
          }}
        >
          {(d) => (
            <>
              <div className="grid grid-cols-2 gap-3">
                <CifraResumen
                  etiqueta="Total económico"
                  valor={formatearMonto(d.totales.economica.monto)}
                  className="col-span-2"
                />
                <CifraResumen etiqueta="Aportes económicos" valor={d.totales.economica.cantidad} />
                <CifraResumen etiqueta="Aportes en especie" valor={d.totales.especie.cantidad} />
              </div>
              <ListaFilas etiqueta="Donaciones recientes del mes">
                {d.data.map((x) => (
                  <FilaResumen
                    key={x.id}
                    titulo={x.donante.nombre}
                    detalle={[
                      x.tipo === 'economica' && x.monto
                        ? `Económica ${formatearMonto(x.monto)}`
                        : (x.descripcionEspecie ?? 'En especie'),
                      formatearFechaBogota(x.fecha),
                    ].join(' · ')}
                  />
                ))}
              </ListaFilas>
            </>
          )}
        </SeccionResumen>

        <TarjetaNotificaciones consulta={notificaciones} href="/fundacion/notificaciones" />
      </RejillaResumen>
    </div>
  );
}
