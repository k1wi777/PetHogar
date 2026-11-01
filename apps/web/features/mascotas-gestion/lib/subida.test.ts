import { describe, expect, it, vi } from 'vitest';
import { ErrorApi, MENSAJES } from '@/shared/api/errores';
import {
  MAX_FOTOS,
  MENSAJE_CUPO,
  MENSAJE_RESTO_CUPO,
  prepararArchivos,
  procesarCola,
  resumenFinal,
  textoAlternativo,
  type ElementoCola,
} from './subida';

const archivo = (nombre: string, tipo = 'image/png', bytes = 100) =>
  new File([new Uint8Array(bytes)], nombre, { type: tipo });

const cola = (n: number): ElementoCola[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    archivo: archivo(`f${i + 1}.png`),
    estado: 'pendiente' as const,
  }));

const http409 = new ErrorApi({
  tipo: 'http',
  estado: 409,
  mensaje: 'Solo puedes subir hasta 6 fotos por mascota',
});

describe('prepararArchivos', () => {
  it('acepta JPG y PNG dentro del cupo', () => {
    const { aceptados, rechazados } = prepararArchivos(
      [archivo('a.png'), archivo('b.jpg', 'image/jpeg')],
      0,
    );
    expect(aceptados).toHaveLength(2);
    expect(rechazados).toEqual([]);
  });

  it('rechaza tipo inválido, vacío y de más de 5 MB con mensaje por archivo', () => {
    const { aceptados, rechazados } = prepararArchivos(
      [
        archivo('doc.pdf', 'application/pdf'),
        archivo('vacia.png', 'image/png', 0),
        archivo('grande.png', 'image/png', 5 * 1024 * 1024 + 1),
        archivo('ok.png'),
      ],
      0,
    );
    expect(aceptados.map((a) => a.name)).toEqual(['ok.png']);
    expect(rechazados.map((r) => r.archivo.name)).toEqual(['doc.pdf', 'vacia.png', 'grande.png']);
    expect(rechazados[0]!.mensaje).toMatch(/JPG o PNG/);
    expect(rechazados[2]!.mensaje).toMatch(/5 MB/);
  });

  it('el límite es 6 en total: la séptima se rechaza antes de enviar', () => {
    const seis = Array.from({ length: 6 }, (_, i) => archivo(`f${i}.png`));
    const a = prepararArchivos([...seis, archivo('septima.png')], 0);
    expect(a.aceptados).toHaveLength(MAX_FOTOS);
    expect(a.rechazados).toEqual([{ archivo: expect.any(File), mensaje: MENSAJE_CUPO }]);
    expect(a.rechazados[0]!.archivo.name).toBe('septima.png');

    const b = prepararArchivos([archivo('a.png'), archivo('b.png'), archivo('c.png')], 4);
    expect(b.aceptados.map((x) => x.name)).toEqual(['a.png', 'b.png']);
    expect(b.rechazados.map((x) => x.archivo.name)).toEqual(['c.png']);

    expect(prepararArchivos([archivo('a.png')], 6).aceptados).toEqual([]);
  });
});

describe('procesarCola', () => {
  it('sube de uno en uno en el orden dado y marca cada estado', async () => {
    const orden: string[] = [];
    let activas = 0;
    let maxActivas = 0;
    const cambios: Array<[number, string]> = [];
    const resumen = await procesarCola(
      cola(3),
      async (a) => {
        activas++;
        maxActivas = Math.max(maxActivas, activas);
        await Promise.resolve();
        orden.push(a.name);
        activas--;
      },
      (id, c) => cambios.push([id, c.estado ?? '']),
    );
    expect(orden).toEqual(['f1.png', 'f2.png', 'f3.png']);
    expect(maxActivas).toBe(1);
    expect(resumen).toEqual({ subidas: 3, fallidas: 0, parada: null });
    expect(cambios.filter(([, e]) => e === 'listo')).toHaveLength(3);
  });

  it('un fallo suelto no detiene la cola y las ya subidas se conservan', async () => {
    const subir = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ErrorApi({ tipo: 'red', mensaje: MENSAJES.red }))
      .mockResolvedValueOnce(undefined);
    const cambios: Record<number, { estado?: string; mensaje?: string }> = {};
    const resumen = await procesarCola(cola(3), subir, (id, c) => {
      cambios[id] = { ...cambios[id], ...c };
    });
    expect(resumen).toEqual({ subidas: 2, fallidas: 1, parada: null });
    expect(cambios[2]).toMatchObject({ estado: 'error', mensaje: MENSAJES.red });
    expect(cambios[3]!.estado).toBe('listo');
  });

  it('un 409 de cupo detiene la cola y marca el resto como no subido', async () => {
    const subir = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(http409);
    const cambios: Record<number, { estado?: string; mensaje?: string }> = {};
    const resumen = await procesarCola(cola(4), subir, (id, c) => {
      cambios[id] = { ...cambios[id], ...c };
    });
    expect(subir).toHaveBeenCalledTimes(2);
    expect(resumen).toMatchObject({ subidas: 1, fallidas: 3, parada: 'cupo' });
    expect(cambios[2]!.mensaje).toBe('Solo puedes subir hasta 6 fotos por mascota');
    expect(cambios[3]).toMatchObject({ estado: 'error', mensaje: MENSAJE_RESTO_CUPO });
    expect(cambios[4]).toMatchObject({ estado: 'error', mensaje: MENSAJE_RESTO_CUPO });
  });

  it('un 429 y un 403 también detienen la cola', async () => {
    const e429 = new ErrorApi({ tipo: 'http', estado: 429, mensaje: 'Demasiadas' });
    const e403 = new ErrorApi({ tipo: 'http', estado: 403, mensaje: 'Tu fundación fue rechazada' });
    expect(await procesarCola(cola(3), vi.fn().mockRejectedValue(e429), () => {})).toMatchObject({
      parada: 'limite',
      fallidas: 3,
    });
    expect(await procesarCola(cola(2), vi.fn().mockRejectedValue(e403), () => {})).toMatchObject({
      parada: 'no-aprobada',
      mensaje: 'Tu fundación fue rechazada',
    });
  });
});

describe('textos', () => {
  it('resume el resultado final para lectores de pantalla', () => {
    expect(resumenFinal({ subidas: 3, fallidas: 1, parada: null }, 0)).toBe(
      '3 fotos subidas, 1 con error',
    );
    expect(resumenFinal({ subidas: 1, fallidas: 0, parada: null }, 2)).toBe(
      '1 foto subida, 2 con error',
    );
    expect(resumenFinal({ subidas: 0, fallidas: 0, parada: null }, 0)).toBe(
      'No se subió ninguna foto',
    );
  });

  it('el texto alternativo identifica la foto y la principal', () => {
    expect(textoAlternativo('Luna', 2, 4, false)).toBe('Foto 2 de 4 de Luna');
    expect(textoAlternativo('Luna', 1, 4, true)).toBe('Foto 1 de 4 de Luna, foto principal');
  });
});
