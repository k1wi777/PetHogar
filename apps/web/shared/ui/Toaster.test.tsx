import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Toaster, aviso } from './Toaster';

describe('Toaster', () => {
  it('anuncia los avisos en una región aria-live en español', async () => {
    render(<Toaster />);
    act(() => {
      aviso.exito('Solicitud cancelada.');
    });
    expect(await screen.findByText('Solicitud cancelada.')).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Avisos' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(await screen.findByRole('button', { name: 'Cerrar aviso' })).toBeInTheDocument();
  });
});
