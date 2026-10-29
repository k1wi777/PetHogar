import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { FundacionId } from './fundacion-id.decorator';

/** Extrae la función de un decorador de parámetro para probarla sin levantar Nest. */
function factoria(): (datos: unknown, contexto: ExecutionContext) => number {
  class Prueba {
    metodo(@FundacionId() _id: number): void {
      void _id;
    }
  }
  const metadatos = Reflect.getMetadata(ROUTE_ARGS_METADATA, Prueba, 'metodo') as Record<
    string,
    { factory: (datos: unknown, contexto: ExecutionContext) => number }
  >;
  return Object.values(metadatos)[0].factory;
}

const contexto = (solicitud: object): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => solicitud }) }) as unknown as ExecutionContext;

describe('@FundacionId()', () => {
  it('entrega el id que dejó ApprovedFoundationGuard', () => {
    expect(factoria()(undefined, contexto({ fundacionId: 4 }))).toBe(4);
  });

  it('rechaza con 403 si la ruta no pasó por el guard (nunca toma el id del cuerpo o la ruta)', () => {
    const solicitud = { body: { fundacionId: 9 }, params: { fundacionId: '9' } };
    expect(() => factoria()(undefined, contexto(solicitud))).toThrow(ForbiddenException);
  });
});
