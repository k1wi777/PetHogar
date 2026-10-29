import type { Response } from 'express';
import {
  borrarCookieRefresh,
  escribirCookieRefresh,
  leerCookie,
  NOMBRE_COOKIE_REFRESH,
} from './cookie-refresh';

describe('cookie-refresh', () => {
  it('lee la cookie entre otras y devuelve undefined si no está o está vacía', () => {
    expect(leerCookie('a=1; refresh_token=abc_-D; b=2', 'refresh_token')).toBe('abc_-D');
    expect(leerCookie('xrefresh_token=1', 'refresh_token')).toBeUndefined();
    expect(leerCookie('refresh_token=', 'refresh_token')).toBeUndefined();
    expect(leerCookie(undefined, 'refresh_token')).toBeUndefined();
  });

  it('escribe la cookie httpOnly, SameSite=Lax, acotada a /api/auth y con la vigencia dada', () => {
    const res = { cookie: jest.fn() } as unknown as Response;
    escribirCookieRefresh(res, 'tok', true, 1000);
    expect(res.cookie).toHaveBeenCalledWith(NOMBRE_COOKIE_REFRESH, 'tok', {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/api/auth',
      maxAge: 1000,
    });
  });

  it('borra la cookie con las mismas opciones de ámbito', () => {
    const res = { clearCookie: jest.fn() } as unknown as Response;
    borrarCookieRefresh(res, false);
    expect(res.clearCookie).toHaveBeenCalledWith(NOMBRE_COOKIE_REFRESH, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/auth',
    });
  });
});
