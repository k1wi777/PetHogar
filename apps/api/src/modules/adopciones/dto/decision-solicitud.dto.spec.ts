import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { crearValidationPipe } from '../../../common/pipes/validation.pipe';
import { DecisionSolicitudDto } from './decision-solicitud.dto';

const pipe = crearValidationPipe();
const validar = (datos: object) =>
  pipe.transform(datos, {
    type: 'body',
    metatype: DecisionSolicitudDto,
  }) as Promise<DecisionSolicitudDto>;

async function errores(datos: object): Promise<Record<string, string[]>> {
  const error = await validar(datos).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(BadRequestException);
  const { errores: lista } = (error as BadRequestException).getResponse() as {
    errores: { campo: string; mensajes: string[] }[];
  };
  return Object.fromEntries(lista.map((e) => [e.campo, e.mensajes]));
}

describe('DecisionSolicitudDto', () => {
  afterEach(() => jest.useRealTimers());

  const aLas = (iso: string): void => {
    jest.useFakeTimers({ now: new Date(iso) });
  };

  describe('rechazar', () => {
    it('exige la observación (no vacía ni en blanco)', async () => {
      for (const datos of [
        { decision: 'rechazar' },
        { decision: 'rechazar', observacion: '   ' },
      ]) {
        expect((await errores(datos)).observacion).toContain('Debes indicar el motivo del rechazo');
      }
    });

    it('acepta la observación recortada, hasta 300 caracteres, e ignora la fecha de entrega', async () => {
      const dto = await validar({
        decision: 'rechazar',
        observacion: '  No cumple  ',
        fechaEntrega: 'basura',
      });
      expect(dto.observacion).toBe('No cumple');
      await expect(
        validar({ decision: 'rechazar', observacion: 'x'.repeat(300) }),
      ).resolves.toBeDefined();
      expect(
        Object.keys(await errores({ decision: 'rechazar', observacion: 'x'.repeat(301) })),
      ).toEqual(['observacion']);
    });
  });

  describe('aprobar', () => {
    it('exige la fecha de entrega', async () => {
      expect((await errores({ decision: 'aprobar' })).fechaEntrega).toEqual([
        'Debes indicar la fecha de entrega',
      ]);
    });

    it('la observación es opcional y una en blanco se ignora', async () => {
      aLas('2026-06-15T12:00:00Z');
      const dto = await validar({
        decision: 'aprobar',
        fechaEntrega: '2026-06-20',
        observacion: '  ',
      });
      expect(dto.observacion).toBeUndefined();
      const con = await validar({
        decision: 'aprobar',
        fechaEntrega: '2026-06-20',
        observacion: ' Bienvenida ',
      });
      expect(con.observacion).toBe('Bienvenida');
    });

    it('rechaza fechas inexistentes o con otro formato', async () => {
      aLas('2026-06-15T12:00:00Z');
      for (const fechaEntrega of [
        '2026-02-30',
        '2026-13-01',
        '20-06-2026',
        '2026-6-20',
        'mañana',
      ]) {
        const e = await errores({ decision: 'aprobar', fechaEntrega });
        expect(e.fechaEntrega).toEqual([
          'La fecha de entrega debe ser una fecha real con formato AAAA-MM-DD',
        ]);
      }
    });

    it('rechaza una fecha anterior a hoy y acepta hoy o futuras', async () => {
      aLas('2026-06-15T12:00:00Z');
      expect(
        (await errores({ decision: 'aprobar', fechaEntrega: '2026-06-14' })).fechaEntrega,
      ).toEqual(['La fecha de entrega no puede ser anterior a hoy']);
      await expect(
        validar({ decision: 'aprobar', fechaEntrega: '2026-06-15' }),
      ).resolves.toBeDefined();
      await expect(
        validar({ decision: 'aprobar', fechaEntrega: '2027-01-01' }),
      ).resolves.toBeDefined();
    });

    it('«hoy» es el día de Bogotá, no el de UTC (borde de medianoche)', async () => {
      // 2026-03-10 02:00 UTC = 2026-03-09 21:00 en Bogotá.
      aLas('2026-03-10T02:00:00Z');
      await expect(
        validar({ decision: 'aprobar', fechaEntrega: '2026-03-09' }),
      ).resolves.toBeDefined();
      expect(
        Object.keys(await errores({ decision: 'aprobar', fechaEntrega: '2026-03-08' })),
      ).toEqual(['fechaEntrega']);
      aLas('2026-03-10T05:00:00Z');
      expect(
        Object.keys(await errores({ decision: 'aprobar', fechaEntrega: '2026-03-09' })),
      ).toEqual(['fechaEntrega']);
    });
  });

  it('la decisión es obligatoria y solo admite aprobar o rechazar', async () => {
    expect((await errores({})).decision).toEqual(['La decisión debe ser aprobar o rechazar']);
    expect(Object.keys(await errores({ decision: 'quizá' }))).toEqual(['decision']);
  });
});
