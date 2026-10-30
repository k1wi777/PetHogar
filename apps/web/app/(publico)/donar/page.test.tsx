import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Pagina from './page';

describe('página pública /donar', () => {
  it('explica los pasos, avisa que no hay pagos y lleva al catálogo sin sesión', () => {
    render(<Pagina />);
    expect(screen.getByRole('heading', { level: 1, name: 'Cómo donar' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('PetHogar no procesa pagos');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('link', { name: /Ver mascotas y fundaciones/ })).toHaveAttribute(
      'href',
      '/adoptar',
    );
  });
});
