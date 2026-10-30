'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { nombreVisible, type Rol } from '@/shared/api/tipos';
import { useSesion } from '@/shared/auth/SesionProvider';
import { MENU_POR_ROL, NOMBRE_PANEL } from '@/shared/lib/acceso';
import { cn } from '@/shared/lib/utils';
import { Boton } from '@/shared/ui/Boton';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';
import { SaltarAlContenido } from '@/shared/ui/SaltarAlContenido';

function esActiva(href: string, pathname: string, raiz: string): boolean {
  return href === raiz ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function MenuLateral({ rol, alNavegar }: { rol: Rol; alNavegar?: () => void }) {
  const pathname = usePathname();
  const opciones = MENU_POR_ROL[rol];
  const raiz = opciones[0]!.href;
  return (
    <nav aria-label="Principal">
      <ul className="flex flex-col gap-1">
        {opciones.map((o) => {
          const activa = esActiva(o.href, pathname, raiz);
          return (
            <li key={o.href}>
              <Link
                href={o.href}
                aria-current={activa ? 'page' : undefined}
                onClick={alNavegar}
                className={cn(
                  'flex min-h-11 items-center rounded-md px-3 py-2 text-base font-medium',
                  activa ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground',
                )}
              >
                {o.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Estructura de los paneles: barra superior, menú lateral (colapsable en móvil) y cierre de sesión
 * con confirmación. La campana de notificaciones llega como `slotNotificaciones` para que las
 * features no se importen entre sí.
 */
export function ShellPanel({
  rol,
  slotNotificaciones,
  children,
}: {
  rol: Rol;
  slotNotificaciones?: ReactNode;
  children: ReactNode;
}) {
  const { usuario, cerrarSesion } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const fundacion = usuario?.fundacion;

  async function confirmarCierre() {
    setCerrando(true);
    const cerro = await cerrarSesion();
    setCerrando(false);
    if (!cerro) setConfirmando(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SaltarAlContenido />
      <header className="bg-card border-border-suave flex items-center gap-2 border-b px-4 py-2">
        <Dialog.Root open={menuAbierto} onOpenChange={setMenuAbierto}>
          <Dialog.Trigger asChild>
            <Boton variante="contorno" className="md:hidden" aria-label="Abrir menú">
              <Menu className="size-5" aria-hidden="true" />
              Menú
            </Boton>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 md:hidden" />
            <Dialog.Content className="bg-card fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85%] flex-col gap-4 p-4 shadow-xl md:hidden">
              <div className="flex items-center justify-between">
                <Dialog.Title className="font-heading text-lg font-bold">
                  {NOMBRE_PANEL[rol]}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <Boton variante="fantasma" aria-label="Cerrar menú">
                    <X className="size-5" aria-hidden="true" />
                  </Boton>
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">
                Opciones de navegación del panel
              </Dialog.Description>
              <MenuLateral rol={rol} alNavegar={() => setMenuAbierto(false)} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Link href="/" className="font-heading text-primary text-xl font-extrabold">
          PetHogar
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {usuario && (
            <span className="hidden max-w-48 truncate text-sm font-medium sm:inline">
              {nombreVisible(usuario)}
            </span>
          )}
          {slotNotificaciones}
          <Boton variante="contorno" onClick={() => setConfirmando(true)}>
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </Boton>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="bg-card border-border-suave hidden w-64 shrink-0 border-r p-4 md:block">
          <p className="font-heading text-muted-foreground mb-3 text-sm font-bold">
            {NOMBRE_PANEL[rol]}
          </p>
          <MenuLateral rol={rol} />
        </aside>
        <main id="contenido" className="flex-1 p-4 md:p-8">
          {fundacion && fundacion.estadoValidacion !== 'aprobada' && (
            <div role="status" className="bg-warning text-warning-foreground mb-6 rounded-md p-4">
              {fundacion.estadoValidacion === 'pendiente'
                ? 'Tu fundación está pendiente de validación. Podrás operar cuando sea aprobada.'
                : 'La validación de tu fundación fue rechazada. Revisa la observación que te enviamos.'}
            </div>
          )}
          {children}
        </main>
      </div>

      <DialogoConfirmacion
        abierto={confirmando}
        onAbiertoChange={(abierto) => !cerrando && setConfirmando(abierto)}
        titulo="¿Cerrar sesión?"
        descripcion="Tendrás que ingresar de nuevo para volver a tu panel."
        textoConfirmar="Sí, cerrar sesión"
        cargando={cerrando}
        onConfirmar={confirmarCierre}
      />
    </div>
  );
}
