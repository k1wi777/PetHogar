import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import KitPage from './page';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

describe('/_kit', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('en desarrollo renderiza todos los componentes', () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(<KitPage />);
    for (const t of [
      'Botones',
      'Campos y selector',
      'Diálogo de confirmación y avisos',
      'Tabla y paginación',
      'Badges de estado',
      'Tarjeta de mascota',
      'Carga y estado vacío',
    ]) {
      expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { name: 'Luna' })).toBeInTheDocument();
  });

  it('en producción responde 404', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => render(<KitPage />)).toThrow('NEXT_NOT_FOUND');
  });
});
