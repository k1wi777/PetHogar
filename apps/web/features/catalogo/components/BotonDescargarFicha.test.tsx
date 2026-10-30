import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotonDescargarFicha } from './BotonDescargarFicha';

afterEach(() => vi.unstubAllEnvs());

describe('BotonDescargarFicha', () => {
  it('es un enlace directo al PDF público de la API', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:53001/api/');
    render(<BotonDescargarFicha mascotaId={5} nombre="Luna" />);
    const enlace = screen.getByRole('link', { name: /Descargar ficha \(PDF\)/ });
    expect(enlace).toHaveAttribute('href', 'http://localhost:53001/api/mascotas/5/ficha.pdf');
    expect(enlace).toHaveAccessibleName('Descargar ficha (PDF) de Luna');
  });
});
