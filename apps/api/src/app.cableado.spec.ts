import 'reflect-metadata';
import type { Type } from '@nestjs/common';
import { AdminModule } from './modules/admin/admin.module';
import { AvisosModule } from './modules/avisos/avisos.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogosModule } from './modules/catalogos/catalogos.module';
import { DonacionesModule } from './modules/donaciones/donaciones.module';
import { FundacionesModule } from './modules/fundaciones/fundaciones.module';
import { MascotasModule } from './modules/mascotas/mascotas.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { SolicitudesModule } from './modules/solicitudes/solicitudes.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AdopcionesModule } from './modules/adopciones/adopciones.module';
import { SeguimientosModule } from './modules/seguimientos/seguimientos.module';

type Importable = Type<unknown> | { module: Type<unknown> } | { forwardRef: () => Type<unknown> };

const nombreDe = (m: Type<unknown>): string => m.name;
const claseDe = (i: Importable): Type<unknown> =>
  typeof i === 'function' ? i : 'module' in i ? i.module : i.forwardRef();
const importsDe = (m: Type<unknown>): Type<unknown>[] =>
  ((Reflect.getMetadata('imports', m) ?? []) as Importable[]).map(claseDe);

/** Devuelve un ciclo de módulos (si existe) como lista de nombres. */
function buscarCiclo(raiz: Type<unknown>): string[] | null {
  const enCurso: Type<unknown>[] = [];
  const visitados = new Set<Type<unknown>>();
  const visitar = (modulo: Type<unknown>): string[] | null => {
    const pos = enCurso.indexOf(modulo);
    if (pos >= 0) return [...enCurso.slice(pos), modulo].map(nombreDe);
    if (visitados.has(modulo)) return null;
    visitados.add(modulo);
    enCurso.push(modulo);
    for (const hijo of importsDe(modulo)) {
      const ciclo = visitar(hijo);
      if (ciclo) return ciclo;
    }
    enCurso.pop();
    return null;
  };
  return visitar(raiz);
}

// `AppModule` valida el entorno al importarse; se recorren los módulos de dominio uno a uno.
const MODULOS_DE_DOMINIO = [
  AdminModule,
  AuthModule,
  CatalogosModule,
  FundacionesModule,
  MascotasModule,
  SolicitudesModule,
  SeguimientosModule,
  AdopcionesModule,
  UsuariosModule,
  DonacionesModule,
  NotificacionesModule,
  AvisosModule,
];

describe('cableado de módulos', () => {
  it.each(MODULOS_DE_DOMINIO.map((m) => [m.name, m] as const))(
    'no hay dependencias circulares desde %s',
    (_nombre, modulo) => {
      expect(buscarCiclo(modulo)).toBeNull();
    },
  );

  it('adopciones depende de seguimientos y no al revés (sin forwardRef)', () => {
    expect(importsDe(AdopcionesModule)).toContain(SeguimientosModule);
    expect(importsDe(SeguimientosModule)).not.toContain(AdopcionesModule);
    for (const modulo of [AdopcionesModule, SeguimientosModule]) {
      const crudos = (Reflect.getMetadata('imports', modulo) ?? []) as Importable[];
      expect(crudos.some((i) => typeof i === 'object' && 'forwardRef' in i)).toBe(false);
    }
  });

  it('el detector encuentra un ciclo cuando lo hay', () => {
    class A {}
    class B {}
    Reflect.defineMetadata('imports', [B], A);
    Reflect.defineMetadata('imports', [A], B);
    expect(buscarCiclo(A)).toEqual(['A', 'B', 'A']);
  });
});
