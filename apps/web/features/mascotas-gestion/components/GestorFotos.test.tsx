import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorApi,
  montarPanel,
  respuestaJson,
  type Manejador,
} from '@/shared/testing/prueba-utils';
import { useMascotaGestion } from '../hooks/useMascotasGestion';
import { MENSAJE_CUPO } from '../lib/subida';
import { detalle, foto, fundacion } from '../prueba-datos';
import type { FotoGestion } from '../types';
import { GestorFotos } from './GestorFotos';

vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

const alNoAprobada = vi.fn();

function Contenedor() {
  const { data } = useMascotaGestion(5);
  return data ? <GestorFotos mascota={data} alNoAprobada={alNoAprobada} /> : null;
}

const archivo = (nombre: string, tipo = 'image/png', bytes = 100) =>
  new File([new Uint8Array(bytes)], nombre, { type: tipo });

/** Simula el backend: galería en memoria con el cupo, la promoción de la principal y el orden. */
function servidor(inicial: FotoGestion[], extra?: Manejador) {
  const estado = { fotos: [...inicial], siguiente: 100, posts: [] as string[] };
  const ordenadas = () =>
    [...estado.fotos].sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal) || a.id - b.id);
  const manejador: Manejador = async (ruta, init) => {
    if (ruta === '/fundacion/mascotas/5') return respuestaJson(detalle({ fotos: ordenadas() }));
    if (ruta === '/mascotas/5/fotos' && init?.method === 'POST') {
      const respuesta = await extra?.(ruta, init);
      if (respuesta) return respuesta;
      const nombre = ((init.body as FormData).get('foto') as File).name;
      estado.posts.push(nombre);
      if (estado.fotos.length >= 6) return errorApi(409, MENSAJE_CUPO);
      const nueva = foto(estado.siguiente++, { esPrincipal: estado.fotos.length === 0 });
      estado.fotos.push(nueva);
      return respuestaJson(nueva, 201);
    }
    const principal = /^\/mascotas\/5\/fotos\/(\d+)\/principal$/.exec(ruta);
    if (principal && init?.method === 'PATCH') {
      estado.fotos = estado.fotos.map((f) => ({
        ...f,
        esPrincipal: f.id === Number(principal[1]),
      }));
      return respuestaJson(ordenadas());
    }
    const borrar = /^\/mascotas\/5\/fotos\/(\d+)$/.exec(ruta);
    if (borrar && init?.method === 'DELETE') {
      const id = Number(borrar[1]);
      const eraPrincipal = estado.fotos.find((f) => f.id === id)?.esPrincipal;
      estado.fotos = estado.fotos.filter((f) => f.id !== id);
      if (eraPrincipal && estado.fotos[0])
        estado.fotos[0] = { ...estado.fotos[0], esPrincipal: true };
      return new Response(null, { status: 204 });
    }
    return errorApi(404, 'no');
  };
  return { estado, manejador };
}

const galeria = (n: number) =>
  Array.from({ length: n }, (_, i) => foto(i + 1, { esPrincipal: i === 0 }));

const entrada = () => screen.getByLabelText('Elegir fotos') as HTMLInputElement;
const tarjetas = async () =>
  within(await screen.findByRole('list', { name: 'Galería de fotos' })).getAllByRole('listitem');

beforeEach(() => {
  alNoAprobada.mockClear();
  sesion.valor = {
    estado: 'autenticado',
    usuario: fundacion('aprobada'),
    refrescarPerfil: vi.fn(),
  };
});

