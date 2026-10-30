'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { mensajeDe } from '@/shared/api/errores';
import { useSesion } from '@/shared/auth/SesionProvider';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';
import { EstadoError } from '@/shared/ui/EstadoError';
import { Paginacion } from '@/shared/ui/Paginacion';
import { Skeleton } from '@/shared/ui/Skeleton';
import { USUARIOS_POR_PAGINA } from '../api/usuarios';
import { useCambiarEstadoUsuario, useUsuarios } from '../hooks/useAdminUsuarios';
import { consultaAUrl, leerConsulta } from '../lib/consulta';
import type { ConsultaUsuarios, UsuarioAdmin } from '../types';
import { FiltroUsuarios } from './FiltroUsuarios';
import { TablaUsuarios } from './TablaUsuarios';

interface Cambio {
  usuario: UsuarioAdmin;
  activo: boolean;
}

/** Gestión de cuentas: activar y desactivar con confirmación; nunca sobre la propia cuenta. */
export function PantallaUsuarios() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { usuario: yo } = useSesion();
  const consulta = leerConsulta(params);
  const usuarios = useUsuarios(consulta);
  const estado = useCambiarEstadoUsuario();
  const [cambio, setCambio] = useState<Cambio | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  function ir(siguiente: ConsultaUsuarios) {
    router.push(`${pathname}${consultaAUrl(siguiente)}`);
  }

  async function confirmar() {
    if (!cambio) return;
    const { usuario, activo } = cambio;
    const quien = usuario.nombre ?? usuario.email;
    setExito(null);
    setFallo(null);
    try {
      if (!(await estado.cambiar(usuario.id, activo))) return;
      setExito(`La cuenta de ${quien} quedó ${activo ? 'activada' : 'desactivada'}.`);
    } catch (error) {
      // El servidor rechazó el cambio (p. ej. último administrador): la fila queda como estaba.
      setFallo(mensajeDe(error));
    } finally {
      setCambio(null);
    }
  }

  const quienCambia = cambio ? (cambio.usuario.nombre ?? cambio.usuario.email) : '';

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl">Usuarios</h1>
        <p className="text-muted-foreground">
          Busca cuentas y actívalas o desactívalas. Una cuenta desactivada no puede ingresar.
        </p>
      </div>

      <FiltroUsuarios
        key={consultaAUrl({ ...consulta, pagina: 1 })}
        consulta={consulta}
        alAplicar={ir}
      />

      <div role="status" className="empty:hidden">
        {exito && <p className="border-success bg-card rounded-md border-2 p-3">{exito}</p>}
      </div>
      {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}

      <div aria-live="polite" aria-busy={usuarios.isFetching || undefined}>
        {usuarios.isPending ? (
          <Skeleton className="h-48" etiqueta="Cargando los usuarios" />
        ) : usuarios.isError ? (
          <EstadoError
            alReintentar={() => void usuarios.refetch()}
            reintentando={usuarios.isFetching}
          />
        ) : (
          <TablaUsuarios
            usuarios={usuarios.data.data}
            consulta={consulta}
            idPropio={yo?.id}
            alCambiar={(usuario, activo) => {
              setExito(null);
              setFallo(null);
              setCambio({ usuario, activo });
            }}
            alQuitarFiltros={() => ir({ pagina: 1 })}
          />
        )}
      </div>

      {usuarios.data && usuarios.data.total > 0 && (
        <Paginacion
          pagina={usuarios.data.page}
          limite={usuarios.data.limit || USUARIOS_POR_PAGINA}
          total={usuarios.data.total}
          onCambio={(pagina) => ir({ ...consulta, pagina })}
        />
      )}

      <DialogoConfirmacion
        abierto={cambio !== null}
        onAbiertoChange={(a) => !a && !estado.isPending && setCambio(null)}
        titulo={
          cambio?.activo
            ? `¿Activar la cuenta de ${quienCambia}?`
            : `¿Desactivar la cuenta de ${quienCambia}?`
        }
        descripcion={
          cambio?.activo
            ? 'Podrá volver a ingresar con su correo y contraseña.'
            : 'No podrá ingresar y se cerrará su sesión en todos los dispositivos. Puedes activarla de nuevo cuando quieras.'
        }
        textoConfirmar={cambio?.activo ? 'Sí, activar' : 'Sí, desactivar'}
        textoCancelar="Volver"
        destructivo={cambio?.activo === false}
        cargando={estado.isPending}
        onConfirmar={() => void confirmar()}
      />
    </div>
  );
}
