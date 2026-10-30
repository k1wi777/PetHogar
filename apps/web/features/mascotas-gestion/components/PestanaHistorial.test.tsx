import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cuerpoJson,
  errorApi,
  montarPanel,
  respuestaJson,
  type Manejador,
} from '@/shared/testing/prueba-utils';
import { detalle, evento, fundacion } from '../prueba-datos';
import { PestanaHistorial } from './PestanaHistorial';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

const alNoAprobada = vi.fn();
beforeEach(() => {
  alNoAprobada.mockClear();
  sesion.valor = {
    estado: 'autenticado',
    usuario: fundacion('aprobada'),
    refrescarPerfil: vi.fn(),
  };
});

const montar = (estado: 'disponible' | 'inactiva', manejador: Manejador) =>
  montarPanel(
    <PestanaHistorial mascota={detalle({ estado })} alNoAprobada={alNoAprobada} />,
    manejador,
  );

const registros = () =>
  within(screen.getByRole('list', { name: 'Registros médicos' })).getAllByRole('listitem');

async function elegirTipo(opcion: string) {
  const combo = screen.getByRole('combobox', { name: /Tipo de evento/ });
  combo.focus();
  await userEvent.keyboard('{Enter}');
  await userEvent.click(await screen.findByRole('option', { name: opcion }));
}

async function llenar(fecha = '2026-03-05', descripcion = 'Refuerzo anual') {
  await elegirTipo('Vacuna');
  fireEvent.change(screen.getByLabelText(/^Fecha/), { target: { value: fecha } });
  await userEvent.type(screen.getByLabelText(/^Descripción/), descripcion);
}

