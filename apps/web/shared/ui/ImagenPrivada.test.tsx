import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel } from '@/shared/testing/prueba-utils';
import { ImagenPrivada } from './ImagenPrivada';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);

const crear = vi.fn(() => 'blob:foto');
const revocar = vi.fn();
beforeEach(() => {
  crear.mockClear();
  revocar.mockClear();
  URL.createObjectURL = crear;
  URL.revokeObjectURL = revocar;
});
const png = () =>
  new Response(new Uint8Array([137, 80, 78, 71]), {
    status: 200,
    headers: { 'Content-Type': 'image/png' },
  });

describe('ImagenPrivada', () => {
  it('muestra la foto autenticada y revoca el object URL al desmontar', async () => {
    const { llamadas, unmount } = montarPanel(
      <ImagenPrivada url="/api/fundacion/seguimientos/4/evidencias/9" alt="Foto 1 del reporte" />,
      () => png(),
    );
    const img = await screen.findByRole('img', { name: 'Foto 1 del reporte' });
    expect(img).toHaveAttribute('src', 'blob:foto');
    expect(llamadas('/fundacion/seguimientos/4/evidencias/9')).toHaveLength(1);
    unmount();
    expect(revocar).toHaveBeenCalledWith('blob:foto');
  });

  it('con 429 ofrece «Reintentar» y no reintenta sola', async () => {
    let falla = true;
    const { llamadas } = montarPanel(<ImagenPrivada url="/api/x/1" alt="Foto" />, () =>
      falla ? errorApi(429, 'Espera') : png(),
    );
    expect(await screen.findByText('No pudimos cargar la foto.')).toBeInTheDocument();
    expect(llamadas('/x/1')).toHaveLength(1);
    falla = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByRole('img', { name: 'Foto' })).toBeInTheDocument());
    expect(llamadas('/x/1')).toHaveLength(2);
  });

  it('una ruta inválida muestra el error sin petición', async () => {
    const { fetchImpl } = montarPanel(<ImagenPrivada url="https://evil.test/a" alt="Foto" />, () =>
      png(),
    );
    expect(await screen.findByText('No pudimos cargar la foto.')).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
