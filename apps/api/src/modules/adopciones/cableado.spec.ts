import 'reflect-metadata';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ES_PUBLICA } from '../../common/auth/public.decorator';
import { ROLES_PERMITIDOS } from '../../common/auth/roles.decorator';
import { ApprovedFoundationGuard } from '../fundaciones/guards/approved-foundation.guard';
import { SolicitudesAdoptanteController } from '../solicitudes/solicitudes-adoptante.controller';
import { SolicitudesFundacionController } from '../solicitudes/solicitudes-fundacion.controller';
import { AdopcionesAdoptanteController } from './adopciones-adoptante.controller';
import { AdopcionesFundacionController } from './adopciones-fundacion.controller';
import { DecisionController } from './decision.controller';

type Clase = { prototype: object };

function handlers(clase: Clase): [string, (...args: never[]) => unknown][] {
  return Object.getOwnPropertyNames(clase.prototype)
    .filter((n) => n !== 'constructor')
    .map((n) => [n, (clase.prototype as Record<string, (...args: never[]) => unknown>)[n]] as const)
    .filter(([, h]) => Reflect.hasMetadata(METHOD_METADATA, h))
    .map(([n, h]) => [n, h]);
}

const reflector = new Reflector();

describe('cableado de rutas de solicitudes y adopciones', () => {
  it.each([
    ['SolicitudesAdoptanteController', SolicitudesAdoptanteController, 'adoptante', false],
    ['AdopcionesAdoptanteController', AdopcionesAdoptanteController, 'adoptante', false],
    ['SolicitudesFundacionController', SolicitudesFundacionController, 'fundacion', true],
    ['AdopcionesFundacionController', AdopcionesFundacionController, 'fundacion', true],
    ['DecisionController', DecisionController, 'fundacion', true],
  ])('%s: ninguna ruta es pública y exige su rol', (_n, controller, rol, aprobada) => {
    expect(handlers(controller).length).toBeGreaterThan(0);
    for (const [nombre, handler] of handlers(controller)) {
      expect([nombre, reflector.get(ES_PUBLICA, handler)]).toEqual([nombre, undefined]);
    }
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, controller)).toEqual([rol]);
    const guards = (Reflect.getMetadata('__guards__', controller) ?? []) as unknown[];
    expect(guards.includes(ApprovedFoundationGuard)).toBe(aprobada);
  });
});
