import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usuarioDe } from '@/shared/testing/prueba-utils';
import { GuardaFundacionAprobada } from './GuardaFundacionAprobada';

const fundacion = (
  estadoValidacion: 'pendiente' | 'aprobada' | 'rechazada',
  observacionValidacion: string | null = null,
) => usuarioDe('fundacion', { id: 1, nombre: 'Patitas', estadoValidacion, observacionValidacion });

const sesion = vi.hoisted(() => ({ valor: {} as Record<string, unknown> }));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));
const refrescarPerfil = vi.fn(async () => {});

beforeEach(() => {
  refrescarPerfil.mockClear();
});
const poner = (usuario: unknown) => {
  sesion.valor = { estado: 'autenticado', usuario, refrescarPerfil };
};

describe('GuardaFundacionAprobada', () => {
  it('aprobada: muestra el contenido', () => {
    poner(fundacion('aprobada'));
    render(<GuardaFundacionAprobada>contenido-operativo</GuardaFundacionAprobada>);
    expect(screen.getByText('contenido-operativo')).toBeInTheDocument();
  });

  it('pendiente: explica el motivo y NO monta el contenido', () => {
    poner(fundacion('pendiente'));
    render(<GuardaFundacionAprobada>contenido-operativo</GuardaFundacionAprobada>);
    expect(screen.queryByText('contenido-operativo')).toBeNull();
    expect(screen.getByText('Tu fundación aún no está aprobada')).toBeInTheDocument();
    expect(screen.getByText(/Un administrador la revisará/)).toBeInTheDocument();
  });

  it('rechazada: muestra la observación del administrador como texto', () => {
    poner(fundacion('rechazada', '<b>Falta</b> el RUT'));
    render(<GuardaFundacionAprobada>contenido-operativo</GuardaFundacionAprobada>);
    expect(screen.getByText('La validación de tu fundación fue rechazada')).toBeInTheDocument();
    expect(
      screen.getByText(/Observación del administrador: <b>Falta<\/b> el RUT/),
    ).toBeInTheDocument();
    expect(screen.queryByText('contenido-operativo')).toBeNull();
  });

  it('rechazada sin observación indica a quién escribir', () => {
    poner(fundacion('rechazada', ' '));
    render(<GuardaFundacionAprobada>x</GuardaFundacionAprobada>);
    expect(screen.getByText(/Comunícate con un administrador/)).toBeInTheDocument();
  });

  it('«Actualizar mi estado» vuelve a consultar el perfil', async () => {
    poner(fundacion('pendiente'));
    render(<GuardaFundacionAprobada>x</GuardaFundacionAprobada>);
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar mi estado' }));
    expect(refrescarPerfil).toHaveBeenCalledTimes(1);
  });
});
