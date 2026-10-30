import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorApi, montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { MASCOTA, detalle } from '../prueba-datos';
import { FormularioSolicitud } from './FormularioSolicitud';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
vi.mock('@/shared/auth/SesionProvider', () => ({
  useSesion: () => ({ estado: 'autenticado', usuario: null }),
}));

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:v');
  URL.revokeObjectURL = vi.fn();
});

const pdf = () => new File(['%PDF-1.4'], 'firmado.pdf', { type: 'application/pdf' });

async function llenar({ archivo = pdf() as File | null } = {}) {
  await userEvent.type(screen.getByLabelText(/¿Por qué quieres adoptar\?/), '  Tengo patio  ');
  await userEvent.click(screen.getByRole('radio', { name: 'Casa' }));
  await userEvent.click(screen.getByRole('radio', { name: 'No' }));
  if (archivo) {
    await userEvent.upload(screen.getByLabelText(/Formulario de adopción firmado/), archivo, {
      applyAccept: false,
    });
  }
}
const revisar = () => userEvent.click(screen.getByRole('button', { name: 'Revisar mi solicitud' }));
const confirmar = () => userEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar' }));

describe('FormularioSolicitud', () => {
  it('muestra la mascota, la fundación y el enlace a la plantilla', () => {
    montarPanel(<FormularioSolicitud mascota={MASCOTA} />, () => respuestaJson({}));
    expect(screen.getByRole('heading', { name: /adoptar a Luna/ })).toBeInTheDocument();
    expect(screen.getByText('Patitas')).toBeInTheDocument();
    const plantilla = screen.getByRole('link', { name: /Descargar plantilla \(PDF\)/ });
    expect(plantilla).toHaveAttribute('href', '/plantillas/formulario-adopcion-pethogar-v1.pdf');
    expect(plantilla).toHaveAttribute('download');
    expect(screen.getByText(/su propio formato/)).toBeInTheDocument();
  });

  it('señala junto a cada campo lo que falta y no llama a la API', async () => {
    const { llamadas } = montarPanel(<FormularioSolicitud mascota={MASCOTA} />, () =>
      respuestaJson({}),
    );
    await revisar();
    expect(await screen.findByText('El motivo es obligatorio')).toBeInTheDocument();
    expect(
      screen.getByText('El tipo de vivienda debe ser casa, apartamento o finca'),
    ).toBeInTheDocument();
    expect(screen.getByText('Indica si tienes otras mascotas')).toBeInTheDocument();
    expect(screen.getByText('Debes adjuntar el formulario firmado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar y enviar' })).toBeNull();
    expect(llamadas('/solicitudes')).toHaveLength(0);
  });

  it('cuenta los caracteres del motivo', async () => {
    montarPanel(<FormularioSolicitud mascota={MASCOTA} />, () => respuestaJson({}));
    await userEvent.type(screen.getByLabelText(/¿Por qué quieres adoptar\?/), 'hola');
    expect(screen.getByText('4 de 500 caracteres')).toBeInTheDocument();
  });

  it('un archivo inválido se rechaza al elegirlo y no queda seleccionado', async () => {
    montarPanel(<FormularioSolicitud mascota={MASCOTA} />, () => respuestaJson({}));
    await llenar({ archivo: null });
    await userEvent.upload(
      screen.getByLabelText(/Formulario de adopción firmado/),
      new File(['x'], 'a.gif', { type: 'image/gif' }),
      { applyAccept: false },
    );
    expect(await screen.findByText('Solo se permiten archivos JPG, PNG o PDF')).toBeInTheDocument();
    await revisar();
    // Sigue visible el motivo del rechazo y no se pasa al resumen: no hay archivo seleccionado.
    expect(screen.getByText('Solo se permiten archivos JPG, PNG o PDF')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar y enviar' })).toBeNull();
  });

  it('muestra el resumen, permite volver a editar sin perder datos y solo envía al confirmar', async () => {
    const { llamadas } = montarPanel(<FormularioSolicitud mascota={MASCOTA} />, () =>
      respuestaJson(detalle(), 201),
    );
    await llenar();
    await revisar();
    const resumen = await screen.findByRole('region', { name: /Revisa tu solicitud/ });
    expect(resumen).toHaveTextContent('Luna (Patitas)');
    expect(resumen).toHaveTextContent('Tengo patio');
    expect(resumen).toHaveTextContent('Casa');
    expect(resumen).toHaveTextContent('firmado.pdf');
    expect(llamadas('/solicitudes')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Volver a editar' }));
    expect(screen.getByLabelText(/¿Por qué quieres adoptar\?/)).toHaveValue('  Tengo patio  ');
    expect(screen.getByRole('radio', { name: 'Casa' })).toBeChecked();
    expect(screen.getByText('firmado.pdf')).toBeInTheDocument();

    await revisar();
    await confirmar();
    expect(
      await screen.findByRole('heading', { name: 'Enviamos tu solicitud' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a mis solicitudes' })).toHaveAttribute(
      'href',
      '/adoptante/solicitudes',
    );
    const envios = llamadas('/solicitudes', 'POST');
    expect(envios).toHaveLength(1);
    const cuerpo = envios[0]![1]!.body as FormData;
    expect(cuerpo.get('mascotaId')).toBe('7');
    expect(cuerpo.get('motivo')).toBe('Tengo patio');
    expect(cuerpo.get('tipoVivienda')).toBe('casa');
    expect(cuerpo.get('tieneOtrasMascotas')).toBe('false');
    expect((cuerpo.get('formulario') as File).name).toBe('firmado.pdf');
  });

  it('no permite un doble envío mientras la solicitud está en curso', async () => {
    let liberar: (r: Response) => void = () => undefined;
    const { llamadas } = montarPanel(
      <FormularioSolicitud mascota={MASCOTA} />,
      () => new Promise<Response>((resolver) => (liberar = resolver)),
    );
    await llenar();
    await revisar();
    await confirmar();
    expect(screen.getByRole('button', { name: 'Confirmar y enviar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Volver a editar' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar' }));
    expect(llamadas('/solicitudes', 'POST')).toHaveLength(1);
    liberar(respuestaJson(detalle(), 201));
    expect(await screen.findByText('Enviamos tu solicitud')).toBeInTheDocument();
  });

  it('409 por solicitud activa explica el motivo y enlaza a «Mis solicitudes»', async () => {
    montarPanel(<FormularioSolicitud mascota={MASCOTA} />, () =>
      errorApi(409, 'Ya tienes una solicitud activa para esta mascota'),
    );
    await llenar();
    await revisar();
    await confirmar();
    expect(
      await screen.findByRole('heading', { name: 'Ya tienes una solicitud para esta mascota' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a mis solicitudes' })).toHaveAttribute(
      'href',
      '/adoptante/solicitudes',
    );
    expect(screen.queryByRole('button', { name: 'Confirmar y enviar' })).toBeNull();
  });

  it.each([
    [409, 'La mascota ya no está disponible para adopción'],
    [404, 'La mascota no existe'],
    [403, 'No puedes solicitar una mascota de tu propia fundación'],
  ])(
    '%i «%s» muestra que la mascota no está disponible y vuelve al catálogo',
    async (estado, mensaje) => {
      montarPanel(<FormularioSolicitud mascota={MASCOTA} />, () => errorApi(estado, mensaje));
      await llenar();
      await revisar();
      await confirmar();
      expect(
        await screen.findByRole('heading', { name: 'Esta mascota ya no está disponible' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ver otras mascotas' })).toHaveAttribute(
        'href',
        '/adoptar',
      );
    },
  );

  it('un 400 del archivo vuelve al formulario con el error junto al campo', async () => {
    montarPanel(<FormularioSolicitud mascota={MASCOTA} />, () =>
      errorApi(400, 'El archivo no es un PDF, JPG o PNG válido'),
    );
    await llenar();
    await revisar();
    await confirmar();
    await waitFor(() =>
      expect(screen.getByText('El archivo no es un PDF, JPG o PNG válido')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Revisar mi solicitud' })).toBeVisible();
  });

  it('un error de red se avisa junto al resumen y permite reintentar', async () => {
    montarPanel(<FormularioSolicitud mascota={MASCOTA} />, () => {
      throw new TypeError('fallo');
    });
    await llenar();
    await revisar();
    await confirmar();
    expect(await screen.findByRole('alert')).toHaveTextContent(/No pudimos conectar/);
    expect(screen.getByRole('button', { name: 'Confirmar y enviar' })).toBeEnabled();
  });
});
