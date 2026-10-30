import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '@/shared/api/errores';
import type { MascotaCatalogo } from '@/features/catalogo/types';
import ErrorCatalogo from './error';
import CatalogoPage from './page';

const listarMascotas = vi.fn();
const listarEspecies = vi.fn();
vi.mock('@/features/catalogo/api/mascotas', () => ({
  listarMascotas: (...a: unknown[]) => listarMascotas(...a),
}));
vi.mock('@/features/catalogo/api/especies', () => ({
  listarEspecies: (...a: unknown[]) => listarEspecies(...a),
}));

function mascota(id: number, extra: Partial<MascotaCatalogo> = {}): MascotaCatalogo {
  return {
    id,
    nombre: `Mascota ${id}`,
    especie: 'perro',
    raza: 'Criollo',
    sexo: 'macho',
    edadMeses: 30,
    tamano: 'mediano',
    ciudad: 'Montería',
    fundacion: { nombre: 'Huellitas' },
    fotoPrincipal: null,
    ...extra,
  };
}
const pagina = (data: MascotaCatalogo[], total = data.length, page = 1) => ({
  data,
  total,
  page,
  limit: 12,
});

async function abrir(params: Record<string, string | string[]> = {}) {
  render(await CatalogoPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  listarMascotas.mockReset();
  listarEspecies.mockReset().mockResolvedValue([{ id: 1, nombre: 'perro' }]);
});

describe('CatalogoPage', () => {
  it('muestra las tarjetas enlazadas a la ficha y anuncia la cantidad', async () => {
    listarMascotas.mockResolvedValue(
      pagina([
        mascota(7, { fotoPrincipal: { urlCatalogo: 'http://api/uploads/publico/a.webp' } }),
        mascota(8),
      ]),
    );
    await abrir();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Mascotas disponibles' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 mascotas encontradas');
    expect(screen.getByRole('link', { name: 'Mascota 7' })).toHaveAttribute('href', '/mascotas/7');
    expect(screen.getAllByRole('link', { name: /Mascota/ })).toHaveLength(2);
    expect(screen.getByAltText('Foto de Mascota 7, Perro')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mascota 8 aún no tiene foto' })).toBeInTheDocument();
    expect(screen.getAllByText(/Montería · Huellitas/)).toHaveLength(2);
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
  });

  it('envía a la API solo filtros válidos y refleja la URL en los controles', async () => {
    listarMascotas.mockResolvedValue(pagina([mascota(1)]));
    await abrir({ especie: '1', tamano: 'enorme', edadMin: 'x', ciudad: 'Cali' });
    expect(listarMascotas).toHaveBeenCalledWith({
      especieId: 1,
      tamano: undefined,
      edadMinMeses: undefined,
      edadMaxMeses: undefined,
      ciudad: 'Cali',
      page: undefined,
    });
    expect(screen.getByLabelText('Especie')).toHaveValue('1');
    expect(screen.getByLabelText('Ciudad')).toHaveValue('Cali');
  });

  it('envía a la API el tamaño y el rango de edad válidos', async () => {
    listarMascotas.mockResolvedValue(pagina([mascota(1)]));
    await abrir({ tamano: 'grande', edadMin: '3', edadMax: '9' });
    expect(listarMascotas).toHaveBeenCalledWith(
      expect.objectContaining({ tamano: 'grande', edadMinMeses: 3, edadMaxMeses: 9 }),
    );
    expect(screen.getByLabelText('Tamaño')).toHaveValue('grande');
  });

  it('con el rango incoherente avisa y no consulta con ese rango', async () => {
    listarMascotas.mockResolvedValue(pagina([mascota(1)]));
    await abrir({ edadMin: '30', edadMax: '10' });
    expect(listarMascotas.mock.calls[0][0]).toMatchObject({
      edadMinMeses: undefined,
      edadMaxMeses: undefined,
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'La edad mínima no puede ser mayor que la máxima.',
    );
  });

  it('sin resultados muestra el mensaje del caso de uso y la acción de limpiar', async () => {
    listarMascotas.mockResolvedValue(pagina([], 0));
    await abrir({ tamano: 'grande' });
    expect(screen.getByRole('status')).toHaveTextContent('0 mascotas encontradas');
    expect(
      screen.getByRole('heading', { name: 'No hay mascotas con esos criterios' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ampliar la búsqueda/)).toBeInTheDocument();
    const limpiar = screen.getAllByRole('link', { name: 'Limpiar filtros' });
    expect(limpiar.length).toBeGreaterThan(0);
    expect(limpiar[0]).toHaveAttribute('href', '/adoptar');
  });

  it('pagina con enlaces que conservan los filtros', async () => {
    listarMascotas.mockResolvedValue(pagina([mascota(1)], 30, 2));
    await abrir({ tamano: 'grande', pagina: '2' });
    const nav = screen.getByRole('navigation', { name: 'Paginación' });
    expect(within(nav).getByText(/Página 2 de 3 · 30 resultados/)).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /Siguiente/ })).toHaveAttribute(
      'href',
      '/adoptar?tamano=grande&pagina=3',
    );
    expect(within(nav).getByRole('link', { name: /Anterior/ })).toHaveAttribute(
      'href',
      '/adoptar?tamano=grande',
    );
  });

  it('una página fuera de rango muestra la última con aviso', async () => {
    listarMascotas
      .mockResolvedValueOnce(pagina([], 30, 99))
      .mockResolvedValueOnce(pagina([mascota(1)], 30, 3));
    await abrir({ pagina: '99' });
    expect(listarMascotas.mock.calls[1][0]).toMatchObject({ page: 3 });
    expect(screen.getByText(/La página 99 no existe/)).toBeInTheDocument();
  });

  it('si fallan las especies el catálogo sigue y el filtro queda deshabilitado', async () => {
    listarEspecies.mockRejectedValue(new ErrorApi({ tipo: 'red', mensaje: 'x' }));
    listarMascotas.mockResolvedValue(pagina([mascota(1)]));
    await abrir();
    expect(screen.getByLabelText('Especie')).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Mascota 1' })).toBeInTheDocument();
  });

  it('si falla el catálogo propaga el error al error.tsx', async () => {
    listarMascotas.mockRejectedValue(new ErrorApi({ tipo: 'red', mensaje: 'x' }));
    await expect(CatalogoPage({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      tipo: 'red',
    });
  });
});

describe('error del catálogo', () => {
  it('muestra un texto amable y reintenta', async () => {
    const reset = vi.fn();
    render(<ErrorCatalogo error={new Error('boom interno')} reset={reset} />);
    expect(
      screen.getByRole('heading', { name: 'No pudimos cargar las mascotas' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/boom interno/)).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
