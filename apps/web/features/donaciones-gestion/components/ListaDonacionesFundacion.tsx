import { HandHeart } from 'lucide-react';
import { formatearFechaBogota } from '@/shared/lib/fechas';
import { formatearMonto } from '@/shared/lib/monto';
import { Boton } from '@/shared/ui/Boton';
import { BotonDescarga } from '@/shared/ui/BotonDescarga';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import {
  ETIQUETA_ORIGEN,
  ETIQUETA_TIPO,
  type ConsultaDonaciones,
  type DonacionFundacion,
} from '../types';

/** Un aporte por fila: tipo, origen y estado siempre en texto; comprobante solo si existe. */
export function ListaDonacionesFundacion({
  donaciones,
  consulta,
  alQuitarFiltros,
}: {
  donaciones: DonacionFundacion[];
  consulta: ConsultaDonaciones;
  alQuitarFiltros: () => void;
}) {
  if (donaciones.length === 0) {
    return consulta.desde || consulta.hasta || consulta.tipo ? (
      <EstadoVacio
        titulo="No hay aportes en ese periodo"
        descripcion="Prueba con otro periodo u otro tipo, o muestra todos los aportes."
        accion={
          <Boton variante="contorno" onClick={alQuitarFiltros}>
            Quitar filtros
          </Boton>
        }
      />
    ) : (
      <EstadoVacio
        icono={HandHeart}
        titulo="Aún no hay aportes registrados"
        descripcion="Los aportes que reciban tu fundación desde PetHogar, o que registres a mano, aparecerán aquí."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3" aria-label="Aportes recibidos">
      {donaciones.map((d) => (
        <li
          key={d.id}
          className="border-border-suave bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-lg font-bold break-words">{d.donante.nombre}</p>
            <p className="text-muted-foreground text-sm">
              {formatearFechaBogota(d.fecha)} · {ETIQUETA_ORIGEN[d.donante.origen]}
            </p>
            <p className="break-words">
              <span className="font-semibold">{ETIQUETA_TIPO[d.tipo]}:</span>{' '}
              {d.tipo === 'economica' && d.monto !== null
                ? formatearMonto(d.monto)
                : d.descripcionEspecie}
            </p>
          </div>
          {d.comprobante && (
            <BotonDescarga
              url={d.comprobante.url}
              nombreBase={`comprobante-donacion-${d.id}`}
              etiqueta="Descargar comprobante"
            />
          )}
        </li>
      ))}
    </ul>
  );
}
