import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import InicioPage, { metadata } from '@/app/(publico)/page';

describe('InicioPage', () => {
  it('muestra el encabezado y la propuesta de valor en español', () => {
    render(<InicioPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'PetHogar' })).toBeInTheDocument();
    expect(screen.getByText(/nuevo mejor amigo/)).toBeInTheDocument();
    for (const paso of ['Encuentra', 'Adopta', 'Haz seguimiento']) {
      expect(screen.getByRole('heading', { name: paso })).toBeInTheDocument();
    }
  });

  it('ofrece accesos a Adoptar, Donar e Ingresar', () => {
    render(<InicioPage />);
    expect(screen.getByRole('link', { name: 'Adoptar' })).toHaveAttribute('href', '/adoptar');
    expect(screen.getByRole('link', { name: 'Donar' })).toHaveAttribute('href', '/adoptante/donar');
    expect(screen.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/ingresar');
  });

  it('no inventa cifras y tiene título propio', () => {
    const { container } = render(<InicioPage />);
    expect(container.textContent).not.toMatch(/\d/);
    expect(metadata.title).toMatch(/PetHogar/);
  });
});
