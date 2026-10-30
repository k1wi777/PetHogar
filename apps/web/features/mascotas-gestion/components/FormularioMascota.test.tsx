import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cuerpoJson,
  errorApi,
  montarPanel,
  respuestaJson,
  type Manejador,
} from '@/shared/testing/prueba-utils';
import { ESPECIES, RAZAS, detalle, fundacion, mascota } from '../prueba-datos';
import { FormularioMascota } from './FormularioMascota';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

beforeEach(() => {
  push.mockClear();
  sesion.valor = {
    estado: 'autenticado',
    usuario: fundacion('aprobada'),
    refrescarPerfil: vi.fn(),
  };
});

/** Catálogos reales de ejemplo + el manejador propio de cada prueba. */
function api(extra: Manejador = () => errorApi(404, 'no')): Manejador {
  return (ruta, init) => {
    if (ruta === '/especies') return respuestaJson(ESPECIES);
    const razas = /^\/especies\/(\d+)\/razas$/.exec(ruta);
    if (razas) return respuestaJson(RAZAS[Number(razas[1])] ?? []);
    return extra(ruta, init);
  };
}

async function elegir(nombre: string, opcion: string) {
  const combo = await screen.findByRole('combobox', { name: new RegExp(nombre) });
  await waitFor(() => expect(combo).toBeEnabled());
  combo.focus();
  await userEvent.keyboard('{Enter}');
  await userEvent.click(await screen.findByRole('option', { name: opcion }));
}

const escribir = (etiqueta: RegExp | string, texto: string) =>
  userEvent.type(screen.getByLabelText(etiqueta), texto);

async function llenarValido() {
  await escribir(/^Nombre/, 'Rocky');
  await elegir('Especie', 'Perro');
  await elegir('Raza', 'Criollo');
  await userEvent.click(screen.getByRole('radio', { name: 'Macho' }));
  await escribir('Años', '2');
  await escribir('Meses', '6');
  await userEvent.click(screen.getByRole('radio', { name: 'Mediano' }));
  await escribir(/^Estado de salud/, 'Sano');
}

