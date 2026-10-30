import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rol, Usuario } from '@/shared/api/tipos';
import { MENU_POR_ROL } from '@/shared/lib/acceso';
import { CabeceraPublica } from './CabeceraPublica';
import { GuardaRol } from './GuardaRol';
import { ShellPanel } from './ShellPanel';

const replace = vi.fn();
let ruta = '/fundacion';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => ruta,
}));

const sesion = vi.hoisted(() => ({
  valor: {} as Record<string, unknown>,
}));
vi.mock('@/shared/auth/SesionProvider', () => ({ useSesion: () => sesion.valor }));

function usuario(
  rol: Rol,
  estadoValidacion: 'pendiente' | 'aprobada' | 'rechazada' = 'aprobada',
): Usuario {
  return {
    id: 1,
    email: 'u@x.co',
    telefono: '300',
    rol,
    adoptante:
      rol === 'adoptante'
        ? {
            primerNombre: 'Ana',
            segundoNombre: null,
            primerApellido: 'Pérez',
            segundoApellido: null,
          }
        : null,
    fundacion:
      rol === 'fundacion'
        ? { id: 1, nombre: 'Patitas', estadoValidacion, observacionValidacion: null }
        : null,
  };
}

function poner(estado: string, u: Usuario | null = null, extra: Record<string, unknown> = {}) {
  sesion.valor = {
    estado,
    usuario: u,
    reintentar: vi.fn(),
    cerrarSesion: vi.fn(async () => true),
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  ruta = '/fundacion';
});

