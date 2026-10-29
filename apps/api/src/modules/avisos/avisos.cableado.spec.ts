import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AdminModule } from '../admin/admin.module';
import { AdopcionesModule } from '../adopciones/adopciones.module';
import { AuthModule } from '../auth/auth.module';
import { DonacionesModule } from '../donaciones/donaciones.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { SeguimientosModule } from '../seguimientos/seguimientos.module';
import { SolicitudesModule } from '../solicitudes/solicitudes.module';
import { AvisosListener } from './avisos.listener';
import { AvisosModule } from './avisos.module';

type Importable = Type<unknown> | { module: Type<unknown> } | { forwardRef: () => Type<unknown> };

const claseDe = (i: Importable): Type<unknown> =>
  typeof i === 'function' ? i : 'module' in i ? i.module : i.forwardRef();
const importsDe = (m: Type<unknown>): Type<unknown>[] =>
  ((Reflect.getMetadata(MODULE_METADATA.IMPORTS, m) ?? []) as Importable[]).map(claseDe);

/** Todos los módulos alcanzables desde `raiz` (incluida). */
function alcanzables(raiz: Type<unknown>): Set<Type<unknown>> {
  const vistos = new Set<Type<unknown>>();
  const pendientes = [raiz];
  while (pendientes.length > 0) {
    const modulo = pendientes.pop() as Type<unknown>;
    if (vistos.has(modulo)) continue;
    vistos.add(modulo);
    pendientes.push(...importsDe(modulo));
  }
  return vistos;
}

describe('cableado de avisos, donaciones y notificaciones', () => {
  it('notificaciones es un módulo hoja: solo importa TypeORM, ningún módulo de dominio', () => {
    expect(importsDe(NotificacionesModule).map((m) => m.name)).toEqual(['TypeOrmModule']);
  });

  it('donaciones no conoce a notificaciones ni a avisos', () => {
    const alcance = alcanzables(DonacionesModule);
    expect(alcance.has(NotificacionesModule)).toBe(false);
    expect(alcance.has(AvisosModule)).toBe(false);
  });

  it('avisos depende de los módulos dueños y ninguno de ellos depende de avisos', () => {
    const directos = importsDe(AvisosModule);
    expect(directos).toEqual(
      expect.arrayContaining([NotificacionesModule, DonacionesModule, SeguimientosModule]),
    );
    for (const modulo of [
      NotificacionesModule,
      DonacionesModule,
      SeguimientosModule,
      SolicitudesModule,
      AdopcionesModule,
      AuthModule,
      AdminModule,
    ]) {
      expect(alcanzables(modulo).has(AvisosModule)).toBe(false);
    }
  });

  it('sin forwardRef en los módulos nuevos', () => {
    for (const modulo of [AvisosModule, DonacionesModule, NotificacionesModule]) {
      const crudos = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, modulo) ?? []) as Importable[];
      expect(crudos.some((i) => typeof i === 'object' && 'forwardRef' in i)).toBe(false);
    }
  });

  it('avisos es el único módulo con listeners: registra AvisosListener', () => {
    const proveedores = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AvisosModule) as unknown[];
    expect(proveedores).toContain(AvisosListener);
  });
});
