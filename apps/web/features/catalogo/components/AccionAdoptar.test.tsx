import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rol, Usuario } from '@/shared/api/tipos';
import type { ContextoSesion, EstadoSesion } from '@/shared/auth/SesionProvider';
import { rutaIngresoParaAdoptar, rutaSolicitud } from '../lib/solicitud';
import { AccionAdoptar } from './AccionAdoptar';

let sesion: Pick<ContextoSesion, 'estado' | 'usuario'>;
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion }));

function con(estado: EstadoSesion, rol?: Rol) {
  sesion = {
    estado,
    usuario: rol
      ? ({ id: 1, rol, email: 'a@b.c', telefono: '1', adoptante: null, fundacion: null } as Usuario)
      : null,
  };
}

beforeEach(() => con('anonimo'));

describe('AccionAdoptar', () => {
  it('anónimo: enlace a ingresar con retorno a la ficha', () => {
    render(<AccionAdoptar mascotaId={5} />);
    const enlace = screen.getByRole('link', { name: 'Quiero adoptar' });
    expect(enlace).toHaveAttribute('href', '/ingresar?siguiente=%2Fmascotas%2F5');
    expect(enlace.getAttribute('href')).toBe(rutaIngresoParaAdoptar(5));
  });

  it('sin conexión se comporta como anónimo', () => {
    con('sin-conexion');
    render(<AccionAdoptar mascotaId={5} />);
    expect(screen.getByRole('link', { name: 'Quiero adoptar' })).toBeInTheDocument();
  });

  it('mientras carga la sesión no muestra nada accionable', () => {
    con('cargando');
    render(<AccionAdoptar mascotaId={5} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each<Rol>(['fundacion', 'administrador'])('%s no ve «Quiero adoptar»', (rol) => {
    con('autenticado', rol);
    const { container } = render(<AccionAdoptar mascotaId={5} />);
    expect(screen.queryByText('Quiero adoptar')).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('adoptante: enlace al formulario de solicitud de esa mascota, sin aviso provisional', () => {
    con('autenticado', 'adoptante');
    render(<AccionAdoptar mascotaId={5} />);
    const enlace = screen.getByRole('link', { name: 'Quiero adoptar' });
    expect(enlace).toHaveAttribute('href', '/adoptante/solicitudes/nueva?mascota=5');
    expect(enlace.getAttribute('href')).toBe(rutaSolicitud(5));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(/pronto podrás/)).toBeNull();
  });

  it('la ruta de la solicitud está centralizada', () => {
    expect(rutaSolicitud(5)).toBe('/adoptante/solicitudes/nueva?mascota=5');
  });
});
