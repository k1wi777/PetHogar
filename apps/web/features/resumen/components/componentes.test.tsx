import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseQueryResult } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '@/shared/api/errores';
import { AccesosRapidos } from './AccesosRapidos';
import { CifraResumen } from './CifraResumen';
import { FilaResumen } from './FilaResumen';
import { SeccionResumen } from './SeccionResumen';
import { TarjetaNotificaciones } from './TarjetaNotificaciones';
import { TarjetaSeguimientos } from './TarjetaSeguimientos';
import type { ResumenSeguimientos } from '../types';

type C<T = unknown> = Parameters<typeof SeccionResumen<T>>[0]['consulta'];
const consulta = <T = string[],>(p: Partial<C<T>>): C<T> => ({
  data: undefined,
  isPending: false,
  isError: false,
  error: null,
  isFetching: false,
  refetch: vi.fn(),
  ...p,
});
const comoResultado = <T,>(p: Partial<C<T>>) => consulta<T>(p) as unknown as UseQueryResult<T>;

const props = {
  titulo: 'Mis solicitudes',
  vacio: { titulo: 'Aún no tienes solicitudes', accion: <a href="/adoptar">Buscar mascotas</a> },
  esVacio: (d: string[]) => d.length === 0,
};

describe('SeccionResumen', () => {
  it('anuncia la carga solo en su tarjeta', () => {
    render(
      <SeccionResumen {...props} consulta={consulta({ isPending: true })}>
        {() => null}
      </SeccionResumen>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    expect(screen.getByRole('region', { name: 'Mis solicitudes' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('muestra el error amable con Reintentar que vuelve a pedir esa consulta', async () => {
    const refetch = vi.fn();
    render(
      <SeccionResumen
        {...props}
        consulta={consulta({
          isError: true,
          error: new ErrorApi({ tipo: 'http', estado: 500, mensaje: 'TypeError: boom' }),
          refetch,
        })}
      >
        {() => null}
      </SeccionResumen>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'No pudimos cargar mis solicitudes' }),
    ).toBeVisible();
    expect(document.body.textContent).not.toMatch(/undefined|\[object|Error:|NaN|boom/);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('muestra el vacío con su enlace de acción', () => {
    render(
      <SeccionResumen {...props} consulta={consulta({ data: [] })}>
        {() => <p>datos</p>}
      </SeccionResumen>,
    );
    expect(screen.getByRole('heading', { name: 'Aún no tienes solicitudes' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Buscar mascotas' })).toHaveAttribute(
      'href',
      '/adoptar',
    );
  });

  it('muestra los datos con un h2 y su enlace', () => {
    render(
      <SeccionResumen
        {...props}
        enlace={{ href: '/adoptante/solicitudes', texto: 'Ver todas' }}
        consulta={consulta({ data: ['a'] })}
      >
        {(d) => <p>{d[0]}</p>}
      </SeccionResumen>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Mis solicitudes' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute(
      'href',
      '/adoptante/solicitudes',
    );
  });
});

describe('piezas del resumen', () => {
  it('la cifra con enlace incluye su etiqueta', () => {
    render(
      <CifraResumen
        etiqueta="Disponibles"
        valor={4}
        href="/fundacion/mascotas?estado=disponible"
      />,
    );
    expect(screen.getByRole('link', { name: /Disponibles\s*4/ })).toHaveAttribute(
      'href',
      '/fundacion/mascotas?estado=disponible',
    );
  });

  it('la fila muestra el estado en texto y da contexto a lectores', () => {
    render(
      <ul>
        <FilaResumen href="/x/1" contexto="Solicitud de" titulo="Luna" estado="pendiente" />
      </ul>,
    );
    expect(screen.getByRole('link', { name: /Solicitud de Luna.*Pendiente/ })).toBeVisible();
  });

  it('los accesos rápidos son enlaces', () => {
    render(
      <AccesosRapidos
        accesos={[{ href: '/adoptar', texto: 'Buscar mascotas', principal: true }]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Buscar mascotas' })).toHaveAttribute(
      'href',
      '/adoptar',
    );
  });

  it('notificaciones muestra el contador sin leer', () => {
    render(<TarjetaNotificaciones consulta={comoResultado<number>({ data: 3 })} href="/n" />);
    expect(screen.getByText('Sin leer')).toBeVisible();
    expect(screen.getByText('3')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ver mis notificaciones' })).toHaveAttribute(
      'href',
      '/n',
    );
  });

  it('seguimientos destaca vencidos con su estado en texto y «o más» si es parcial', () => {
    const datos: ResumenSeguimientos = {
      vencidos: 1,
      programados: 100,
      parcial: true,
      destacados: [
        {
          id: 9,
          tipo: 'visita',
          fechaProgramada: '2026-10-01',
          estado: 'programado',
          vencido: true,
          mascota: { id: 1, nombre: 'Luna' },
          adoptante: { nombreCompleto: 'Ana Pérez' },
        },
      ],
    };
    render(
      <TarjetaSeguimientos
        consulta={comoResultado<ResumenSeguimientos>({ data: datos })}
        rutaLista="/l"
        rutaDetalle={(id) => `/s/${id}`}
        contraparte={(s) => s.adoptante?.nombreCompleto}
      />,
    );
    expect(screen.getByText('100 o más')).toBeVisible();
    const enlace = screen.getByRole('link', { name: /Visita de Luna.*Vencido/ });
    expect(enlace).toHaveAttribute('href', '/s/9');
    expect(enlace).toHaveTextContent('Ana Pérez');
  });
});
