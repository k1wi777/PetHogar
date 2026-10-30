import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { adopcion, seguimiento } from '../prueba-datos';
import { ListaAdopciones } from './ListaAdopciones';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push }),
  usePathname: () => '/adoptante/adopciones',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
vi.mock('@/shared/auth/SesionProvider', () => ({
  useSesion: () => ({ estado: 'autenticado', usuario: null }),
}));

beforeEach(() => push.mockClear());
const pagina = (data: unknown[], total = data.length) =>
  respuestaJson({ total, page: 1, limit: 10, data });

describe('ListaAdopciones', () => {
  it('muestra mascota, fundación, entrega, estado y seguimientos', async () => {
    montarPanel(<ListaAdopciones />, () =>
      pagina([
        adopcion({
          seguimientos: [
            seguimiento({ id: 1, estado: 'programado' }),
            seguimiento({
              id: 2,
              tipo: 'visita',
              estado: 'realizado',
              fechaRealizada: '2026-12-01',
            }),
          ],
        }),
      ]),
    );
    const lista = await screen.findByRole('list', { name: 'Adopciones' });
    expect(lista).toHaveTextContent('Luna');
    expect(lista).toHaveTextContent('Patitas (Montería)');
    expect(lista).toHaveTextContent('Entregada el 20 de noviembre de 2026');
    expect(lista).toHaveTextContent('Activa');
    expect(lista).toHaveTextContent('Visita · fecha límite 15 de diciembre de 2026');
    expect(lista).toHaveTextContent('Realizado el 1 de diciembre de 2026');
    // Solo el reporte pendiente ofrece «Enviar reporte».
    const enlaces = screen.getAllByRole('link', { name: 'Enviar reporte' });
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0]).toHaveAttribute('href', '/adoptante/adopciones/seguimientos/1');
  });

  it('el vencido se destaca con texto «Vencido» e icono, también si la API lo marca por fecha', async () => {
    montarPanel(<ListaAdopciones />, () =>
      pagina([
        adopcion({ seguimientos: [seguimiento({ id: 3, estado: 'programado', vencido: true })] }),
      ]),
    );
    // El último `li` que contiene el texto es la fila del seguimiento (el anterior es la tarjeta).
    const fila = (await screen.findAllByRole('listitem'))
      .filter((li) => li.textContent?.includes('Venció el'))
      .at(-1)!;
    expect(within(fila).getByText('Vencido')).toBeInTheDocument();
    expect(fila).toHaveTextContent('Venció el 15 de diciembre de 2026');
    expect(fila.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(fila.className).toContain('border-l-8');
    expect(within(fila).getByRole('link', { name: 'Enviar reporte' })).toBeInTheDocument();
  });

  it('un seguimiento programado a tiempo no se marca como vencido', async () => {
    montarPanel(<ListaAdopciones />, () => pagina([adopcion()]));
    await screen.findByRole('list', { name: 'Adopciones' });
    expect(screen.queryByText('Vencido')).toBeNull();
    expect(screen.queryByText(/Venció el/)).toBeNull();
  });

  it('avisa cuando llegan los 20 seguimientos más recientes', async () => {
    const veinte = Array.from({ length: 20 }, (_, i) => seguimiento({ id: i + 1 }));
    montarPanel(<ListaAdopciones />, () => pagina([adopcion({ seguimientos: veinte })]));
    expect(await screen.findByText('Mostramos los 20 más recientes.')).toBeInTheDocument();
  });

  it('una adopción cerrada muestra el motivo', async () => {
    montarPanel(<ListaAdopciones />, () =>
      pagina([adopcion({ estado: 'revocada', motivoCierre: 'Incumplimiento', seguimientos: [] })]),
    );
    expect(await screen.findByText('Incumplimiento')).toBeInTheDocument();
    expect(screen.getByText('Aún no hay seguimientos programados.')).toBeInTheDocument();
  });

  it('estado vacío con acción siguiente', async () => {
    montarPanel(<ListaAdopciones />, () => pagina([]));
    expect(await screen.findByText('Aún no tienes adopciones')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mascotas en adopción' })).toHaveAttribute(
      'href',
      '/adoptar',
    );
  });

  it('error de la API con «Reintentar»', async () => {
    montarPanel(<ListaAdopciones />, () => errorApi(500, 'Algo salió mal de nuestro lado.'));
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  describe('acta firmada', () => {
    const URL_ACTA = '/api/mis-adopciones/1/acta';
    let enlaces: HTMLAnchorElement[] = [];
    beforeEach(() => {
      enlaces = [];
      URL.createObjectURL = vi.fn(() => 'blob:acta');
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        enlaces.push(this);
      });
    });

    it('sin acta no ofrece descarga', async () => {
      montarPanel(<ListaAdopciones />, () => pagina([adopcion()]));
      await screen.findByRole('list', { name: 'Adopciones' });
      expect(screen.queryByRole('button', { name: /Descargar acta/ })).toBeNull();
    });

    it('con acta la descarga con la sesión, también en adopciones cerradas', async () => {
      const { llamadas } = montarPanel(<ListaAdopciones />, (ruta) =>
        ruta.startsWith('/mis-adopciones/1/acta')
          ? new Response(new Uint8Array([37, 80, 68, 70]), {
              status: 200,
              headers: { 'Content-Type': 'application/pdf' },
            })
          : pagina([adopcion({ estado: 'finalizada', acta: { url: URL_ACTA } })]),
      );
      await userEvent.click(await screen.findByRole('button', { name: 'Descargar acta de Luna' }));
      await screen.findByText(/acta-adopcion-1\.pdf/);
      expect(llamadas('/mis-adopciones/1/acta', 'GET')).toHaveLength(1);
      expect(enlaces[0]?.download).toBe('acta-adopcion-1.pdf');
    });

    it('un 404 se explica junto al botón', async () => {
      montarPanel(<ListaAdopciones />, (ruta) =>
        ruta.startsWith('/mis-adopciones/1/acta')
          ? errorApi(404, 'No existe')
          : pagina([adopcion({ acta: { url: URL_ACTA } })]),
      );
      await userEvent.click(await screen.findByRole('button', { name: 'Descargar acta de Luna' }));
      expect(await screen.findByText('Este archivo ya no está disponible.')).toBeInTheDocument();
    });
  });
});
