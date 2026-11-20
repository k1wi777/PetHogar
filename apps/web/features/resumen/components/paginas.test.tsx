import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PaginaAdministrador from '@/app/(administrador)/administrador/page';
import PaginaAdoptante from '@/app/(adoptante)/adoptante/page';
import PaginaFundacion from '@/app/(fundacion)/fundacion/page';

vi.mock('./PantallaResumenAdoptante', () => ({
  PantallaResumenAdoptante: () => <p>pantalla adoptante</p>,
}));
vi.mock('./PantallaResumenFundacion', () => ({
  PantallaResumenFundacion: () => <p>pantalla fundación</p>,
}));
vi.mock('./PantallaResumenAdministrador', () => ({
  PantallaResumenAdministrador: () => <p>pantalla administrador</p>,
}));

describe('páginas de inicio de los paneles', () => {
  it.each([
    ['adoptante', PaginaAdoptante],
    ['fundación', PaginaFundacion],
    ['administrador', PaginaAdministrador],
  ])('la del %s renderiza su pantalla de resumen', (rol, Pagina) => {
    render(<Pagina />);
    expect(screen.getByText(`pantalla ${rol}`)).toBeVisible();
  });
});
