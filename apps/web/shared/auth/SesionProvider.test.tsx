import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearClienteHttp } from '@/shared/api/cliente';
import type { Rol, Usuario } from '@/shared/api/tipos';
import { borrarIndicio, escribirIndicio, leerIndicio } from './indicio';
import { SesionProvider, useSesion } from './SesionProvider';

const replace = vi.fn();
let ruta = '/fundacion/mascotas';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => ruta,
}));
const aviso = vi.hoisted(() => ({ exito: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/shared/ui/Toaster', () => ({ aviso, Toaster: () => null }));

function usuario(rol: Rol = 'fundacion'): Usuario {
  return {
    id: 7,
    email: 'f@x.co',
    telefono: '300',
    rol,
    adoptante: null,
    fundacion: {
      id: 1,
      nombre: 'Patitas',
      estadoValidacion: 'aprobada',
      observacionValidacion: null,
    },
  };
}

function json(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Manejador = (ruta: string) => Response | Promise<Response>;

function montar(manejador: Manejador) {
  const fetchImpl = vi.fn(async (url: string) => manejador(url.replace('http://api.test/api', '')));
  const cliente = crearClienteHttp({ baseUrl: 'http://api.test/api', fetchImpl, cerrojos: null });
  const queryClient = new QueryClient();
  const clearSpy = vi.spyOn(queryClient, 'clear');
  let sesion!: ReturnType<typeof useSesion>;
  function Sonda() {
    sesion = useSesion();
    return <p>estado:{sesion.estado}</p>;
  }
  render(
    <QueryClientProvider client={queryClient}>
      <SesionProvider cliente={cliente}>
        <Sonda />
      </SesionProvider>
    </QueryClientProvider>,
  );
  return { fetchImpl, cliente, clearSpy, sesion: () => sesion };
}

const sesionOk = (rol: Rol = 'fundacion') =>
  json({ accessToken: 'tok', expiresIn: 900, usuario: usuario(rol) });

describe('SesionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ruta = '/fundacion/mascotas';
    borrarIndicio();
  });
  afterEach(() => borrarIndicio());

  it('restaura la sesión con refresh + /auth/me y escribe el indicio', async () => {
    escribirIndicio('fundacion');
    const { cliente } = montar((r) =>
      r === '/auth/refresh' ? sesionOk() : r === '/auth/me' ? json(usuario()) : json({}, 404),
    );
    expect(screen.getByText('estado:cargando')).toBeInTheDocument();
    await screen.findByText('estado:autenticado');
    expect(leerIndicio()).toBe('fundacion');
    expect(cliente.tokens.obtener()).toBe('tok');
  });

  it('sin el indicio ph_rol queda anónimo sin ninguna petición, avisos ni redirección (R18)', async () => {
    const { fetchImpl } = montar(() => json({ message: 'Sesión no válida' }, 401));
    await screen.findByText('estado:anonimo');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(aviso.info).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('con la API caída queda sin-conexion y conserva el indicio', async () => {
    escribirIndicio('fundacion');
    montar(() => {
      throw new TypeError('Failed to fetch');
    });
    await screen.findByText('estado:sin-conexion');
    expect(leerIndicio()).toBe('fundacion');
    expect(replace).not.toHaveBeenCalled();
  });

  it('refresh rechazado con indicio: avisa, borra el indicio y lleva a /ingresar con la ruta de origen', async () => {
    escribirIndicio('fundacion');
    montar(() => json({ message: 'Sesión no válida' }, 401));
    await screen.findByText('estado:anonimo');
    expect(leerIndicio()).toBeNull();
    expect(aviso.info).toHaveBeenCalledTimes(1);
    expect(aviso.info.mock.calls[0]![0]).toMatch(/Tu sesión venció/);
    expect(replace).toHaveBeenCalledWith('/ingresar?siguiente=%2Ffundacion%2Fmascotas');
  });

  it('con indicio y refresh en 429 queda sin-conexion por límite, sin borrar indicio ni token (R19)', async () => {
    escribirIndicio('fundacion');
    const { sesion, cliente } = montar(() => json({ message: 'Demasiadas solicitudes' }, 429));
    await screen.findByText('estado:sin-conexion');
    expect(sesion().motivoSinConexion).toBe('limite');
    expect(leerIndicio()).toBe('fundacion');
    expect(replace).not.toHaveBeenCalled();
    expect(aviso.info).not.toHaveBeenCalled();
    expect(cliente.tokens.obtener()).toBeNull();
  });

  it('una caída de red es sin-conexion por red', async () => {
    escribirIndicio('fundacion');
    const { sesion } = montar(() => {
      throw new TypeError('Failed to fetch');
    });
    await screen.findByText('estado:sin-conexion');
    expect(sesion().motivoSinConexion).toBe('red');
  });

  it('reintentar vuelve a restaurar tras «sin conexión»', async () => {
    escribirIndicio('fundacion');
    let caida = true;
    const { sesion } = montar((r) => {
      if (caida) throw new TypeError('Failed to fetch');
      return r === '/auth/refresh' ? sesionOk() : json(usuario());
    });
    await screen.findByText('estado:sin-conexion');
    caida = false;
    act(() => sesion().reintentar());
    await screen.findByText('estado:autenticado');
  });

  it('iniciarSesion guarda el token, escribe el indicio y expone al usuario', async () => {
    const { sesion, cliente, fetchImpl } = montar((r) => {
      if (r === '/auth/login') return sesionOk('administrador');
      return json({ message: 'x' }, 401);
    });
    await screen.findByText('estado:anonimo');
    let u!: Usuario;
    await act(async () => {
      u = await sesion().iniciarSesion('a@b.co', 'secreto');
    });
    expect(u.rol).toBe('administrador');
    expect(cliente.tokens.obtener()).toBe('tok');
    expect(leerIndicio()).toBe('administrador');
    const llamadaLogin = fetchImpl.mock.calls.find(([url]) => url.endsWith('/auth/login'));
    expect(llamadaLogin).toBeDefined();
    expect(screen.getByText('estado:autenticado')).toBeInTheDocument();
  });

  it('cerrarSesion revoca en el servidor, borra token, indicio y caché, y va al inicio', async () => {
    escribirIndicio('fundacion');
    let revocada = false;
    const { sesion, cliente, clearSpy } = montar((r) => {
      if (r === '/auth/logout') {
        revocada = true;
        return new Response(null, { status: 204 });
      }
      return r === '/auth/refresh' ? sesionOk() : json(usuario());
    });
    await screen.findByText('estado:autenticado');
    let cerro = false;
    await act(async () => {
      cerro = await sesion().cerrarSesion();
    });
    expect(cerro).toBe(true);
    expect(revocada).toBe(true);
    expect(cliente.tokens.obtener()).toBeNull();
    expect(leerIndicio()).toBeNull();
    expect(clearSpy).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/');
    expect(screen.getByText('estado:anonimo')).toBeInTheDocument();
  });

  it('si el servidor no responde al cerrar sesión, la sesión se mantiene y se muestra un error', async () => {
    escribirIndicio('fundacion');
    let apagada = false;
    const { sesion, cliente } = montar((r) => {
      if (apagada) throw new TypeError('Failed to fetch');
      return r === '/auth/refresh' ? sesionOk() : json(usuario());
    });
    await screen.findByText('estado:autenticado');
    apagada = true;
    let cerro = true;
    await act(async () => {
      cerro = await sesion().cerrarSesion();
    });
    expect(cerro).toBe(false);
    expect(aviso.error).toHaveBeenCalledWith(expect.stringMatching(/No pudimos conectar/));
    expect(cliente.tokens.obtener()).toBe('tok');
    expect(leerIndicio()).toBe('fundacion');
    expect(replace).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('estado:autenticado')).toBeInTheDocument());
  });
});
