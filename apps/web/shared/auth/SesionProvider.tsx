'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ClienteHttp } from '@/shared/api/cliente';
import { esErrorApi, mensajeDe } from '@/shared/api/errores';
import { http as clientePorDefecto } from '@/shared/api/http';
import type { RespuestaSesion, Usuario } from '@/shared/api/tipos';
import { aviso } from '@/shared/ui/Toaster';
import { borrarIndicio, escribirIndicio, leerIndicio } from './indicio';

export type EstadoSesion = 'cargando' | 'anonimo' | 'autenticado' | 'sin-conexion';

export interface ContextoSesion {
  estado: EstadoSesion;
  usuario: Usuario | null;
  iniciarSesion(email: string, contrasena: string): Promise<Usuario>;
  /** Pide al servidor revocar la sesión; si no responde, la sesión se mantiene. Devuelve si se cerró. */
  cerrarSesion(): Promise<boolean>;
  /** Reintenta restaurar la sesión (tras «sin conexión»). */
  reintentar(): void;
  /** Vuelve a consultar `GET /auth/me` (p. ej. tras cambiar el estado de la fundación). */
  refrescarPerfil(): Promise<void>;
}

const Contexto = createContext<ContextoSesion | null>(null);

export function useSesion(): ContextoSesion {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSesion debe usarse dentro de <SesionProvider>.');
  return valor;
}

interface Estado {
  estado: EstadoSesion;
  usuario: Usuario | null;
}

export function SesionProvider({
  children,
  cliente = clientePorDefecto,
}: {
  children: ReactNode;
  cliente?: ClienteHttp;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [actual, setActual] = useState<Estado>({ estado: 'cargando', usuario: null });
  const [intento, setIntento] = useState(0);
  const autenticadoRef = useRef(false);
  const pathRef = useRef(pathname);

  useEffect(() => {
    autenticadoRef.current = actual.estado === 'autenticado';
    pathRef.current = pathname;
  });

  const fijarUsuario = useCallback((usuario: Usuario) => {
    escribirIndicio(usuario.rol);
    setActual({ estado: 'autenticado', usuario });
  }, []);

  // Renovación rechazada (401): una sola notificación y un solo borrado del indicio (R11).
  useEffect(() => {
    return cliente.alVencerSesion(() => {
      const habiaSesion = autenticadoRef.current || leerIndicio() !== null;
      borrarIndicio();
      queryClient.clear();
      setActual({ estado: 'anonimo', usuario: null });
      if (!habiaSesion) return;
      aviso.info('Tu sesión venció. Ingresa de nuevo para continuar.');
      const ruta = pathRef.current;
      if (ruta !== '/ingresar') {
        const destino = `${ruta}${typeof window === 'undefined' ? '' : window.location.search}`;
        router.replace(`/ingresar?siguiente=${encodeURIComponent(destino)}`);
      }
    });
  }, [cliente, queryClient, router]);

  // Restaurar la sesión al cargar: renovar el token y consultar el perfil (R10).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        await cliente.renovar();
        const usuario = await cliente.get<Usuario>('/auth/me');
        if (!cancelado) fijarUsuario(usuario);
      } catch (error) {
        if (cancelado) return;
        if (esErrorApi(error) && error.tipo === 'sesion-vencida') {
          setActual({ estado: 'anonimo', usuario: null });
        } else {
          // Sin conexión u otro fallo: no se cierra la sesión ni se borra el indicio (R7).
          setActual({ estado: 'sin-conexion', usuario: null });
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [cliente, fijarUsuario, intento]);

  const iniciarSesion = useCallback(
    async (email: string, contrasena: string) => {
      const sesion = await cliente.post<RespuestaSesion>('/auth/login', {
        cuerpo: { email, contrasena },
        autenticada: false,
      });
      cliente.tokens.guardar(sesion.accessToken);
      fijarUsuario(sesion.usuario);
      return sesion.usuario;
    },
    [cliente, fijarUsuario],
  );

  const cerrarSesion = useCallback(async () => {
    try {
      await cliente.post<void>('/auth/logout', { autenticada: false });
    } catch (error) {
      aviso.error(mensajeDe(error));
      return false;
    }
    cliente.tokens.limpiar();
    borrarIndicio();
    queryClient.clear();
    setActual({ estado: 'anonimo', usuario: null });
    router.replace('/');
    return true;
  }, [cliente, queryClient, router]);

  const refrescarPerfil = useCallback(async () => {
    fijarUsuario(await cliente.get<Usuario>('/auth/me'));
  }, [cliente, fijarUsuario]);

  const reintentar = useCallback(() => {
    setActual({ estado: 'cargando', usuario: null });
    setIntento((n) => n + 1);
  }, []);

  const valor = useMemo<ContextoSesion>(
    () => ({ ...actual, iniciarSesion, cerrarSesion, reintentar, refrescarPerfil }),
    [actual, iniciarSesion, cerrarSesion, reintentar, refrescarPerfil],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
