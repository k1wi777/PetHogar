import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { CampoContrasena } from './CampoContrasena';
import { IndicadorFortaleza } from './IndicadorFortaleza';

describe('IndicadorFortaleza', () => {
  it('lista los criterios con texto «Cumple»/«Falta», sin depender del color', () => {
    render(<IndicadorFortaleza contrasena="abc" />);
    expect(screen.getByText('Contraseña débil')).toBeInTheDocument();
    const lista = screen.getByRole('list', { name: 'Requisitos de la contraseña' });
    expect(lista).toHaveTextContent('Una letra minúscula: Cumple');
    expect(lista).toHaveTextContent('Una letra mayúscula: Falta');
    expect(lista).toHaveTextContent('Entre 8 y 64 caracteres: Falta');
  });

  it('el texto del nivel está en una región aria-live y cambia con la contraseña', () => {
    const { rerender } = render(<IndicadorFortaleza contrasena="" />);
    expect(screen.getByText('Escribe una contraseña')).toHaveAttribute('aria-live', 'polite');
    rerender(<IndicadorFortaleza contrasena="Abcdefghijk1" />);
    expect(screen.getByText('Contraseña fuerte')).toBeInTheDocument();
  });
});

function ContrasenaPrueba() {
  const { control } = useForm<{ contrasena: string }>({ defaultValues: { contrasena: '' } });
  return <CampoContrasena control={control} nombre="contrasena" conFortaleza />;
}

describe('CampoContrasena', () => {
  it('oculta por defecto y alterna con el botón (aria-pressed)', async () => {
    render(<ContrasenaPrueba />);
    const entrada = screen.getByLabelText(/Contraseña/, { selector: 'input' });
    expect(entrada).toHaveAttribute('type', 'password');
    expect(entrada).toHaveAttribute('autocomplete', 'new-password');
    const boton = screen.getByRole('button', { name: 'Mostrar' });
    expect(boton).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(boton);
    expect(entrada).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('el indicador sigue lo que se escribe', async () => {
    render(<ContrasenaPrueba />);
    await userEvent.type(screen.getByLabelText(/Contraseña/, { selector: 'input' }), 'Abcdefg1');
    expect(screen.getByText('Contraseña aceptable')).toBeInTheDocument();
  });
});
