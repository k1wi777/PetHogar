import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FiltrosCatalogo as Filtros } from '../types';
import { FiltrosCatalogo } from './FiltrosCatalogo';

const ESPECIES = [
  { id: 1, nombre: 'perro' },
  { id: 2, nombre: 'gato' },
];
const SIN_FILTROS: Filtros = { pagina: 1 };

describe('FiltrosCatalogo', () => {
  it('es un formulario GET hacia /adoptar con controles etiquetados', () => {
    render(<FiltrosCatalogo filtros={SIN_FILTROS} especies={ESPECIES} />);
    const form = screen.getByRole('form', { name: 'Filtrar mascotas' });
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/adoptar');
    expect(screen.getByLabelText('Especie')).toHaveAttribute('name', 'especie');
    expect(screen.getByLabelText('Tamaño')).toHaveAttribute('name', 'tamano');
    expect(screen.getByLabelText('Ciudad')).toHaveAttribute('name', 'ciudad');
    expect(screen.getByRole('group', { name: 'Rango de edad (en meses)' })).toBeInTheDocument();
    expect(screen.getByLabelText('Desde')).toHaveAttribute('name', 'edadMin');
    expect(screen.getByLabelText('Hasta')).toHaveAttribute('name', 'edadMax');
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveAttribute('type', 'submit');
    expect(screen.queryByRole('link', { name: 'Limpiar filtros' })).toBeNull();
    expect(form.querySelector('[name="pagina"]')).toBeNull();
  });

  it('muestra los valores de la URL en los controles y ofrece limpiar', () => {
    render(
      <FiltrosCatalogo
        filtros={{
          especie: 2,
          tamano: 'mediano',
          edadMin: 3,
          edadMax: 18,
          ciudad: 'Cali',
          pagina: 4,
        }}
        especies={ESPECIES}
      />,
    );
    expect(screen.getByLabelText('Especie')).toHaveValue('2');
    expect(within(screen.getByLabelText('Especie')).getByText('Gato')).toBeInTheDocument();
    expect(screen.getByLabelText('Tamaño')).toHaveValue('mediano');
    expect(screen.getByLabelText('Ciudad')).toHaveValue('Cali');
    expect(screen.getByLabelText('Desde')).toHaveValue(3);
    expect(screen.getByLabelText('Hasta')).toHaveValue(18);
    expect(screen.getByRole('link', { name: 'Limpiar filtros' })).toHaveAttribute(
      'href',
      '/adoptar',
    );
  });

  it('deshabilita la especie con una nota si no se cargaron, sin tumbar el resto', () => {
    render(<FiltrosCatalogo filtros={SIN_FILTROS} especies={null} />);
    expect(screen.getByLabelText('Especie')).toBeDisabled();
    expect(screen.getByText(/No pudimos cargar las especies/)).toBeInTheDocument();
    expect(screen.getByLabelText('Tamaño')).toBeEnabled();
  });

  it('avisa del rango incoherente', () => {
    render(
      <FiltrosCatalogo
        filtros={{ edadMin: 30, edadMax: 10, pagina: 1 }}
        especies={ESPECIES}
        errorRango
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La edad mínima no puede ser mayor que la máxima.',
    );
    expect(screen.getByLabelText('Desde')).toHaveAttribute('aria-invalid', 'true');
  });
});
