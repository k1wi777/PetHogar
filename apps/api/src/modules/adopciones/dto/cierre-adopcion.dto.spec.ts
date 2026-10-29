import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { crearValidationPipe } from '../../../common/pipes/validation.pipe';
import { CierreAdopcionDto } from './cierre-adopcion.dto';

const pipe = crearValidationPipe();
const validar = (datos: object) =>
  pipe.transform(datos, {
    type: 'body',
    metatype: CierreAdopcionDto,
  }) as Promise<CierreAdopcionDto>;

async function errores(datos: object): Promise<Record<string, string[]>> {
  const error = await validar(datos).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(BadRequestException);
  const { errores: lista } = (error as BadRequestException).getResponse() as {
    errores: { campo: string; mensajes: string[] }[];
  };
  return Object.fromEntries(lista.map((e) => [e.campo, e.mensajes]));
}

describe('CierreAdopcionDto', () => {
  it('revocar exige motivo y destino de la mascota', async () => {
    expect(await errores({ estado: 'revocada' })).toEqual({
      motivo: expect.arrayContaining(['Debes indicar el motivo']),
      mascotaDestino: ['Indica si la mascota vuelve a estar disponible o inactiva'],
    });
    expect(await errores({ estado: 'revocada', motivo: 'x', mascotaDestino: 'adoptada' })).toEqual({
      mascotaDestino: ['Indica si la mascota vuelve a estar disponible o inactiva'],
    });
  });

  it.each(['disponible', 'inactiva'])('revocar con destino %s es válido', async (destino) => {
    const dto = await validar({
      estado: 'revocada',
      motivo: '  Maltrato  ',
      mascotaDestino: destino,
    });
    expect(dto).toMatchObject({ estado: 'revocada', motivo: 'Maltrato', mascotaDestino: destino });
  });

  it('finalizar solo exige motivo y no se preocupa por el destino', async () => {
    expect(await validar({ estado: 'finalizada', motivo: 'Ok' })).toMatchObject({
      estado: 'finalizada',
    });
    await expect(
      validar({ estado: 'finalizada', motivo: 'Ok', mascotaDestino: 'cualquier-cosa' }),
    ).resolves.toBeDefined();
    expect(await errores({ estado: 'finalizada' })).toEqual({
      motivo: expect.arrayContaining(['Debes indicar el motivo']),
    });
  });

  it('el estado solo admite finalizada o revocada (no activa)', async () => {
    expect(await errores({ estado: 'activa', motivo: 'x' })).toEqual({
      estado: ['El estado debe ser finalizada o revocada'],
    });
  });

  it('el motivo en blanco o de más de 300 caracteres se rechaza', async () => {
    expect(await errores({ estado: 'finalizada', motivo: '   ' })).toHaveProperty('motivo');
    expect(await errores({ estado: 'finalizada', motivo: 'a'.repeat(301) })).toEqual({
      motivo: ['El motivo no puede superar 300 caracteres'],
    });
    await expect(validar({ estado: 'finalizada', motivo: 'a'.repeat(300) })).resolves.toBeDefined();
  });
});
