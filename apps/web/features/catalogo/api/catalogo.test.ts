import { describe, expect, it, vi } from 'vitest';
import { crearClienteServidor } from '@/shared/api/servidor';
import { listarEspecies } from './especies';
import { listarMascotas, obtenerFicha } from './mascotas';

function cliente(respuesta: () => Response | Promise<Response>) {
  const fetchImpl = vi.fn(async () => respuesta());
  return { fetchImpl, http: crearClienteServidor({ baseUrl: 'http://api/api', fetchImpl }) };
}
const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado });

describe('capa de datos del catálogo', () => {
  it('lista mascotas enviando solo los parámetros presentes', async () => {
    const pagina = { data: [], total: 0, page: 1, limit: 12 };
    const { fetchImpl, http } = cliente(() => json(pagina));
    await expect(
      listarMascotas({ especieId: 1, tamano: 'grande', ciudad: undefined, page: 2 }, http),
    ).resolves.toEqual(pagina);
    expect((fetchImpl.mock.calls[0] as unknown[])[0]).toBe(
      'http://api/api/mascotas?especieId=1&tamano=grande&page=2',
    );
  });

  it('lista especies', async () => {
    const { http } = cliente(() => json([{ id: 1, nombre: 'perro' }]));
    await expect(listarEspecies(http)).resolves.toEqual([{ id: 1, nombre: 'perro' }]);
  });

  it('la ficha inexistente o con id inválido da null sin pedir nada al id inválido', async () => {
    const { fetchImpl, http } = cliente(() => json({ message: 'No existe' }, 404));
    await expect(obtenerFicha('99', http)).resolves.toBeNull();
    await expect(obtenerFicha('abc', http)).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('un 400 de la API también es null', async () => {
    const { http } = cliente(() => json({ message: 'Id inválido' }, 400));
    await expect(obtenerFicha('5', http)).resolves.toBeNull();
  });

  it('propaga la caída de red, el 429 y el 500 para que los muestre error.tsx', async () => {
    const caida = crearClienteServidor({
      baseUrl: 'http://api/api',
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    await expect(listarMascotas({}, caida)).rejects.toMatchObject({ tipo: 'red' });
    await expect(obtenerFicha('1', caida)).rejects.toMatchObject({ tipo: 'red' });

    const limite = cliente(() => json({ message: 'Demasiadas' }, 429));
    await expect(obtenerFicha('1', limite.http)).rejects.toMatchObject({ estado: 429 });
    const roto = cliente(() => json({}, 500));
    await expect(listarMascotas({}, roto.http)).rejects.toMatchObject({ estado: 500 });
  });
});
