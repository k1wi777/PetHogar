import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DialogoConfirmacion } from './DialogoConfirmacion';

function Prueba() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button onClick={() => setAbierto(true)}>Abrir</button>
      <DialogoConfirmacion
        abierto={abierto}
        onAbiertoChange={setAbierto}
        titulo="¿Seguro?"
        descripcion="Detalle"
        onConfirmar={() => setAbierto(false)}
      />
    </>
  );
}

describe('DialogoConfirmacion', () => {
  it('atrapa el foco y Escape lo devuelve a quien abrió el diálogo', async () => {
    render(<Prueba />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialogo = await screen.findByRole('dialog');
    for (let i = 0; i < 4; i++) {
      await userEvent.tab();
      expect(dialogo.contains(document.activeElement)).toBe(true);
    }
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus());
  });
});
