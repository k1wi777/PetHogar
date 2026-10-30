/** Primer elemento enfocable de cada layout: permite a quien usa teclado omitir la navegación. */
export function SaltarAlContenido() {
  return (
    <a
      href="#contenido"
      className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      Saltar al contenido
    </a>
  );
}
