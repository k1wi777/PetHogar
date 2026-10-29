import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConsultaSeguimientosDto } from './consultas.dto';
import { ProgramarSeguimientoDto } from './programar-seguimiento.dto';

async function mensajes<T extends object>(clase: new () => T, datos: object): Promise<string[]> {
  const dto = plainToInstance(clase, datos, { enableImplicitConversion: true });
  const errores = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errores.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('ProgramarSeguimientoDto', () => {
  it('acepta tipo y fecha reales (recorta espacios)', async () => {
    expect(
      await mensajes(ProgramarSeguimientoDto, { tipo: 'visita', fechaProgramada: ' 2026-12-15 ' }),
    ).toEqual([]);
    expect(
      await mensajes(ProgramarSeguimientoDto, { tipo: 'reporte', fechaProgramada: '2028-02-29' }),
    ).toEqual([]);
  });

  it('rechaza un tipo desconocido con mensaje en español', async () => {
    expect(
      await mensajes(ProgramarSeguimientoDto, { tipo: 'llamada', fechaProgramada: '2026-12-15' }),
    ).toEqual(['El tipo debe ser visita o reporte']);
  });

  it.each(['2026-02-30', '2026-13-01', '15/12/2026', 'mañana'])(
    'rechaza la fecha %p como no real',
    async (fecha) => {
      expect(
        await mensajes(ProgramarSeguimientoDto, { tipo: 'visita', fechaProgramada: fecha }),
      ).toEqual(['La fecha del seguimiento debe ser una fecha real con formato AAAA-MM-DD']);
    },
  );

  it('exige la fecha', async () => {
    expect(await mensajes(ProgramarSeguimientoDto, { tipo: 'visita' })).toContain(
      'Debes indicar la fecha del seguimiento',
    );
    expect(
      await mensajes(ProgramarSeguimientoDto, { tipo: 'visita', fechaProgramada: '  ' }),
    ).toContain('Debes indicar la fecha del seguimiento');
  });
});

describe('ConsultaSeguimientosDto', () => {
  it('convierte filtros y paginación', async () => {
    const dto = plainToInstance(ConsultaSeguimientosDto, {
      estado: 'vencido',
      tipo: 'reporte',
      adopcionId: '9',
      page: '2',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ estado: 'vencido', tipo: 'reporte', adopcionId: 9, page: 2 });
  });

  it.each([
    [{ estado: 'x' }, 'El estado debe ser programado, realizado, vencido o cancelado'],
    [{ tipo: 'x' }, 'El tipo debe ser visita o reporte'],
    [{ adopcionId: '0' }, 'La adopción no es válida'],
    [{ adopcionId: 'abc' }, 'La adopción debe ser un número entero'],
    [{ adopcionId: '99999999999' }, 'La adopción no es válida'],
  ])('rechaza %j', async (consulta, mensaje) => {
    expect(await mensajes(ConsultaSeguimientosDto, consulta)).toContain(mensaje);
  });
});