describe('GuardaRol', () => {
  it('rol correcto: muestra el contenido', () => {
    poner('autenticado', usuario('fundacion'));
    render(<GuardaRol rol="fundacion">contenido-privado</GuardaRol>);
    expect(screen.getByText('contenido-privado')).toBeInTheDocument();
  });

  it.each([
    ['adoptante', 'fundacion'],
    ['fundacion', 'administrador'],
    ['administrador', 'adoptante'],
  ] as const)('un %s en el panel de %s ve el 403 y NO el contenido', (real, panel) => {
    poner('autenticado', usuario(real));
    render(<GuardaRol rol={panel}>contenido-privado</GuardaRol>);
    expect(screen.getByRole('heading', { name: /No tienes permiso/ })).toBeInTheDocument();
    expect(screen.queryByText('contenido-privado')).toBeNull();
  });

  it('cargando muestra un esqueleto sin contenido', () => {
    poner('cargando');
    render(<GuardaRol rol="fundacion">contenido-privado</GuardaRol>);
    expect(screen.getByRole('status')).toHaveTextContent(/Verificando/);
    expect(screen.queryByText('contenido-privado')).toBeNull();
  });

  it('anónimo redirige a /ingresar con la ruta de origen', () => {
    ruta = '/fundacion/mascotas';
    poner('anonimo');
    render(<GuardaRol rol="fundacion">contenido-privado</GuardaRol>);
    expect(replace).toHaveBeenCalledWith('/ingresar?siguiente=%2Ffundacion%2Fmascotas');
    expect(screen.queryByText('contenido-privado')).toBeNull();
  });

  it('sin conexión muestra el mensaje con «Reintentar»', async () => {
    const reintentar = vi.fn();
    poner('sin-conexion', null, { reintentar });
    render(<GuardaRol rol="fundacion">contenido-privado</GuardaRol>);
    expect(screen.getByText('No pudimos conectar con el servidor')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reintentar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('contenido-privado')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sin conexión por límite (429) explica la espera y no culpa a la conexión', () => {
    poner('sin-conexion', null, { motivoSinConexion: 'limite' });
    render(<GuardaRol rol="fundacion">contenido-privado</GuardaRol>);
    expect(screen.getByText('Hay demasiados intentos en este momento')).toBeInTheDocument();
    expect(screen.getByText(/Espera un minuto/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('ShellPanel', () => {
  it.each(['adoptante', 'fundacion', 'administrador'] as const)(
    'el menú del rol %s tiene sus opciones',
    (rol) => {
      ruta = MENU_POR_ROL[rol][0]!.href;
      poner('autenticado', usuario(rol));
      render(
        <ShellPanel rol={rol}>
          <p>hijo</p>
        </ShellPanel>,
      );
      const menu = screen.getByRole('navigation', { name: 'Principal' });
      const etiquetas = within(menu)
        .getAllByRole('link')
        .map((a) => a.textContent);
      expect(etiquetas).toEqual(MENU_POR_ROL[rol].map((o) => o.etiqueta));
      expect(within(menu).getAllByRole('link')[0]).toHaveAttribute('aria-current', 'page');
      expect(screen.getByText('hijo')).toBeInTheDocument();
    },
  );

  it('marca como activa solo la opción de la ruta actual', () => {
    ruta = '/fundacion/mascotas/12';
    poner('autenticado', usuario('fundacion'));
    render(<ShellPanel rol="fundacion">x</ShellPanel>);
    const activos = screen.getAllByRole('link', { current: 'page' });
    expect(activos).toHaveLength(1);
    expect(activos[0]).toHaveTextContent('Mis mascotas');
  });

  it('muestra el nombre y el aviso si la fundación está pendiente', () => {
    poner('autenticado', usuario('fundacion', 'pendiente'));
    render(<ShellPanel rol="fundacion">x</ShellPanel>);
    expect(screen.getByText('Patitas')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/pendiente de validación/);
  });

  it('en móvil el menú se abre y cierra con teclado y se cierra al navegar', async () => {
    const usuarioEv = userEvent.setup();
    poner('autenticado', usuario('adoptante'));
    render(<ShellPanel rol="adoptante">x</ShellPanel>);
    const boton = screen.getByRole('button', { name: 'Abrir menú' });
    boton.focus();
    await usuarioEv.keyboard('{Enter}');
    const hoja = await screen.findByRole('dialog', { name: 'Panel del adoptante' });
    expect(within(hoja).getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    await usuarioEv.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await usuarioEv.click(screen.getByRole('button', { name: 'Abrir menú' }));
    await usuarioEv.click(
      within(await screen.findByRole('dialog')).getByRole('link', { name: 'Mis adopciones' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cerrar sesión pide confirmación y Cancelar no cierra', async () => {
    const u = userEvent.setup();
    const cerrarSesion = vi.fn(async () => true);
    poner('autenticado', usuario('fundacion'), { cerrarSesion });
    render(<ShellPanel rol="fundacion">x</ShellPanel>);
    await u.click(screen.getByRole('button', { name: /Cerrar sesión/ }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Cerrar sesión?' });
    expect(cerrarSesion).not.toHaveBeenCalled();
    await u.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog', { name: '¿Cerrar sesión?' })).toBeNull();
    expect(cerrarSesion).not.toHaveBeenCalled();
  });

  it('Escape también cancela y confirmar ejecuta el cierre una vez', async () => {
    const u = userEvent.setup();
    const cerrarSesion = vi.fn(async () => true);
    poner('autenticado', usuario('fundacion'), { cerrarSesion });
    render(<ShellPanel rol="fundacion">x</ShellPanel>);
    await u.click(screen.getByRole('button', { name: /Cerrar sesión/ }));
    await screen.findByRole('dialog');
    await u.keyboard('{Escape}');
    expect(cerrarSesion).not.toHaveBeenCalled();
    await u.click(screen.getByRole('button', { name: /Cerrar sesión/ }));
    await u.click(await screen.findByRole('button', { name: 'Sí, cerrar sesión' }));
    await act(async () => {});
    expect(cerrarSesion).toHaveBeenCalledTimes(1);
  });

  it('si el cierre falla, el diálogo se cierra y la sesión sigue', async () => {
    const u = userEvent.setup();
    const cerrarSesion = vi.fn(async () => false);
    poner('autenticado', usuario('fundacion'), { cerrarSesion });
    render(<ShellPanel rol="fundacion">x</ShellPanel>);
    await u.click(screen.getByRole('button', { name: /Cerrar sesión/ }));
    await u.click(await screen.findByRole('button', { name: 'Sí, cerrar sesión' }));
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('CabeceraPublica', () => {
  it('ofrece Adoptar, Donar e Ingresar a un visitante', () => {
    poner('anonimo');
    render(<CabeceraPublica />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getByRole('link', { name: 'Adoptar' })).toHaveAttribute('href', '/adoptar');
    expect(within(nav).getByRole('link', { name: 'Donar' })).toHaveAttribute(
      'href',
      '/adoptante/donar',
    );
    expect(within(nav).getByRole('link', { name: 'Ingresar' })).toHaveAttribute(
      'href',
      '/ingresar',
    );
    expect(within(nav).getByRole('link', { name: 'Registrarme' })).toHaveAttribute(
      'href',
      '/registro',
    );
    expect(within(nav).getByRole('link', { name: 'Registrar fundación' })).toHaveAttribute(
      'href',
      '/registro-fundacion',
    );
  });

  it('con sesión ofrece «Mi panel» hacia el panel del rol', () => {
    poner('autenticado', usuario('fundacion'));
    render(<CabeceraPublica />);
    expect(screen.getByRole('link', { name: 'Mi panel' })).toHaveAttribute('href', '/fundacion');
    expect(screen.queryByRole('link', { name: 'Ingresar' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Registrarme' })).toBeNull();
  });
});
