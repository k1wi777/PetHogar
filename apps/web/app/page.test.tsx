import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import InicioPage from '@/app/page';

describe('InicioPage', () => {
  it('muestra el encabezado y la descripción en español', () => {
    render(<InicioPage />);
    expect(screen.getByRole('heading', { name: 'PetHogar' })).toBeInTheDocument();
    expect(screen.getByText(/nuevo mejor amigo/)).toBeInTheDocument();
  });
});
