import type { ReactNode } from 'react';
import { CabeceraPublica } from '@/features/panel/components/CabeceraPublica';

export default function PublicoLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <CabeceraPublica />
      <main id="contenido">{children}</main>
    </>
  );
}
