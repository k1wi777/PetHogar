import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorApi,
  montarPanel,
  respuestaJson,
  usuarioFundacion,
} from '@/shared/testing/prueba-utils';
import { adopcion, pagina } from '../prueba-datos';
import { PantallaAdopciones } from './PantallaAdopciones';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/fundacion/adopciones',
}));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

let enlaces: HTMLAnchorElement[] = [];
beforeEach(() => {
  sesion.valor = {
    estado: 'autenticado',
    usuario: usuarioFundacion('aprobada'),
    refrescarPerfil: vi.fn(),
    cerrarSesion: vi.fn(),
  };
  enlaces = [];
  URL.createObjectURL = vi.fn(() => 'blob:acta');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    enlaces.push(this);
  });
});

const pdf = (bytes = 8) =>
  new File([new Uint8Array(bytes)], 'acta.pdf', { type: 'application/pdf' });
const URL_ACTA = '/api/fundacion/adopciones/1/acta';

describe('acta firmada de la adopción', () => {
  it('sin acta y activa: lo dice y ofrece «Subir acta» (sin botón de descarga)', async () => {
    montarPanel(<PantallaAdopciones />, () => respuestaJson(pagina([adopcion()])));
    expect(await screen.findByText('Aún no hay acta firmada.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir acta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Descargar acta' })).toBeNull();
  });

  it('sube el acta como multipart con el campo `acta` y enfoca la descarga', async () => {
    let subida: FormData | null = null;
    let hay = false;
    const { llamadas } = montarPanel(<PantallaAdopciones />, (ruta, init) => {
      if (init?.method === 'POST') {
        subida = init.body as FormData;
        hay = true;
        return respuestaJson(adopcion({ acta: { url: URL_ACTA } }), 201);
      }
      return respuestaJson(pagina([adopcion({ acta: hay ? { url: URL_ACTA } : null })]));
    });
    const campo = await screen.findByLabelText(/Acta firmada/, { selector: 'input' });
    await userEvent.upload(campo, pdf());
    await userEvent.click(screen.getByRole('button', { name: 'Subir acta' }));
    await waitFor(() => expect(llamadas('/fundacion/adopciones/1/acta', 'POST')).toHaveLength(1));
    expect((subida as unknown as FormData).getAll('acta')).toHaveLength(1);
    const descargar = await screen.findByRole('button', { name: 'Descargar acta' });
    await waitFor(() => expect(descargar).toHaveFocus());
    expect(screen.getByText('Acta guardada.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reemplazar acta' })).toBeInTheDocument();
  });

  it.each([
    [
      'tipo no permitido',
      new File([new Uint8Array(8)], 'acta.gif', { type: 'image/gif' }),
      'Solo se permiten archivos JPG, PNG o PDF',
    ],
    ['más de 5 MB', pdf(5 * 1024 * 1024 + 1), 'El archivo supera el tamaño máximo de 5 MB'],
  ])('valida %s antes de enviar', async (_n, archivo, mensaje) => {
    const { llamadas } = montarPanel(<PantallaAdopciones />, () =>
      respuestaJson(pagina([adopcion()])),
    );
    const campo = await screen.findByLabelText(/Acta firmada/, { selector: 'input' });
    await userEvent.upload(campo, archivo, { applyAccept: false });
    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Subir acta' }));
    // El archivo inválido no queda seleccionado: enviar sin archivo no llama a la API.
    await waitFor(() =>
      expect(screen.getByLabelText(/Acta firmada/, { selector: 'input' })).toHaveAttribute(
        'aria-invalid',
        'true',
      ),
    );
    expect(llamadas('/fundacion/adopciones/1/acta', 'POST')).toHaveLength(0);
  });

  it.each([
    [400, 'El archivo no es un PDF, JPG o PNG válido'],
    [413, 'El archivo supera el tamaño máximo de 5 MB'],
  ])('el %i del servidor se muestra junto al campo', async (estado, mensaje) => {
    montarPanel(<PantallaAdopciones />, (ruta, init) =>
      init?.method === 'POST' ? errorApi(estado, mensaje) : respuestaJson(pagina([adopcion()])),
    );
    const campo = await screen.findByLabelText(/Acta firmada/, { selector: 'input' });
    await userEvent.upload(campo, pdf());
    await userEvent.click(screen.getByRole('button', { name: 'Subir acta' }));
    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
  });

  it('409: explica que la adopción ya está cerrada y no cierra la sesión', async () => {
    montarPanel(<PantallaAdopciones />, (ruta, init) =>
      init?.method === 'POST'
        ? errorApi(409, 'La adopción ya está cerrada y no admite un acta nueva')
        : respuestaJson(pagina([adopcion()])),
    );
    const campo = await screen.findByLabelText(/Acta firmada/, { selector: 'input' });
    await userEvent.upload(campo, pdf());
    await userEvent.click(screen.getByRole('button', { name: 'Subir acta' }));
    expect(await screen.findByText(/ya no se puede cambiar el acta/)).toBeInTheDocument();
    expect(sesion.valor.cerrarSesion).not.toHaveBeenCalled();
  });

  it('con acta ofrece descargar (autenticada, ruta sin /api) y reemplazar', async () => {
    const { llamadas } = montarPanel(<PantallaAdopciones />, (ruta) =>
      ruta.startsWith('/fundacion/adopciones/1/acta')
        ? new Response(new Uint8Array([137, 80, 78, 71]), {
            status: 200,
            headers: { 'Content-Type': 'image/png' },
          })
        : respuestaJson(pagina([adopcion({ acta: { url: URL_ACTA } })])),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar acta' }));
    await screen.findByText(/acta-adopcion-1\.png/);
    expect(llamadas('/fundacion/adopciones/1/acta', 'GET')).toHaveLength(1);
    expect(enlaces[0]?.download).toBe('acta-adopcion-1.png');
    expect(screen.getByRole('button', { name: 'Reemplazar acta' })).toBeInTheDocument();
  });

  it('un 404 al descargar se explica junto al botón', async () => {
    montarPanel(<PantallaAdopciones />, (ruta) =>
      ruta.startsWith('/fundacion/adopciones/1/acta')
        ? errorApi(404, 'No existe')
        : respuestaJson(pagina([adopcion({ acta: { url: URL_ACTA } })])),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Descargar acta' }));
    expect(await screen.findByText('Este archivo ya no está disponible.')).toBeInTheDocument();
  });

  it('con la adopción cerrada se puede descargar pero no subir ni reemplazar', async () => {
    montarPanel(<PantallaAdopciones />, () =>
      respuestaJson(pagina([adopcion({ estado: 'finalizada', acta: { url: URL_ACTA } })])),
    );
    const tarjeta = await screen.findByRole('article', { name: /Luna/ });
    expect(within(tarjeta).getByRole('button', { name: 'Descargar acta' })).toBeInTheDocument();
    expect(
      within(tarjeta).queryByRole('button', { name: /Subir acta|Reemplazar acta/ }),
    ).toBeNull();
    expect(within(tarjeta).queryByLabelText(/Acta firmada/, { selector: 'input' })).toBeNull();
    expect(tarjeta).toHaveTextContent('Ya no se puede cambiar el acta de una adopción cerrada.');
  });

  it('cerrada sin acta lo dice', async () => {
    montarPanel(<PantallaAdopciones />, () =>
      respuestaJson(pagina([adopcion({ estado: 'revocada' })])),
    );
    expect(await screen.findByText('Esta adopción se cerró sin acta firmada.')).toBeInTheDocument();
  });
});
