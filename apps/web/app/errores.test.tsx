import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ErrorAdoptante from './(adoptante)/error';
import NoEncontradaAdoptante from './(adoptante)/not-found';
import ErrorAdministrador from './(administrador)/error';
import NoEncontradaAdministrador from './(administrador)/not-found';
import ErrorFundacion from './(fundacion)/error';
import NoEncontradaFundacion from './(fundacion)/not-found';
import ErrorGlobal from './global-error';
import ErrorRaiz from './error';
import NoEncontradaRaiz from './not-found';

const error = Object.assign(new Error('boom: stack secreto'), { digest: 'abc' });

describe.each([
  ['raíz', ErrorRaiz],
  ['adoptante', ErrorAdoptante],
  ['fundación', ErrorFundacion],
  ['administrador', ErrorAdministrador],
])('error.tsx (%s)', (_nombre, Componente) => {
  it('muestra un mensaje en español sin la pila y reintenta', async () => {
    const reset = vi.fn();
    render(<Componente error={error} reset={reset} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Algo salió mal' })).toBeInTheDocument();
    expect(screen.queryByText(/boom|stack/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/');
  });
});

describe.each([
  ['raíz', NoEncontradaRaiz],
  ['adoptante', NoEncontradaAdoptante],
  ['fundación', NoEncontradaFundacion],
  ['administrador', NoEncontradaAdministrador],
])('not-found.tsx (%s)', (_nombre, Componente) => {
  it('explica el 404 y ofrece volver al inicio', () => {
    render(<Componente />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/');
  });
});

describe('global-error', () => {
  it('trae su propio documento, un único h1 y reintenta', async () => {
    const reset = vi.fn();
    render(<ErrorGlobal error={error} reset={reset} />, {
      container: document.documentElement,
    });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByText(/boom|stack/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
