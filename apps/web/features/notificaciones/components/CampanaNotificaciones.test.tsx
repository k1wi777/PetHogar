import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CampanaNotificaciones, etiquetaNotificaciones } from './CampanaNotificaciones';

const contar = vi.hoisted(() => vi.fn());
vi.mock('../api/contar', () => ({ contarNoLeidas: contar }));
const sesion = vi.hoisted(() => ({ estado: 'autenticado' }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => ({ estado: sesion.estado }) }));

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CampanaNotificaciones href="/fundacion/notificaciones" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sesion.estado = 'autenticado';
});

describe('CampanaNotificaciones', () => {
  it('muestra el contador y lo incluye en el nombre accesible', async () => {
    contar.mockResolvedValue({ noLeidas: 3 });
    montar();
    const enlace = await screen.findByRole('link', { name: 'Notificaciones, 3 sin leer' });
    expect(enlace).toHaveAttribute('href', '/fundacion/notificaciones');
    expect(enlace).toHaveTextContent('3');
  });

  it('topa la burbuja en 99+ pero conserva la cantidad real en el nombre', async () => {
    contar.mockResolvedValue({ noLeidas: 250 });
    montar();
    const enlace = await screen.findByRole('link', { name: 'Notificaciones, 250 sin leer' });
    expect(enlace).toHaveTextContent('99+');
  });

  it('con cero no muestra burbuja', async () => {
    contar.mockResolvedValue({ noLeidas: 0 });
    montar();
    const enlace = await screen.findByRole('link', { name: 'Notificaciones, ninguna sin leer' });
    expect(enlace).not.toHaveTextContent(/\d/);
  });

  it('si el contador falla, muestra la campana sin cifra', async () => {
    contar.mockRejectedValue(new Error('caído'));
    montar();
    await waitFor(() => expect(contar).toHaveBeenCalled());
    const enlace = screen.getByRole('link', { name: 'Notificaciones' });
    expect(enlace).not.toHaveTextContent(/\d/);
  });

  it('sin sesión autenticada no consulta', () => {
    sesion.estado = 'anonimo';
    montar();
    expect(contar).not.toHaveBeenCalled();
  });

  it('etiquetaNotificaciones cubre los casos', () => {
    expect(etiquetaNotificaciones(undefined)).toBe('Notificaciones');
    expect(etiquetaNotificaciones(1)).toBe('Notificaciones, 1 sin leer');
  });
});
