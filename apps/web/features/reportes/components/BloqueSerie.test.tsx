import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { estadisticas, estadisticasVacias } from '../prueba-datos';
import { serieAdopcionesPorMes, serieDonacionesPorTipo, serieSolicitudes } from '../lib/series';
import type { Serie } from '../lib/series';
import { BloqueSerie } from './BloqueSerie';

// jsdom no mide el contenedor responsivo: se simulan las vistas y se prueba el contrato de datos.
vi.mock('./VistaBarras', () => ({
  default: ({ serie }: { serie: Serie }) => (
    <div data-testid="vista-barras">
      {JSON.stringify(serie.filas.map((f) => [f.etiquetaCorta, f.valor]))}
    </div>
  ),
}));
vi.mock('./VistaDona', () => ({
  default: ({ serie }: { serie: Serie }) => (
    <div data-testid="vista-dona">
      {JSON.stringify(serie.filas.map((f) => [f.etiqueta, f.valor, f.porcentaje]))}
    </div>
  ),
}));

describe('BloqueSerie', () => {
  it('muestra título, descripción, la gráfica como imagen descrita y la tabla equivalente con las mismas filas', async () => {
    const serie = serieSolicitudes(estadisticas());
    render(<BloqueSerie serie={serie} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Solicitudes por estado' })).toBeVisible();
    const imagen = screen.getByRole('img');
    expect(imagen).toHaveAccessibleName(serie.descripcion);
    expect(await within(imagen).findByTestId('vista-dona')).toBeInTheDocument();

    const tabla = screen.getByRole('table');
    expect(imagen).toHaveAttribute('aria-describedby', tabla.id);
    expect(tabla).toBeVisible();
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(serie.columnas);
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(
      filas.map((r) =>
        within(r)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      ),
    ).toEqual(serie.filas.map((f) => f.celdas));
    // La vista recibe exactamente las mismas filas que la tabla.
    expect(JSON.parse(within(imagen).getByTestId('vista-dona').textContent!)).toEqual(
      serie.filas.map((f) => [f.etiqueta, f.valor, f.porcentaje]),
    );
  });

  it('las series temporales usan la vista de barras', async () => {
    render(<BloqueSerie serie={serieAdopcionesPorMes(estadisticas())} />);
    expect(await screen.findByTestId('vista-barras')).toBeInTheDocument();
    expect(screen.queryByTestId('vista-dona')).toBeNull();
  });

  it('los porcentajes que ve el lector (tabla) suman 100', () => {
    render(<BloqueSerie serie={serieSolicitudes(estadisticas())} />);
    const suma = within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((r) => Number(within(r).getAllByRole('cell')[2]!.textContent!.replace(' %', '')))
      .reduce((a, b) => a + b, 0);
    expect(suma).toBe(100);
  });

  it('sin datos muestra un texto de estado vacío, sin gráfica ni tabla', () => {
    render(<BloqueSerie serie={serieSolicitudes(estadisticasVacias())} />);
    expect(screen.getByText(/No hay datos para mostrar en este rango/)).toBeVisible();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByTestId('vista-dona')).toBeNull();
  });

  it('el monto económico por tipo va solo en la tabla, como cadena exacta', () => {
    render(<BloqueSerie serie={serieDonacionesPorTipo(estadisticas())} />);
    expect(screen.getByRole('table')).toHaveTextContent('$ 9.007.199.254.741.093,60');
  });
});