describe('FormularioMascota (publicar)', () => {
  it('sin especie la raza está deshabilitada y se explica por qué', async () => {
    montarPanel(<FormularioMascota modo="crear" />, api());
    const raza = await screen.findByRole('combobox', { name: /Raza/ });
    expect(raza).toBeDisabled();
    expect(screen.getAllByText(/Primero elige la especie/).length).toBeGreaterThan(0);
  });

  it('ofrece solo las razas de la especie y limpia la raza al cambiar de especie', async () => {
    const { llamadas } = montarPanel(<FormularioMascota modo="crear" />, api());
    await elegir('Especie', 'Perro');
    await elegir('Raza', 'Labrador');
    expect(screen.getByRole('combobox', { name: /Raza/ })).toHaveTextContent('Labrador');
    expect(llamadas('/especies/1/razas')).toHaveLength(1);

    await elegir('Especie', 'Gato');
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /Raza/ })).toHaveTextContent('Elige la raza'),
    );
    const raza = screen.getByRole('combobox', { name: /Raza/ });
    await waitFor(() => expect(raza).toBeEnabled());
    raza.focus();
    await userEvent.keyboard('{Enter}');
    const opciones = await screen.findAllByRole('option');
    expect(opciones.map((o) => o.textContent)).toEqual(['Siamés']);
  });

  it('publica con la edad en meses y lleva a la ficha para añadir fotos', async () => {
    const { llamadas } = montarPanel(
      <FormularioMascota modo="crear" />,
      api((ruta, init) =>
        ruta === '/mascotas' && init?.method === 'POST'
          ? respuestaJson(mascota({ id: 9 }), 201)
          : errorApi(404, 'no'),
      ),
    );
    await llenarValido();
    await userEvent.click(screen.getByRole('button', { name: 'Publicar mascota' }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/fundacion/mascotas/9?pestana=fotos&publicada=1'),
    );
    expect(cuerpoJson(llamadas('/mascotas', 'POST')[0] as never)).toEqual({
      nombre: 'Rocky',
      razaId: 11,
      sexo: 'macho',
      edadMeses: 30,
      tamano: 'mediano',
      estadoSalud: 'Sano',
      esterilizado: false,
      vacunado: false,
    });
  });

  it('valida en el cliente y no envía nada si faltan datos', async () => {
    const { llamadas } = montarPanel(<FormularioMascota modo="crear" />, api());
    await userEvent.click(screen.getByRole('button', { name: 'Publicar mascota' }));
    await screen.findByText('El nombre es obligatorio');
    const alertas = screen.getAllByRole('alert').map((a) => a.textContent);
    expect(alertas).toEqual(
      expect.arrayContaining([
        'El nombre es obligatorio',
        'Elige la especie',
        'Elige la raza',
        MENSAJE_EDAD,
        'El estado de salud es obligatorio',
      ]),
    );
    expect(llamadas('/mascotas', 'POST')).toHaveLength(0);
  });

  it('una edad por encima de 360 meses se rechaza antes de enviar', async () => {
    const { llamadas } = montarPanel(<FormularioMascota modo="crear" />, api());
    await llenarValido();
    await userEvent.clear(screen.getByLabelText('Años'));
    await userEvent.type(screen.getByLabelText('Años'), '30');
    await userEvent.clear(screen.getByLabelText('Meses'));
    await userEvent.type(screen.getByLabelText('Meses'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar mascota' }));
    expect(await screen.findByText(/no puede superar 360 meses/)).toBeInTheDocument();
    expect(llamadas('/mascotas', 'POST')).toHaveLength(0);
  });

  it('muestra los errores del servidor junto a su campo y conserva lo escrito', async () => {
    montarPanel(
      <FormularioMascota modo="crear" />,
      api((ruta, init) =>
        ruta === '/mascotas' && init?.method === 'POST'
          ? errorApi(400, 'Datos inválidos', [
              { campo: 'nombre', mensajes: ['El nombre es obligatorio'] },
              { campo: 'edadMeses', mensajes: ['La edad no puede ser negativa'] },
              { campo: 'raza', mensajes: ['campo desconocido'] },
            ])
          : errorApi(404, 'no'),
      ),
    );
    await llenarValido();
    await userEvent.click(screen.getByRole('button', { name: 'Publicar mascota' }));
    expect(await screen.findByText('La edad no puede ser negativa')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Rocky');
    expect(screen.getByLabelText('Años')).toHaveValue('2');
    expect(screen.getByText('campo desconocido')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('un 403 muestra el estado de fundación no aprobada', async () => {
    montarPanel(
      <FormularioMascota modo="crear" />,
      api((ruta, init) =>
        ruta === '/mascotas' && init?.method === 'POST'
          ? errorApi(403, 'Tu fundación fue rechazada; revisa la observación del administrador')
          : errorApi(404, 'no'),
      ),
    );
    await llenarValido();
    await userEvent.click(screen.getByRole('button', { name: 'Publicar mascota' }));
    expect(await screen.findByText('Tu fundación aún no está aprobada')).toBeInTheDocument();
  });
});

const MENSAJE_EDAD = 'Indica la edad de la mascota';

describe('FormularioMascota (editar)', () => {
  const original = detalle();
  const alConflicto = vi.fn();
  const montarEdicion = (extra: Manejador) =>
    montarPanel(
      <FormularioMascota
        modo="editar"
        mascota={original}
        especieId={1}
        alConflicto={alConflicto}
      />,
      api(extra),
    );

  beforeEach(() => alConflicto.mockClear());

  it('muestra los datos guardados con la edad descompuesta en años y meses', async () => {
    montarEdicion(() => errorApi(404, 'no'));
    expect(screen.getByLabelText(/^Nombre/)).toHaveValue('Firulais');
    expect(screen.getByLabelText('Años')).toHaveValue('2');
    expect(screen.getByLabelText('Meses')).toHaveValue('6');
    expect(screen.getByRole('radio', { name: 'Mediano' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /esterilizado/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /vacunas/ })).not.toBeChecked();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /Raza/ })).toHaveTextContent('Criollo'),
    );
    expect(screen.getByRole('combobox', { name: /Especie/ })).toHaveTextContent('Perro');
  });

  it('envía solo los campos modificados', async () => {
    const { llamadas } = montarEdicion((ruta, init) =>
      ruta === '/mascotas/5' && init?.method === 'PATCH'
        ? respuestaJson(mascota({ tamano: 'grande', edadMeses: 42 }))
        : errorApi(404, 'no'),
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Grande' }));
    await userEvent.clear(screen.getByLabelText('Años'));
    await userEvent.type(screen.getByLabelText('Años'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Guardamos los cambios de la mascota.')).toBeInTheDocument();
    expect(cuerpoJson(llamadas('/mascotas/5', 'PATCH')[0] as never)).toEqual({
      tamano: 'grande',
      edadMeses: 42,
    });
  });

  it('sin cambios no hace ninguna petición', async () => {
    const { llamadas } = montarEdicion(() => errorApi(404, 'no'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('No hiciste cambios en los datos.')).toBeInTheDocument();
    expect(llamadas('/mascotas/5', 'PATCH')).toHaveLength(0);
  });

  it('un 409 avisa a la ficha (la mascota cambió de estado en el servidor)', async () => {
    montarEdicion((ruta, init) =>
      ruta === '/mascotas/5' && init?.method === 'PATCH'
        ? errorApi(409, 'La mascota ya no se puede editar en su estado actual')
        : errorApi(404, 'no'),
    );
    await userEvent.clear(screen.getByLabelText(/^Nombre/));
    await userEvent.type(screen.getByLabelText(/^Nombre/), 'Otro');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(alConflicto).toHaveBeenCalledWith(
        'La mascota ya no se puede editar en su estado actual Actualizamos la ficha con el estado real.',
      ),
    );
  });

  it('vaciar la descripción la envía como null', async () => {
    const { llamadas } = montarEdicion((ruta, init) =>
      ruta === '/mascotas/5' && init?.method === 'PATCH'
        ? respuestaJson(mascota({ descripcion: null }))
        : errorApi(404, 'no'),
    );
    await userEvent.clear(screen.getByLabelText(/^Descripción/));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(llamadas('/mascotas/5', 'PATCH')).toHaveLength(1));
    expect(cuerpoJson(llamadas('/mascotas/5', 'PATCH')[0] as never)).toEqual({ descripcion: null });
    expect(within(document.body).queryByRole('alert')).toBeNull();
  });
});