describe('PestanaHistorial', () => {
  it('lista del más reciente al más antiguo con tipo en texto, fecha legible y veterinario', async () => {
    montar('disponible', (ruta) =>
      ruta === '/mascotas/5/historial'
        ? respuestaJson([
            evento(1, { fecha: '2026-01-10', tipo: 'consulta', descripcion: 'Control' }),
            evento(2, { fecha: '2026-03-05', tipo: 'vacuna' }),
            evento(3, {
              fecha: '2026-03-05',
              tipo: 'cirugia',
              descripcion: 'Esterilización',
              veterinario: null,
            }),
          ])
        : errorApi(404, 'no'),
    );
    await screen.findByRole('list', { name: 'Registros médicos' });
    const filas = registros();
    expect(filas.map((f) => f.textContent)).toEqual([
      expect.stringContaining('Cirugía · 5 de marzo de 2026'),
      expect.stringContaining('Vacuna · 5 de marzo de 2026'),
      expect.stringContaining('Consulta · 10 de enero de 2026'),
    ]);
    expect(filas[0]).not.toHaveTextContent('Veterinario');
    expect(filas[1]).toHaveTextContent('Veterinario: Dra. Pérez');
  });

  it('sin registros muestra un estado vacío; con fallo, «Reintentar»', async () => {
    let falla = true;
    montar('disponible', (ruta) =>
      ruta === '/mascotas/5/historial'
        ? falla
          ? errorApi(500, 'x')
          : respuestaJson([])
        : errorApi(404, 'no'),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar el historial');
    falla = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Aún no hay registros')).toBeInTheDocument();
  });

  it('registra un evento sin recargar, lo suma a la lista ordenada y limpia el formulario', async () => {
    const { llamadas } = montar('disponible', (ruta, init) => {
      if (ruta === '/mascotas/5/historial' && init?.method === 'POST') {
        return respuestaJson(
          evento(9, { fecha: '2026-03-05', descripcion: 'Refuerzo anual', veterinario: null }),
          201,
        );
      }
      if (ruta === '/mascotas/5/historial')
        return respuestaJson([evento(1, { fecha: '2026-01-10' })]);
      return errorApi(404, 'no');
    });
    await screen.findByRole('list', { name: 'Registros médicos' });
    await llenar();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar evento' }));
    expect(await screen.findByText(/Ya aparece en la ficha pública/)).toBeInTheDocument();
    expect(cuerpoJson(llamadas('/mascotas/5/historial', 'POST')[0] as never)).toEqual({
      tipo: 'vacuna',
      fecha: '2026-03-05',
      descripcion: 'Refuerzo anual',
    });
    const filas = registros();
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('Refuerzo anual');
    // La lista no se recargó: el nuevo registro se añadió a la que ya estaba.
    expect(llamadas('/mascotas/5/historial', 'GET')).toHaveLength(1);
    expect(screen.getByLabelText(/^Descripción/)).toHaveValue('');
  });

  it('una fecha futura se rechaza junto al campo sin enviar y conserva lo escrito', async () => {
    const { llamadas } = montar('disponible', () => respuestaJson([]));
    await screen.findByText('Aún no hay registros');
    await llenar('2999-01-01', 'Texto que no debe perderse');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar evento' }));
    expect(
      await screen.findByText('La fecha del registro no puede ser futura'),
    ).toBeInTheDocument();
    expect(llamadas('/mascotas/5/historial', 'POST')).toHaveLength(0);
    expect(screen.getByLabelText(/^Descripción/)).toHaveValue('Texto que no debe perderse');
    expect(screen.getByLabelText(/^Fecha/)).toHaveAttribute('max');
  });

  it('el error 400 del servidor en la fecha queda junto al campo y conserva lo escrito', async () => {
    montar('disponible', (ruta, init) =>
      ruta === '/mascotas/5/historial' && init?.method === 'POST'
        ? errorApi(400, 'Datos inválidos', [
            { campo: 'fecha', mensajes: ['La fecha del registro no puede ser futura'] },
          ])
        : respuestaJson([]),
    );
    await screen.findByText('Aún no hay registros');
    await llenar();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar evento' }));
    expect(
      await screen.findByText('La fecha del registro no puede ser futura'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Descripción/)).toHaveValue('Refuerzo anual');
    expect(screen.getByLabelText(/^Fecha/)).toHaveValue('2026-03-05');
  });

  it('valida tipo y descripción (máximo 300) antes de enviar', async () => {
    const { llamadas } = montar('disponible', () => respuestaJson([]));
    await screen.findByText('Aún no hay registros');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar evento' }));
    const alertas = (await screen.findAllByRole('alert')).map((a) => a.textContent);
    expect(alertas).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/El tipo debe ser/),
        expect.stringMatching(/fecha real/),
        'La descripción es obligatoria',
      ]),
    );
    expect(llamadas('/mascotas/5/historial', 'POST')).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/^Descripción/), { target: { value: 'a'.repeat(301) } });
    await userEvent.click(screen.getByRole('button', { name: 'Registrar evento' }));
    expect(await screen.findByText(/no puede superar 300 caracteres/)).toBeInTheDocument();
  });

  it('con otro estado no consulta la lista pública, avisa y deja registrar (solo se ven los de la sesión)', async () => {
    const { llamadas } = montar('inactiva', (ruta, init) =>
      ruta === '/mascotas/5/historial' && init?.method === 'POST'
        ? respuestaJson(evento(7, { descripcion: 'Refuerzo anual' }), 201)
        : errorApi(404, 'La mascota no existe'),
    );
    expect(screen.getByText(/se consulta cuando la mascota está disponible/)).toBeInTheDocument();
    expect(await screen.findByText('Aún no hay registros')).toBeInTheDocument();
    expect(llamadas('/mascotas/5/historial', 'GET')).toHaveLength(0);
    await llenar();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar evento' }));
    await waitFor(() => expect(registros()).toHaveLength(1));
    expect(screen.queryByText(/Ya aparece en la ficha pública/)).toBeNull();
  });

  it('un 403 avisa de que la fundación ya no está aprobada', async () => {
    montar('disponible', (ruta, init) =>
      ruta === '/mascotas/5/historial' && init?.method === 'POST'
        ? errorApi(403, 'Tu fundación fue rechazada')
        : respuestaJson([]),
    );
    await screen.findByText('Aún no hay registros');
    await llenar();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar evento' }));
    await waitFor(() => expect(alNoAprobada).toHaveBeenCalledWith('Tu fundación fue rechazada'));
  });
});
