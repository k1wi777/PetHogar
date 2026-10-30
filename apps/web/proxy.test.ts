import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

function pedir(ruta: string, rol?: string) {
  return proxy(
    new NextRequest(`http://localhost:3000${ruta}`, {
      headers: rol === undefined ? {} : { cookie: `ph_rol=${rol}` },
    }),
  );
}

function destino(respuesta: Response): string | null {
  const l = respuesta.headers.get('location');
  return l ? new URL(l).pathname + new URL(l).search : null;
}

describe('proxy', () => {
  it('sin indicio redirige a /ingresar con la ruta de origen', () => {
    const r = pedir('/fundacion/mascotas?page=2');
    expect(r.status).toBe(307);
    expect(destino(r)).toBe('/ingresar?siguiente=%2Ffundacion%2Fmascotas%3Fpage%3D2');
  });

  it.each([
    ['adoptante', '/fundacion'],
    ['adoptante', '/administrador/usuarios'],
    ['fundacion', '/adoptante'],
    ['administrador', '/fundacion/mascotas'],
  ])('%s en %s va a /403', (rol, ruta) => {
    expect(destino(pedir(ruta, rol))).toBe('/403');
  });

  it.each([
    ['adoptante', '/adoptante/solicitudes'],
    ['fundacion', '/fundacion'],
    ['administrador', '/administrador'],
  ])('%s en %s continúa', (rol, ruta) => {
    const r = pedir(ruta, rol);
    expect(r.headers.get('location')).toBeNull();
    expect(r.headers.get('x-middleware-next')).toBe('1');
  });

  it('un indicio con valor desconocido se trata como ausente', () => {
    expect(destino(pedir('/fundacion', 'hacker'))).toMatch(/^\/ingresar\?siguiente=/);
  });

  it('/ingresar con indicio lleva al panel del rol', () => {
    expect(destino(pedir('/ingresar', 'administrador'))).toBe('/administrador');
  });

  it('el matcher cubre los tres paneles e /ingresar y no /_kit', () => {
    expect(config.matcher).toEqual([
      '/adoptante/:path*',
      '/fundacion/:path*',
      '/administrador/:path*',
      '/ingresar',
    ]);
  });
});
