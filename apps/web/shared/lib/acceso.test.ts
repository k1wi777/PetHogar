import { describe, expect, it } from 'vitest';
import { MENU_POR_ROL, resolverAcceso, rolDelPanel, rutaInternaSegura } from './acceso';

describe('rolDelPanel', () => {
  it('reconoce los paneles y no confunde prefijos', () => {
    expect(rolDelPanel('/fundacion')).toBe('fundacion');
    expect(rolDelPanel('/fundacion/mascotas')).toBe('fundacion');
    expect(rolDelPanel('/fundaciones')).toBeNull();
    expect(rolDelPanel('/adoptante-x')).toBeNull();
    expect(rolDelPanel('/')).toBeNull();
  });
});

describe('resolverAcceso', () => {
  it.each([
    ['adoptante', '/adoptante/solicitudes'],
    ['fundacion', '/fundacion'],
    ['administrador', '/administrador/usuarios'],
  ] as const)('%s entra a su panel %s', (rol, ruta) => {
    expect(resolverAcceso(ruta, rol)).toEqual({ tipo: 'permitir' });
  });

  it.each([
    ['adoptante', '/fundacion/mascotas'],
    ['adoptante', '/administrador'],
    ['fundacion', '/adoptante'],
    ['fundacion', '/administrador/usuarios'],
    ['administrador', '/fundacion'],
    ['administrador', '/adoptante/solicitudes'],
  ] as const)('%s no entra a %s: va a /403', (rol, ruta) => {
    expect(resolverAcceso(ruta, rol)).toEqual({ tipo: 'redirigir', destino: '/403' });
  });

  it('sin indicio o con indicio inválido va a /ingresar conservando la ruta', () => {
    const esperado = {
      tipo: 'redirigir',
      destino: '/ingresar?siguiente=%2Ffundacion%2Fmascotas%3Fpage%3D2',
    };
    expect(resolverAcceso('/fundacion/mascotas', undefined, '?page=2')).toEqual(esperado);
    expect(resolverAcceso('/fundacion/mascotas', 'superadmin', '?page=2')).toEqual(esperado);
    expect(resolverAcceso('/fundacion/mascotas', '', '?page=2')).toEqual(esperado);
  });

  it('/ingresar con sesión indicada redirige al panel del rol; sin ella, permite', () => {
    expect(resolverAcceso('/ingresar', 'fundacion')).toEqual({
      tipo: 'redirigir',
      destino: '/fundacion',
    });
    expect(resolverAcceso('/ingresar', 'adoptante')).toEqual({
      tipo: 'redirigir',
      destino: '/adoptante',
    });
    expect(resolverAcceso('/ingresar', undefined)).toEqual({ tipo: 'permitir' });
    expect(resolverAcceso('/ingresar', 'raro')).toEqual({ tipo: 'permitir' });
  });

  it('las rutas públicas siempre se permiten', () => {
    expect(resolverAcceso('/', undefined)).toEqual({ tipo: 'permitir' });
    expect(resolverAcceso('/403', 'adoptante')).toEqual({ tipo: 'permitir' });
  });
});

describe('rutaInternaSegura', () => {
  it('solo acepta rutas internas', () => {
    expect(rutaInternaSegura('/fundacion/mascotas?x=1')).toBe('/fundacion/mascotas?x=1');
    expect(rutaInternaSegura('//evil.com')).toBeNull();
    expect(rutaInternaSegura('https://evil.com')).toBeNull();
    expect(rutaInternaSegura('/\\evil.com')).toBeNull();
    expect(rutaInternaSegura(null)).toBeNull();
  });
});

describe('MENU_POR_ROL', () => {
  it('cada opción pertenece al panel de su rol y no hay rutas repetidas', () => {
    for (const [rol, menu] of Object.entries(MENU_POR_ROL)) {
      const hrefs = menu.map((o) => o.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      for (const o of menu) expect(rolDelPanel(o.href)).toBe(rol);
    }
  });
});
