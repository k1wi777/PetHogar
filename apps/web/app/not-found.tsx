import { PaginaMensaje } from '@/shared/ui/PaginaMensaje';

export default function NoEncontrada() {
  return (
    <main id="contenido">
      <PaginaMensaje codigo="404" titulo="No encontramos esta página">
        Puede que el enlace esté mal escrito o que la página ya no exista.
      </PaginaMensaje>
    </main>
  );
}
