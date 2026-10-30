import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montar, respuestaJson } from '../prueba-utils';
import { FormularioRegistroFundacion } from './FormularioRegistroFundacion';

vi.mock('@/shared/api/http', () =>
  import('../http-prueba').then((m) => ({ http: m.httpSimulado })),
);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/registro-fundacion',
}));
vi.mock('@/shared/ui/Toaster', () => ({
  aviso: { exito: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

const MENSAJE_EXITO =
  'Recibimos el registro de tu fundación. Un administrador revisará tu documento y te avisaremos cuando sea aprobada.';

beforeEach(() => {
  document.cookie = 'ph_rol=; Path=/; Max-Age=0';
  URL.createObjectURL = vi.fn(() => 'blob:v');
  URL.revokeObjectURL = vi.fn();
});

async function llenar(documento?: File) {
  const u = userEvent;
  await u.type(screen.getByLabelText(/Nombre de la fundación/), '  Patitas  ');
  await u.type(screen.getByLabelText(/NIT/), '900123456-7');
  await u.type(screen.getByLabelText(/Teléfono/), '3001234567');
  await u.type(screen.getByLabelText(/Dirección/), 'Calle 1');
  await u.type(screen.getByLabelText(/Ciudad/), 'Montería');
  await u.type(screen.getByLabelText(/Correo electrónico/), 'F@X.co');
  await u.type(screen.getByLabelText(/^Contraseña/, { selector: 'input' }), 'Clave1234');
  if (documento) {
    await u.upload(screen.getByLabelText(/Documento legal/), documento, { applyAccept: false });
  }
  await u.click(screen.getByRole('checkbox', { name: /política/ }));
}
const enviar = () => userEvent.click(screen.getByRole('button', { name: 'Enviar registro' }));
const pdf = () => new File(['%PDF-1.4'], 'camara.pdf', { type: 'application/pdf' });

describe('FormularioRegistroFundacion', () => {
  it('envía multipart con los campos y el archivo «documento» y muestra la revisión pendiente', async () => {
    const { llamadas } = montar(<FormularioRegistroFundacion />, () =>
      respuestaJson({ mensaje: MENSAJE_EXITO, estadoValidacion: 'pendiente' }, 201),
    );
    await llenar(pdf());
    await enviar();
    expect(
      await screen.findByRole('heading', { name: /Recibimos el registro/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Un administrador revisará tu documento');
    const [, init] = llamadas('/auth/register/fundacion')[0]!;
    const cuerpo = init!.body as FormData;
    expect(cuerpo).toBeInstanceOf(FormData);
    expect(cuerpo.get('nombre')).toBe('Patitas');
    expect(cuerpo.get('email')).toBe('f@x.co');
    expect(cuerpo.get('aceptaPoliticaDatos')).toBe('true');
    expect(cuerpo.has('descripcion')).toBe(false);
    expect((cuerpo.get('documento') as File).name).toBe('camara.pdf');
    expect((init!.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('un archivo inválido se rechaza con mensaje y el formulario no se envía', async () => {
    const { llamadas } = montar(<FormularioRegistroFundacion />, () => errorApi(500, 'x'));
    await llenar(new File(['x'], 'a.gif', { type: 'image/gif' }));
    expect(await screen.findByText('Solo se permiten archivos JPG, PNG o PDF')).toBeInTheDocument();
    await enviar();
    expect(await screen.findByText('Solo se permiten archivos JPG, PNG o PDF')).toBeInTheDocument();
    expect(llamadas('/auth/register')).toHaveLength(0);
  });

  it('un archivo de más de 5 MB no se envía', async () => {
    const { llamadas } = montar(<FormularioRegistroFundacion />, () => errorApi(500, 'x'));
    await llenar(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' }),
    );
    await enviar();
    expect(
      await screen.findByText('El archivo supera el tamaño máximo de 5 MB'),
    ).toBeInTheDocument();
    expect(llamadas('/auth/register')).toHaveLength(0);
  });

  it('sin documento pide adjuntarlo', async () => {
    const { llamadas } = montar(<FormularioRegistroFundacion />, () => errorApi(500, 'x'));
    await llenar();
    await enviar();
    expect(await screen.findByText('Debes adjuntar el documento legal')).toBeInTheDocument();
    expect(llamadas('/auth/register')).toHaveLength(0);
  });

  it('previsualiza la imagen elegida', async () => {
    montar(<FormularioRegistroFundacion />, () => errorApi(500, 'x'));
    await userEvent.upload(
      screen.getByLabelText(/Documento legal/),
      new File(['x'], 'acta.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('img', { name: /acta\.png/ })).toBeInTheDocument();
  });

  it('NIT duplicado (409): el mensaje queda junto al campo', async () => {
    montar(<FormularioRegistroFundacion />, () =>
      errorApi(409, 'Ya existe una fundación registrada con este NIT'),
    );
    await llenar(pdf());
    await enviar();
    await waitFor(() =>
      expect(screen.getByLabelText(/NIT/)).toHaveAccessibleDescription(
        /Ya existe una fundación registrada con este NIT/,
      ),
    );
  });

  it('un error del archivo devuelto por el servidor se muestra junto al documento', async () => {
    montar(<FormularioRegistroFundacion />, () =>
      errorApi(400, 'El contenido del archivo no corresponde a un JPG, PNG o PDF'),
    );
    await llenar(pdf());
    await enviar();
    await waitFor(() =>
      expect(screen.getByLabelText(/Documento legal/)).toHaveAccessibleDescription(
        /contenido del archivo/,
      ),
    );
  });
});
