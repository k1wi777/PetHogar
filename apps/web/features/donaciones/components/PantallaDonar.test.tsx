import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { montarPanel, respuestaJson } from '@/shared/testing/prueba-utils';
import { PantallaDonar } from './PantallaDonar';

let consulta = '';
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(consulta) }));
vi.mock('@/shared/api/http', () =>
  import('@/shared/testing/http-prueba').then((m) => ({ http: m.httpSimulado })),
);
vi.mock('@/shared/auth/SesionProvider', () => ({
  useSesion: () => ({ estado: 'autenticado', usuario: null }),
}));
beforeEach(() => (consulta = ''));

describe('PantallaDonar', () => {
  it.each(['', 'fundacion=abc', 'fundacion=0', 'fundacion=-2&nombre=X', 'nombre=Patitas'])(
    'sin fundación válida («%s») no muestra el formulario y ofrece el catálogo',
    (q) => {
      consulta = q;
      montarPanel(<PantallaDonar />, () => respuestaJson({}));
      expect(screen.getByText('Primero elige a quién donar')).toBeInTheDocument();
      expect(screen.getByRole('note')).toHaveTextContent('PetHogar no procesa pagos');
      expect(screen.getByRole('link', { name: 'Ver mascotas en adopción' })).toHaveAttribute(
        'href',
        '/adoptar',
      );
      expect(screen.queryByRole('radio')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Revisar y registrar' })).toBeNull();
    },
  );

  it('con fundación válida muestra el formulario y el nombre como texto, no como HTML', () => {
    consulta = 'fundacion=3&nombre=' + encodeURIComponent('<b>Patitas</b>');
    montarPanel(<PantallaDonar />, () => respuestaJson({}));
    expect(screen.getByText('<b>Patitas</b>')).toBeInTheDocument();
    expect(document.querySelector('strong b')).toBeNull();
    expect(screen.getByRole('button', { name: 'Revisar y registrar' })).toBeInTheDocument();
  });
});
