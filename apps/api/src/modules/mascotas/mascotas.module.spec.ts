import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { ES_PUBLICA } from '../../common/auth/public.decorator';
import { ROLES_PERMITIDOS } from '../../common/auth/roles.decorator';
import { CatalogosController } from '../catalogos/catalogos.controller';
import { ApprovedFoundationGuard } from '../fundaciones/guards/approved-foundation.guard';
import { MascotasCatalogoController } from './catalogo/mascotas-catalogo.controller';
import { MascotasFundacionController } from './mascotas-fundacion.controller';

type Clase = { prototype: object };

/** Rutas (métodos HTTP) declaradas por un controller. */
function handlers(clase: Clase): [string, (...args: never[]) => unknown][] {
  return Object.getOwnPropertyNames(clase.prototype)
    .filter((n) => n !== 'constructor')
    .map((n) => [n, (clase.prototype as Record<string, (...args: never[]) => unknown>)[n]] as const)
    .filter(([, h]) => Reflect.hasMetadata(METHOD_METADATA, h))
    .map(([n, h]) => [n, h]);
}

const reflector = new Reflector();
const tieneLimite = (h: object): boolean =>
  Reflect.getMetadataKeys(h).some((k) => String(k).includes('THROTTLER:LIMIT'));

describe('cableado de rutas de mascotas y catálogos', () => {
  it.each([
    ['CatalogosController', CatalogosController],
    ['MascotasCatalogoController', MascotasCatalogoController],
  ])('%s: todas sus rutas son @Public() y con @Throttle', (_n, controller) => {
    const rutas = handlers(controller);
    expect(rutas.length).toBeGreaterThan(0);
    for (const [nombre, handler] of rutas) {
      expect([nombre, reflector.get(ES_PUBLICA, handler)]).toEqual([nombre, true]);
      expect([nombre, tieneLimite(handler)]).toEqual([nombre, true]);
    }
  });

  it('MascotasFundacionController: ninguna ruta es pública; rol fundación y guard de aprobación en la clase', () => {
    const rutas = handlers(MascotasFundacionController);
    expect(rutas.length).toBe(9);
    for (const [nombre, handler] of rutas) {
      expect([
        nombre,
        reflector.getAllAndOverride(ES_PUBLICA, [handler, MascotasFundacionController]),
      ]).toEqual([nombre, undefined]);
    }
    expect(Reflect.getMetadata(ROLES_PERMITIDOS, MascotasFundacionController)).toEqual([
      'fundacion',
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, MascotasFundacionController)).toContain(
      ApprovedFoundationGuard,
    );
  });

  it('solo la subida de fotos lleva un límite propio entre las rutas de gestión', () => {
    const conLimite = handlers(MascotasFundacionController)
      .filter(([, h]) => tieneLimite(h))
      .map(([n]) => n);
    expect(conLimite).toEqual(['subirFoto']);
  });
});
