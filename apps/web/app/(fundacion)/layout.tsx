import type { ReactNode } from 'react';
import { CampanaNotificaciones } from '@/features/notificaciones/components/CampanaNotificaciones';
import { GuardaRol } from '@/features/panel/components/GuardaRol';
import { ShellPanel } from '@/features/panel/components/ShellPanel';
import { PANEL_POR_ROL } from '@/shared/lib/acceso';

export default function LayoutFundacion({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <GuardaRol rol="fundacion">
      <ShellPanel
        rol="fundacion"
        slotNotificaciones={
          <CampanaNotificaciones href={`${PANEL_POR_ROL.fundacion}/notificaciones`} />
        }
      >
        {children}
      </ShellPanel>
    </GuardaRol>
  );
}
