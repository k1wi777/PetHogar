import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { crearValidationPipe } from '../../../common/pipes/validation.pipe';
import { ConsultaMisSolicitudesDto, ConsultaSolicitudesFundacionDto } from './consultas.dto';
import { CrearSolicitudDto } from './crear-solicitud.dto';

const pipe = crearValidationPipe();
const validar = <T>(metatype: new () => T, datos: object, type: 'body' | 'query' = 'body') =>
  pipe.transform(datos, { type, metatype }) as Promise<T>;

async function camposInvalidos(
  metatype: new () => object,
  datos: object,
  type: 'body' | 'query' = 'body',
) {
  const error = await validar(metatype, datos, type).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(BadRequestException);
  const { errores } = (error as BadRequestException).getResponse() as {
    errores: { campo: string }[];
  };
  return errores.map((e) => e.campo).sort();
}

const VALIDA = {
  mascotaId: '7',
  motivo: '  Quiero un hogar  ',
  tipoVivienda: 'apartamento',
  tieneOtrasMascotas: 'true',
};

describe('CrearSolicitudDto (multipart: todo llega como texto)', () => {
  it('convierte entero y booleano estrictos, recorta y descarta campos ajenos', async () => {
    const dto = await validar(CrearSolicitudDto, {
      ...VALIDA,
      estado: 'aprobada',
      adoptanteId: 99,
    });
    expect(dto).toMatchObject({
      mascotaId: 7,
      motivo: 'Quiero un hogar',
      tipoVivienda: 'apartamento',
      tieneOtrasMascotas: true,
    });
    expect(dto).not.toHaveProperty('estado');
    expect(dto).not.toHaveProperty('adoptanteId');
  });

  it('"false" es false y no true (conversión implícita)', async () => {
    const dto = await validar(CrearSolicitudDto, { ...VALIDA, tieneOtrasMascotas: 'false' });
    expect(dto.tieneOtrasMascotas).toBe(false);
  });

  it.each(['casa', 'apartamento', 'finca'])('acepta la vivienda %s', async (tipoVivienda) => {
    await expect(validar(CrearSolicitudDto, { ...VALIDA, tipoVivienda })).resolves.toBeDefined();
  });

  it('exige todos los campos', async () => {
    expect(await camposInvalidos(CrearSolicitudDto, {})).toEqual([
      'mascotaId',
      'motivo',
      'tieneOtrasMascotas',
      'tipoVivienda',
    ]);
  });

  it('rechaza enum, entero, booleano y longitud inválidos', async () => {
    expect(
      await camposInvalidos(CrearSolicitudDto, {
        mascotaId: '1.5',
        motivo: 'x'.repeat(501),
        tipoVivienda: 'castillo',
        tieneOtrasMascotas: 'si',
      }),
    ).toEqual(['mascotaId', 'motivo', 'tieneOtrasMascotas', 'tipoVivienda']);
    expect(await camposInvalidos(CrearSolicitudDto, { ...VALIDA, mascotaId: '0' })).toEqual([
      'mascotaId',
    ]);
    expect(
      await camposInvalidos(CrearSolicitudDto, { ...VALIDA, mascotaId: '99999999999' }),
    ).toEqual(['mascotaId']);
    expect(await camposInvalidos(CrearSolicitudDto, { ...VALIDA, motivo: '   ' })).toEqual([
      'motivo',
    ]);
  });

  it('acepta un motivo de exactamente 500 caracteres', async () => {
    await expect(
      validar(CrearSolicitudDto, { ...VALIDA, motivo: 'x'.repeat(500) }),
    ).resolves.toBeDefined();
  });
});

describe('consultas', () => {
  it('mis solicitudes: estado opcional con enum', async () => {
    expect(await validar(ConsultaMisSolicitudesDto, {}, 'query')).toMatchObject({
      page: 1,
      limit: 10,
    });
    expect(
      await validar(ConsultaMisSolicitudesDto, { estado: 'cancelada' }, 'query'),
    ).toMatchObject({ estado: 'cancelada' });
    expect(await camposInvalidos(ConsultaMisSolicitudesDto, { estado: 'x' }, 'query')).toEqual([
      'estado',
    ]);
  });

  it('fundación: mascotaId entero estricto ≥ 1', async () => {
    expect(
      await validar(ConsultaSolicitudesFundacionDto, { mascotaId: '4' }, 'query'),
    ).toMatchObject({ mascotaId: 4 });
    for (const malo of ['0', '-1', 'abc', '1.5', '']) {
      expect(
        await camposInvalidos(ConsultaSolicitudesFundacionDto, { mascotaId: malo }, 'query'),
      ).toEqual(['mascotaId']);
    }
  });
});
