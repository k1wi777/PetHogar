import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '@/shared/api/errores';
import { fichaEjemplo } from '@/features/catalogo/prueba-datos';
import MascotaNoEncontrada from './not-found';
import FichaPage, { generateMetadata } from './page';

const obtenerFicha = vi.fn();
vi.mock('@/features/catalogo/api/mascotas', () => ({
  obtenerFicha: (...a: unknown[]) => obtenerFicha(...a),
}));

vi.mock('@/shared/auth/SesionProvider', () => ({
  useSesion: () => ({ estado: 'anonimo', usuario: null }),
}));

const props = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  obtenerFicha.mockReset();
});

describe('FichaPage', () => {
  it('renderiza galería, datos, historial y fundación', async () => {
    obtenerFicha.mockResolvedValue(fichaEjemplo());
    render(await FichaPage(props('5')));
    expect(screen.getByRole('heading', { level: 1, name: 'Luna' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Volver al catálogo/ })).toHaveAttribute(
      'href',
      '/adoptar',
    );
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Historial médico' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fundación responsable' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quiero adoptar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Descargar ficha/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/mascotas\/5\/ficha\.pdf$/),
    );
    expect(obtenerFicha).toHaveBeenCalledWith('5');
  });

  it('una mascota inexistente o no disponible provoca el 404', async () => {
    obtenerFicha.mockResolvedValue(null);
    await expect(FichaPage(props('999'))).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_HTTP_ERROR_FALLBACK;404'),
    });
  });

  it('un fallo de la API se propaga al error.tsx', async () => {
    obtenerFicha.mockRejectedValue(new ErrorApi({ tipo: 'red', mensaje: 'x' }));
    await expect(FichaPage(props('5'))).rejects.toMatchObject({ tipo: 'red' });
  });

  it('generateMetadata construye los metadatos o uno genérico si no existe', async () => {
    obtenerFicha.mockResolvedValueOnce(fichaEjemplo());
    await expect(generateMetadata(props('5'))).resolves.toMatchObject({
      title: 'Luna, perro en adopción — PetHogar',
    });
    obtenerFicha.mockResolvedValueOnce(null);
    await expect(generateMetadata(props('6'))).resolves.toEqual({ title: 'Mascota no encontrada' });
  });
});

describe('404 de la ficha', () => {
  it('es amable y vuelve al catálogo', () => {
    render(<MascotaNoEncontrada />);
    expect(
      screen.getByRole('heading', { name: 'No encontramos a esta mascota' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mascotas disponibles' })).toHaveAttribute(
      'href',
      '/adoptar',
    );
  });
});
