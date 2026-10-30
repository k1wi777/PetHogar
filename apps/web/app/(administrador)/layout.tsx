import type { ReactNode } from 'react';
import { CampanaNotificaciones } from '@/features/notificaciones/components/CampanaNotificaciones';
import { GuardaRol } from '@/features/panel/components/GuardaRol';
import { ShellPanel } from '@/features/panel/components/ShellPanel';
import { PANEL_POR_ROL } from '@/shared/lib/acceso';

export default function LayoutAdministrador({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <GuardaRol rol="administrador">
      <ShellPanel
        rol="administrador"
        slotNotificaciones={
          <CampanaNotificaciones href={`${PANEL_POR_ROL.administrador}/notificaciones`} />
        }
      >
        {children}
      </ShellPanel>
    </GuardaRol>
  );
}
