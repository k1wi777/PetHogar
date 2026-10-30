import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel } from '@/shared/testing/prueba-utils';
import { BotonDescarga } from './BotonDescarga';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);

const crear = vi.fn(() => 'blob:abc');
const revocar = vi.fn();
let enlaces: HTMLAnchorElement[] = [];

beforeEach(() => {
  crear.mockClear();
  revocar.mockClear();
  URL.createObjectURL = crear;
  URL.revokeObjectURL = revocar;
  enlaces = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    enlaces.push(this);
  });
});

const png = () =>
  new Response(new Uint8Array([137, 80, 78, 71]), {
    status: 200,
    headers: { 'Content-Type': 'image/png' },
  });

describe('BotonDescarga', () => {
  it('descarga con la ruta sin /api, nombra por tipo y revoca el objeto', async () => {
    const { llamadas } = montarPanel(
      <BotonDescarga
        url="/api/fundacion/donaciones/7/comprobante"
        nombreBase="comprobante-donacion-7"
        etiqueta="Descargar comprobante"
      />,
      () => png(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Descargar comprobante' }));
    await screen.findByText(/comprobante-donacion-7\.png/);
    expect(llamadas('/fundacion/donaciones/7/comprobante')).toHaveLength(1);
    expect(enlaces[0]?.download).toBe('comprobante-donacion-7.png');
    expect(enlaces[0]?.href).toBe('blob:abc');
    await waitFor(() => expect(revocar).toHaveBeenCalledWith('blob:abc'));
  });

  it('un enlace que no es de la API no lanza ninguna petición', async () => {
    const { fetchImpl } = montarPanel(
      <BotonDescarga url="https://evil.test/x" nombreBase="a" etiqueta="Descargar" />,
      () => png(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/enlace recibido no es válido/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('404 y 429 muestran un mensaje junto al botón y permiten reintentar', async () => {
    let estado = 404;
    montarPanel(<BotonDescarga url="/api/x/1" nombreBase="a" etiqueta="Descargar" />, () =>
      estado === 404 ? errorApi(404, 'No existe') : png(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este archivo ya no está disponible.',
    );
    estado = 200;
    await userEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    await screen.findByText(/Listo: guardamos/);
  });

  it('429 muestra el mensaje del servidor', async () => {
    montarPanel(<BotonDescarga url="/api/x/1" nombreBase="a" etiqueta="Descargar" />, () =>
      errorApi(429, 'Demasiadas descargas, espera un minuto'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiadas descargas');
  });

  it('envía la consulta como parámetros y no relaja la regla de la ruta', async () => {
    const { llamadas } = montarPanel(
      <BotonDescarga
        url="/api/fundacion/reportes/donaciones.pdf"
        nombreBase="reporte-donaciones"
        etiqueta="Descargar PDF"
        consulta={{ desde: '2026-10-01', hasta: '2026-10-31', vacio: undefined }}
      />,
      () => png(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await screen.findByText(/reporte-donaciones\./);
    const [url] = llamadas('/fundacion/reportes/donaciones.pdf')[0]!;
    expect(url).toContain('desde=2026-10-01');
    expect(url).toContain('hasta=2026-10-31');
    expect(url).not.toContain('vacio');
  });

  it('una URL con «?» sigue rechazándose aunque haya consulta', async () => {
    const { fetchImpl } = montarPanel(
      <BotonDescarga
        url="/api/fundacion/reportes/donaciones.pdf?desde=2026-10-01"
        nombreBase="a"
        etiqueta="Descargar"
        consulta={{ desde: '2026-10-01' }}
      />,
      () => png(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/enlace recibido no es válido/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
