import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Ingresar | PetHogar' };

/** Placeholder: el formulario de inicio de sesión llega con F-09. Es el destino de las redirecciones. */
export default function IngresarPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-3xl">Ingresar</h1>
      <p className="text-muted-foreground mt-3">
        El inicio de sesión estará disponible próximamente.
      </p>
    </div>
  );
}
