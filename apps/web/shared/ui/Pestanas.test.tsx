import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Pestanas } from './Pestanas';

function Demo() {
  const [valor, setValor] = useState('a');
  return (
    <Pestanas
      etiqueta="Secciones"
      valor={valor}
      onCambio={setValor}
      pestanas={[
        { valor: 'a', etiqueta: 'Datos', contenido: <p>contenido a</p> },
        { valor: 'b', etiqueta: 'Fotos', contenido: <p>contenido b</p> },
      ]}
    />
  );
}

describe('Pestanas', () => {
  it('expone tablist/tab/tabpanel y solo monta el panel activo', () => {
    render(<Demo />);
    expect(screen.getByRole('tablist', { name: 'Secciones' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Datos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('contenido a');
    expect(screen.queryByText('contenido b')).toBeNull();
  });

  it('cambia con el teclado (flecha derecha) y con clic', async () => {
    const u = userEvent.setup();
    render(<Demo />);
    screen.getByRole('tab', { name: 'Datos' }).focus();
    await u.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Fotos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('contenido b');
    await u.click(screen.getByRole('tab', { name: 'Datos' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('contenido a');
  });
});
