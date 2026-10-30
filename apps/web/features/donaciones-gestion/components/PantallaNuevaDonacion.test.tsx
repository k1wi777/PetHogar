import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { usuarioFundacion } from '@/shared/testing/prueba-utils';
import { PantallaNuevaDonacion } from './PantallaNuevaDonacion';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

function ver(u = usuarioFundacion('aprobada')) {
  sesion.valor = { estado: 'autenticado', usuario: u, refrescarPerfil: vi.fn() };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PantallaNuevaDonacion />
    </QueryClientProvider>,
  );
}

describe('PantallaNuevaDonacion', () => {
  it('muestra el aviso de que PetHogar no procesa pagos y el formulario', () => {
    ver();
    expect(screen.getByRole('note')).toHaveTextContent('PetHogar no procesa pagos');
    expect(screen.getByLabelText(/Nombre del donante/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Volver a donaciones/ })).toHaveAttribute(
      'href',
      '/fundacion/donaciones',
    );
  });
  it('con la fundación rechazada muestra el motivo y no el formulario', () => {
    ver(usuarioFundacion('rechazada', 'Falta el RUT'));
    expect(screen.getByText(/Falta el RUT/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nombre del donante/)).toBeNull();
  });
});