describe('GestorFotos', () => {
  it('muestra la galería con contador, texto alternativo y una sola principal con texto', async () => {
    const s = servidor(galeria(2));
    montarPanel(<Contenedor />, s.manejador);
    const items = await tarjetas();
    expect(items).toHaveLength(2);
    expect(screen.getByText(/^2 de 6 fotos/)).toBeInTheDocument();
    expect(screen.getByAltText('Foto 1 de 2 de Firulais, foto principal')).toBeInTheDocument();
    expect(screen.getByAltText('Foto 2 de 2 de Firulais')).toBeInTheDocument();
    expect(screen.getAllByText('Principal')).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Principal');
    expect(screen.queryByRole('button', { name: 'Marcar la foto 1 como principal' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Marcar la foto 2 como principal' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar la foto 2' })).toBeInTheDocument();
  });

  it('una foto sin URL pública (seed) muestra «Sin vista previa»', async () => {
    montarPanel(<Contenedor />, (ruta) =>
      ruta === '/fundacion/mascotas/5'
        ? respuestaJson(
            detalle({ fotos: [foto(1, { esPrincipal: true, urlCatalogo: null, url: null })] }),
          )
        : errorApi(404, 'no'),
    );
    expect(await screen.findByText('Sin vista previa')).toBeInTheDocument();
  });

  it('sin fotos muestra el estado vacío', async () => {
    montarPanel(<Contenedor />, servidor([]).manejador);
    expect(await screen.findByText('Aún no tiene fotos')).toBeInTheDocument();
    expect(screen.getByText(/^0 de 6 fotos/)).toBeInTheDocument();
  });

  it('el selector es un input de archivos real, múltiple y solo de imágenes (teclado)', async () => {
    montarPanel(<Contenedor />, servidor(galeria(1)).manejador);
    await tarjetas();
    expect(entrada()).toHaveAttribute('type', 'file');
    expect(entrada()).toHaveAttribute('multiple');
    expect(entrada().accept).toContain('.png');
    expect(entrada()).toBeEnabled();
    expect(screen.getByText('Elegir fotos').tagName).toBe('LABEL');
  });

  it('sube de una en una, en orden, por el campo «foto» y anuncia el avance y el resultado', async () => {
    const s = servidor(galeria(1));
    const liberar: Array<() => void> = [];
    const { fetchImpl } = montarPanel(
      <Contenedor />,
      servidor(galeria(1), (_ruta, init) => {
        const nombre = ((init!.body as FormData).get('foto') as File).name;
        s.estado.posts.push(nombre);
        return new Promise<Response>((resolver) => {
          liberar.push(() => resolver(respuestaJson(foto(200 + liberar.length), 201)));
        });
      }).manejador,
    );
    await tarjetas();
    await userEvent.upload(entrada(), [archivo('a.png'), archivo('b.png')]);
    const region = screen.getByRole('status', { name: '' });
    await waitFor(() => expect(region).toHaveTextContent('Subiendo 1 de 2: a.png'));
    // Mientras la primera no termina, la segunda no se ha enviado.
    expect(s.estado.posts).toEqual(['a.png']);
    expect(entrada()).toBeDisabled();
    liberar[0]!();
    await waitFor(() => expect(region).toHaveTextContent('Subiendo 2 de 2: b.png'));
    expect(s.estado.posts).toEqual(['a.png', 'b.png']);
    liberar[1]!();
    await waitFor(() => expect(region).toHaveTextContent('2 fotos subidas'));
    expect(region).toHaveAttribute('aria-live', 'polite');
    const subidas = fetchImpl.mock.calls.filter(([u]) => u.endsWith('/mascotas/5/fotos'));
    expect(subidas).toHaveLength(2);
    expect(entrada()).toBeEnabled();
    expect(await screen.findAllByRole('img')).toHaveLength(3);
  });

  it('rechaza antes de enviar el tipo no permitido, el archivo vacío y el de más de 5 MB', async () => {
    const s = servidor(galeria(1));
    montarPanel(<Contenedor />, s.manejador);
    await tarjetas();
    // `applyAccept: false` para que el filtro `accept` de user-event no oculte los inválidos.
    const u = userEvent.setup({ applyAccept: false });
    await u.upload(entrada(), [
      archivo('doc.pdf', 'application/pdf'),
      archivo('vacia.png', 'image/png', 0),
      archivo('enorme.png', 'image/png', 5 * 1024 * 1024 + 1),
    ]);
    const lista = await screen.findByRole('list', { name: 'Estado de la subida' });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas[0]).toHaveTextContent('doc.pdf');
    expect(filas[0]).toHaveTextContent('No válida: Solo se permiten fotos JPG o PNG');
    expect(filas[1]).toHaveTextContent('El archivo está vacío');
    expect(filas[2]).toHaveTextContent('El archivo supera el tamaño máximo de 5 MB');
    expect(s.estado.posts).toEqual([]);
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('3 con error');
  });

  it('el límite es 6: lo que no cabe se rechaza con el mensaje del backend y el cupo se bloquea', async () => {
    const s = servidor(galeria(5));
    montarPanel(<Contenedor />, s.manejador);
    await tarjetas();
    await userEvent.upload(entrada(), [archivo('a.png'), archivo('b.png'), archivo('c.png')]);
    await waitFor(() => expect(screen.getByText(/^6 de 6 fotos/)).toBeInTheDocument());
    expect(s.estado.posts).toEqual(['a.png']);
    const lista = screen.getByRole('list', { name: 'Estado de la subida' });
    expect(within(lista).getAllByText(new RegExp(MENSAJE_CUPO))).toHaveLength(2);
    expect(entrada()).toBeDisabled();
    expect(screen.getByText(/Alcanzaste el máximo de 6 fotos/)).toBeInTheDocument();
  });

  it('con 6 fotos, soltar archivos no envía nada (la séptima se rechaza)', async () => {
    const s = servidor(galeria(6));
    montarPanel(<Contenedor />, s.manejador);
    await tarjetas();
    const zona = entrada().parentElement!;
    fireEvent.drop(zona, { dataTransfer: { files: [archivo('septima.png')] } });
    expect(s.estado.posts).toEqual([]);
    expect(screen.queryByRole('list', { name: 'Estado de la subida' })).toBeNull();
  });

  it('arrastrar y soltar funciona igual que elegir con el botón', async () => {
    const s = servidor(galeria(1));
    montarPanel(<Contenedor />, s.manejador);
    await tarjetas();
    const zona = entrada().parentElement!;
    fireEvent.dragOver(zona, { dataTransfer: { files: [] } });
    expect(screen.getByText('Suelta las fotos aquí')).toBeInTheDocument();
    fireEvent.drop(zona, { dataTransfer: { files: [archivo('arrastrada.png')] } });
    await waitFor(() => expect(s.estado.posts).toEqual(['arrastrada.png']));
    await waitFor(() => expect(screen.getByText(/^2 de 6 fotos/)).toBeInTheDocument());
  });

  it('un 409 de cupo por carrera detiene la cola y marca el resto como no subido', async () => {
    const s = servidor(galeria(2), () => errorApi(409, MENSAJE_CUPO));
    montarPanel(<Contenedor />, s.manejador);
    await tarjetas();
    await userEvent.upload(entrada(), [archivo('a.png'), archivo('b.png'), archivo('c.png')]);
    const lista = await screen.findByRole('list', { name: 'Estado de la subida' });
    await waitFor(() =>
      expect(within(lista).getAllByText(/No subida: ya hay 6 fotos/)).toHaveLength(2),
    );
    expect(within(lista).getAllByRole('listitem')[0]).toHaveTextContent(MENSAJE_CUPO);
  });

  it('reintentar sube solo las fallidas y conserva las ya subidas', async () => {
    let falla = true;
    const s = servidor(galeria(1), (_ruta, init) => {
      const nombre = ((init!.body as FormData).get('foto') as File).name;
      if (falla && nombre === 'b.png') {
        s.estado.posts.push(nombre);
        throw new Error('sin red');
      }
      return undefined as never;
    });
    montarPanel(<Contenedor />, s.manejador);
    await tarjetas();
    await userEvent.upload(entrada(), [archivo('a.png'), archivo('b.png'), archivo('c.png')]);
    await screen.findByRole('button', { name: 'Reintentar las fallidas' });
    expect(s.estado.posts).toEqual(['a.png', 'b.png', 'c.png']);
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent(
      '2 fotos subidas, 1 con error',
    );
    falla = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar las fallidas' }));
    await waitFor(() => expect(s.estado.posts).toEqual(['a.png', 'b.png', 'c.png', 'b.png']));
    await waitFor(() => expect(screen.getByText(/^4 de 6 fotos/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Reintentar las fallidas' })).toBeNull();
  });

  it('marcar como principal deja una sola principal y la muestra primero', async () => {
    const s = servidor(galeria(3));
    montarPanel(<Contenedor />, s.manejador);
    await tarjetas();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar la foto 3 como principal' }));
    await waitFor(() =>
      expect(screen.getByRole('status', { name: '' })).toHaveTextContent(
        'La foto 3 ahora es la principal',
      ),
    );
    expect(screen.getAllByText('Principal')).toHaveLength(1);
    expect(s.estado.fotos.filter((f) => f.esPrincipal).map((f) => f.id)).toEqual([3]);
    const items = await tarjetas();
    expect(items[0]).toHaveTextContent('Principal');
    expect(screen.getByAltText('Foto 1 de 3 de Firulais, foto principal')).toBeInTheDocument();
  });

  it('eliminar pide confirmación; Cancelar no borra', async () => {
    const s = servidor(galeria(2));
    const { llamadas } = montarPanel(<Contenedor />, s.manejador);
    await tarjetas();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar la foto 2' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Eliminar la foto 2?' });
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(llamadas('/mascotas/5/fotos/2', 'DELETE')).toHaveLength(0);
    expect(await tarjetas()).toHaveLength(2);
  });

  it('al eliminar la principal se avisa, se relee el detalle, otra pasa a principal y se libera el cupo', async () => {
    const s = servidor(galeria(6));
    const { llamadas } = montarPanel(<Contenedor />, s.manejador);
    await tarjetas();
    expect(entrada()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar la foto 1' }));
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('otra foto pasará a ser la principal');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(screen.getByText(/^5 de 6 fotos/)).toBeInTheDocument());
    expect(llamadas('/mascotas/5/fotos/1', 'DELETE')).toHaveLength(1);
    expect(llamadas('/fundacion/mascotas/5').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Principal')).toHaveLength(1);
    expect(entrada()).toBeEnabled();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Eliminaste la foto 1');
    expect(screen.getByRole('heading', { name: 'Fotos' })).toHaveFocus();
  });

  it('un error al marcar principal se muestra en español y la galería sigue intacta', async () => {
    montarPanel(<Contenedor />, (ruta, init) =>
      ruta === '/fundacion/mascotas/5'
        ? respuestaJson(detalle())
        : init?.method === 'PATCH'
          ? errorApi(404, 'La foto no existe')
          : errorApi(404, 'no'),
    );
    await tarjetas();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar la foto 2 como principal' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La foto no existe');
  });

  it('un 403 al subir avisa de que la fundación ya no está aprobada', async () => {
    const s = servidor(galeria(1), () => errorApi(403, 'Tu fundación fue rechazada'));
    montarPanel(<Contenedor />, s.manejador);
    await tarjetas();
    await userEvent.upload(entrada(), [archivo('a.png')]);
    await waitFor(() => expect(alNoAprobada).toHaveBeenCalledWith('Tu fundación fue rechazada'));
  });
});
