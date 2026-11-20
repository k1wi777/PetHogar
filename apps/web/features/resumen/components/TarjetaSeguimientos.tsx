import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { estadoVisible } from '@/shared/lib/seguimiento';
import { formatearFecha } from '@/shared/lib/fechas';
import type { ResumenSeguimientos, SeguimientoDeLista } from '../types';
import { CifraResumen } from './CifraResumen';
import { FilaResumen, ListaFilas } from './FilaResumen';
import { SeccionResumen } from './SeccionResumen';

const ETIQUETA_TIPO = { visita: 'Visita', reporte: 'Reporte' } as const;

export function TarjetaSeguimientos({
  consulta,
  rutaLista,
  rutaDetalle,
  contraparte,
  accionVacia,
}: {
  consulta: UseQueryResult<ResumenSeguimientos>;
  rutaLista: string;
  rutaDetalle: (id: number) => string;
  contraparte: (s: SeguimientoDeLista) => string | undefined;
  accionVacia?: ReactNode;
}) {
  return (
    <SeccionResumen
      titulo="Seguimientos"
      consulta={consulta}
      enlace={{ href: rutaLista, texto: 'Ver adopciones y seguimientos' }}
      esVacio={(d) => d.vencidos === 0 && d.programados === 0}
      vacio={{
        titulo: 'No hay seguimientos pendientes',
        descripcion: 'Cuando se programe una visita o un reporte, lo verás aquí.',
        accion: accionVacia,
      }}
    >
      {(d) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <CifraResumen etiqueta="Vencidos" valor={d.vencidos} />
            <CifraResumen
              etiqueta="Programados"
              valor={d.parcial ? `${d.programados} o más` : d.programados}
            />
          </div>
          <ListaFilas etiqueta="Seguimientos destacados">
            {d.destacados.map((s) => (
              <FilaResumen
                key={s.id}
                href={rutaDetalle(s.id)}
                contexto={`${ETIQUETA_TIPO[s.tipo]} de`}
                titulo={s.mascota.nombre}
                detalle={[contraparte(s), formatearFecha(s.fechaProgramada)]
                  .filter(Boolean)
                  .join(' · ')}
                estado={estadoVisible(s)}
              />
            ))}
          </ListaFilas>
        </>
      )}
    </SeccionResumen>
  );
}
