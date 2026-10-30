import { useId } from 'react';
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaFila,
  TablaTitulo,
} from '@/shared/ui/Tabla';
import type { Serie } from '../lib/series';
import { Grafica } from './Grafica';

/**
 * Una serie: título, descripción visible, gráfica (complementaria, para lectores de pantalla es
 * una imagen descrita por la tabla) y tabla equivalente SIEMPRE visible con los mismos datos.
 * Sin datos, un texto de estado vacío sustituye a la gráfica.
 */
export function BloqueSerie({ serie }: { serie: Serie }) {
  const idTabla = `tabla-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const idTitulo = `${idTabla}-titulo`;
  return (
    <section aria-labelledby={idTitulo} className="flex min-w-0 flex-col gap-3">
      <h3 id={idTitulo} className="text-xl">
        {serie.titulo}
      </h3>
      <p className="text-muted-foreground">{serie.descripcion}</p>

      {serie.total === 0 ? (
        <p className="border-border-suave rounded-lg border border-dashed p-6 text-center">
          No hay datos para mostrar en este rango. Prueba con otro rango de fechas.
        </p>
      ) : (
        <>
          {serie.graficable ? (
            <div
              role="img"
              aria-label={serie.descripcion}
              aria-describedby={idTabla}
              className="border-border-suave bg-card min-w-0 rounded-lg border p-3"
            >
              <Grafica serie={serie} />
            </div>
          ) : (
            <p className="border-border-suave rounded-lg border border-dashed p-4 text-center">
              No hay montos que graficar; los aportes de este rango están en la tabla.
            </p>
          )}
          <Tabla id={idTabla} titulo={`Datos de «${serie.titulo}»`}>
            <TablaCabecera>
              <tr>
                {serie.columnas.map((c) => (
                  <TablaTitulo key={c}>{c}</TablaTitulo>
                ))}
              </tr>
            </TablaCabecera>
            <TablaCuerpo>
              {serie.filas.map((f) => (
                <TablaFila key={f.clave}>
                  {f.celdas.map((celda, i) => (
                    <TablaCelda
                      key={serie.columnas[i]}
                      className={i > 0 ? 'whitespace-nowrap' : ''}
                    >
                      {celda}
                    </TablaCelda>
                  ))}
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </>
      )}
    </section>
  );
}
