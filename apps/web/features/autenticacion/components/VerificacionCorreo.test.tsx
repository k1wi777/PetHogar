import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { cuerpoJson, errorApi, montar, respuestaJson } from '../prueba-utils';
import { VerificacionCorreo } from './VerificacionCorreo';

vi.mock('@/shared/api/http', () =>
  import('../http-prueba').then((m) => ({ http: m.httpSimulado })),
);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/verificar-correo',
}));
vi.mock('@/shared/ui/Toaster', () => ({
  aviso: { exito: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

describe('VerificacionCorreo', () => {
  it('confirma el correo con el token de la URL y enlaza a /ingresar', async () => {
    const { llamadas } = montar(<VerificacionCorreo token="abc123" />, () =>
      respuestaJson({ mensaje: 'Correo verificado' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Un momento');
    expect(
      await screen.findByRole('heading', { name: 'Tu correo quedó verificado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a ingresar' })).toHaveAttribute(
      'href',
      '/ingresar',
    );
    expect(llamadas('/auth/verify-email')).toHaveLength(1);
    expect(llamadas('/auth/verify-email')[0]![0]).toContain('token=abc123');
  });

  it('token inválido o vencido: muestra el error del servidor y permite pedir un enlace nuevo', async () => {
    const { llamadas } = montar(<VerificacionCorreo token="vencido" />, (ruta) =>
      ruta.startsWith('/auth/verify-email/resend')
        ? respuestaJson({ mensaje: 'Te enviaremos un nuevo enlace.' })
        : errorApi(400, 'El enlace de verificación no es válido o ya venció. Solicita uno nuevo.'),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('ya venció');
    await userEvent.type(screen.getByLabelText(/Correo electrónico/), 'Ana@Correo.co');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar un enlace nuevo' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Te enviaremos un nuevo enlace.');
    expect(cuerpoJson(llamadas('/auth/verify-email/resend')[0]!)).toEqual({
      email: 'ana@correo.co',
    });
  });

  it('sin token no llama al servidor y ofrece un enlace nuevo', () => {
    const { llamadas } = montar(<VerificacionCorreo />, () => errorApi(500, 'x'));
    expect(screen.getByRole('alert')).toHaveTextContent('El enlace de verificación no es válido');
    expect(llamadas('/auth/verify-email')).toHaveLength(0);
  });
});
