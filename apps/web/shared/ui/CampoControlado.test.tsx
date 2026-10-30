import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { CampoControlado } from './CampoControlado';

function Formulario() {
  const { control, handleSubmit } = useForm<{ nombre: string }>({
    defaultValues: { nombre: '' },
    mode: 'onTouched',
  });
  return (
    <form onSubmit={handleSubmit(() => undefined)} noValidate>
      <CampoControlado control={control} nombre="nombre" etiqueta="Nombre" requerido />
      <button type="submit">Enviar</button>
    </form>
  );
}

describe('CampoControlado', () => {
  it('asocia etiqueta y valor al control', async () => {
    render(<Formulario />);
    const entrada = screen.getByLabelText(/Nombre/);
    await userEvent.type(entrada, 'Ana');
    expect(entrada).toHaveValue('Ana');
    expect(entrada).toHaveAttribute('aria-required', 'true');
  });

  it('muestra el error del formulario asociado con aria-describedby', async () => {
    function ConError() {
      const { control, setError } = useForm<{ nombre: string }>({ defaultValues: { nombre: '' } });
      return (
        <>
          <CampoControlado control={control} nombre="nombre" etiqueta="Nombre" />
          <button onClick={() => setError('nombre', { message: 'Falta el nombre' })}>Fallar</button>
        </>
      );
    }
    render(<ConError />);
    await userEvent.click(screen.getByText('Fallar'));
    const entrada = screen.getByLabelText('Nombre');
    await waitFor(() => expect(entrada).toHaveAttribute('aria-invalid', 'true'));
    expect(entrada).toHaveAccessibleDescription('Falta el nombre');
  });
});
