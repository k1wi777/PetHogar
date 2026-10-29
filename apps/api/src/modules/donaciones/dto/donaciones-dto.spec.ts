import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { crearValidationPipe } from '../../../common/pipes/validation.pipe';
import { ConsultaDonacionesDto } from './consulta-donaciones.dto';
import { CrearDonacionManualDto } from './crear-donacion-manual.dto';
import { CrearDonacionDto } from './crear-donacion.dto';

const pipe = crearValidationPipe();
const validar = <T>(metatype: new () => T, datos: object) =>
  pipe.transform(datos, { type: 'body', metatype }) as Promise<T>;

async function errores<T>(metatype: new () => T, datos: object): Promise<Record<string, string[]>> {
  const error = await validar(metatype, datos).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(BadRequestException);
  const { errores: lista } = (error as BadRequestException).getResponse() as {
    errores: { campo: string; mensajes: string[] }[];
  };
  return Object.fromEntries(lista.map((e) => [e.campo, e.mensajes]));
}

describe('CrearDonacionDto', () => {
  const base = { fundacionId: '3', tipo: 'economica' };

  it('acepta una donación económica y deja el monto como cadena exacta', async () => {
    const dto = await validar(CrearDonacionDto, { ...base, monto: ' 50000.5 ' });
    expect(dto).toMatchObject({ fundacionId: 3, tipo: 'economica', monto: '50000.5' });
    expect(typeof dto.monto).toBe('string');
  });

  it.each([
    ['0', 'El monto debe ser mayor que 0'],
    ['0.00', 'El monto debe ser mayor que 0'],
    ['-1', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['1.234', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['1e3', 'Usa solo números y punto decimal, hasta 2 decimales'],
    ['10000000000', 'El monto no puede superar $ 1.000.000.000'],
    ['1000000000.01', 'El monto no puede superar $ 1.000.000.000'],
    ['abc', 'Usa solo números y punto decimal, hasta 2 decimales'],
  ])('rechaza el monto «%s» con un mensaje en español', async (monto, mensaje) => {
    expect((await errores(CrearDonacionDto, { ...base, monto })).monto).toContain(mensaje);
  });

  it('exige el monto si es económica (ausente o en blanco)', async () => {
    for (const datos of [base, { ...base, monto: '' }, { ...base, monto: '   ' }]) {
      expect((await errores(CrearDonacionDto, datos)).monto).toContain(
        'Indica el monto de la donación económica',
      );
    }
  });

  it('en especie exige una descripción de 1 a 300 caracteres e ignora el monto', async () => {
    const especie = { fundacionId: '3', tipo: 'especie' };
    expect((await errores(CrearDonacionDto, especie)).descripcion).toBeDefined();
    expect(
      (await errores(CrearDonacionDto, { ...especie, descripcion: '   ' })).descripcion,
    ).toBeDefined();
    expect(
      (await errores(CrearDonacionDto, { ...especie, descripcion: 'x'.repeat(301) })).descripcion,
    ).toBeDefined();
    const dto = await validar(CrearDonacionDto, {
      ...especie,
      descripcion: ' Dos bultos de croquetas ',
      monto: 'no-es-un-monto',
    });
    expect(dto.descripcion).toBe('Dos bultos de croquetas');
    await expect(
      validar(CrearDonacionDto, { ...especie, descripcion: 'x'.repeat(300) }),
    ).resolves.toBeDefined();
  });

  it('en económica ignora una descripción inválida', async () => {
    await expect(
      validar(CrearDonacionDto, { ...base, monto: '10', descripcion: 'x'.repeat(999) }),
    ).resolves.toBeDefined();
  });

  it('valida el tipo y la fundación', async () => {
    const e = await errores(CrearDonacionDto, { fundacionId: 'abc', tipo: 'otra' });
    expect(Object.keys(e).sort()).toEqual(['fundacionId', 'tipo']);
    expect(e.tipo).toContain('El tipo debe ser economica o especie');
    expect(
      (await errores(CrearDonacionDto, { ...base, fundacionId: '0', monto: '1' })).fundacionId,
    ).toBeDefined();
  });

  it('no declara el donante: lo que el cliente envíe como usuarioId se descarta', async () => {
    const dto = await validar(CrearDonacionDto, { ...base, monto: '10', usuarioId: '99' });
    expect(dto).not.toHaveProperty('usuarioId');
  });
});

describe('CrearDonacionManualDto', () => {
  it('exige el nombre del donante (2 a 100 caracteres, recortado)', async () => {
    const base = { tipo: 'economica', monto: '100' };
    for (const nombreDonante of [undefined, '', ' ', 'A', 'x'.repeat(101)]) {
      expect(
        (await errores(CrearDonacionManualDto, { ...base, nombreDonante })).nombreDonante,
      ).toBeDefined();
    }
    const dto = await validar(CrearDonacionManualDto, { ...base, nombreDonante: '  Ana Ruiz ' });
    expect(dto.nombreDonante).toBe('Ana Ruiz');
  });

  it('aplica las mismas reglas de monto y descripción', async () => {
    expect(
      (
        await errores(CrearDonacionManualDto, {
          nombreDonante: 'Ana',
          tipo: 'economica',
          monto: '0',
        })
      ).monto,
    ).toBeDefined();
    expect(
      (await errores(CrearDonacionManualDto, { nombreDonante: 'Ana', tipo: 'especie' }))
        .descripcion,
    ).toBeDefined();
  });

  it('descarta fundacionId y usuarioId del cuerpo', async () => {
    const dto = await validar(CrearDonacionManualDto, {
      nombreDonante: 'Ana',
      tipo: 'economica',
      monto: '5',
      fundacionId: '9',
      usuarioId: '2',
    });
    expect(dto).not.toHaveProperty('fundacionId');
    expect(dto).not.toHaveProperty('usuarioId');
  });
});

describe('ConsultaDonacionesDto', () => {
  it('acepta periodo y tipo opcionales con la paginación estándar', async () => {
    const dto = await validar(ConsultaDonacionesDto, {
      desde: '2026-10-01',
      hasta: '2026-10-31',
      tipo: 'economica',
      page: '2',
      limit: '5',
    });
    expect(dto).toMatchObject({
      desde: '2026-10-01',
      hasta: '2026-10-31',
      tipo: 'economica',
      page: 2,
      limit: 5,
    });
    await expect(validar(ConsultaDonacionesDto, {})).resolves.toMatchObject({ page: 1, limit: 10 });
  });

  it('rechaza fechas inexistentes, formatos distintos y tipos desconocidos', async () => {
    const e = await errores(ConsultaDonacionesDto, {
      desde: '2026-02-30',
      hasta: '31/10/2026',
      tipo: 'otro',
      limit: '101',
    });
    expect(Object.keys(e).sort()).toEqual(['desde', 'hasta', 'limit', 'tipo']);
  });
});
