import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Rol } from '@/shared/api/tipos';
import { notificacion } from '../prueba-datos';
import { destinoDe, listaDelPanel } from './destino';

const con = (tipo: string, id: number) => notificacion({ referencia: { tipo, id } });

describe('destinoDe: tipo × rol', () => {
  it.each([
    ['fundacion', 'solicitud', '/fundacion/solicitudes/7'],
    ['fundacion', 'seguimiento', '/fundacion/adopciones/seguimientos/7'],
    ['fundacion', 'fundacion', '/fundacion'],
    ['fundacion', 'donacion', '/fundacion/donaciones'],
    ['fundacion', 'adopcion', '/fundacion/notificaciones'],
    ['adoptante', 'solicitud', '/adoptante/solicitudes/7'],
    ['adoptante', 'adopcion', '/adoptante/adopciones'],
    ['adoptante', 'seguimiento', '/adoptante/adopciones/seguimientos/7'],
    ['adoptante', 'donacion', '/adoptante/notificaciones'],
    ['adoptante', 'fundacion', '/adoptante/notificaciones'],
    ['administrador', 'fundacion', '/administrador/fundaciones/7'],
    ['administrador', 'solicitud', '/administrador/notificaciones'],
  ] as const)('%s con referencia %s lleva a %s', (rol, tipo, ruta) => {
    expect(destinoDe(con(tipo, 7), rol)).toBe(ruta);
  });

  it('un adoptante nunca recibe una ruta de la fundación ni del administrador', () => {
    for (const tipo of ['solicitud', 'seguimiento', 'fundacion', 'donacion', 'adopcion']) {
      expect(destinoDe(con(tipo, 3), 'adoptante').startsWith('/adoptante/')).toBe(true);
    }
  });

  it('sin referencia, tipo desconocido o tipo heredado de Object cae en la lista del panel', () => {
    expect(destinoDe(notificacion({ referencia: null }), 'fundacion')).toBe(
      '/fundacion/notificaciones',
    );
    expect(destinoDe(con('mascota', 3), 'adoptante')).toBe('/adoptante/notificaciones');
    expect(destinoDe(con('constructor', 3), 'adoptante')).toBe('/adoptante/notificaciones');
    expect(destinoDe(con('__proto__', 3), 'fundacion')).toBe('/fundacion/notificaciones');
  });

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2])(
    'el id %s no entero positivo cae en la lista del panel',
    (id) => {
      expect(destinoDe(con('solicitud', id), 'fundacion')).toBe('/fundacion/notificaciones');
    },
  );
});

/** Rutas reales de `app/` (sin grupos de rutas; `[id]` como patrón). */
function rutasDeApp(): string[] {
  const raiz = join(process.cwd(), 'app');
  const rutas: string[] = [];
  const recorrer = (dir: string, segmentos: string[]) => {
    for (const nombre of readdirSync(dir)) {
      const completo = join(dir, nombre);
      if (statSync(completo).isDirectory()) {
        const esGrupo = nombre.startsWith('(') && nombre.endsWith(')');
        recorrer(completo, esGrupo ? segmentos : [...segmentos, nombre]);
      } else if (nombre === 'page.tsx') {
        rutas.push('/' + segmentos.join('/'));
      }
    }
  };
  recorrer(raiz, []);
  return rutas;
}

describe('cada destino existe en app/', () => {
  const rutas = rutasDeApp();
  const existe = (ruta: string) =>
    rutas.some((patron) => {
      const a = patron.split('/');
      const b = ruta.split('/');
      return (
        a.length === b.length &&
        a.every((s, i) => (s === '[id]' ? /^\d+$/.test(b[i]!) : s === b[i]))
      );
    });

  it('los tres roles × todos los tipos conocidos (y una referencia ausente) llevan a páginas reales', () => {
    const tipos = ['solicitud', 'seguimiento', 'fundacion', 'donacion', 'adopcion', 'mascota'];
    for (const rol of ['fundacion', 'adoptante', 'administrador'] as Rol[]) {
      expect(existe(listaDelPanel(rol)), listaDelPanel(rol)).toBe(true);
      for (const tipo of tipos) {
        const ruta = destinoDe(con(tipo, 12), rol);
        expect(existe(ruta), `${rol}/${tipo} → ${ruta}`).toBe(true);
      }
    }
  });
});
