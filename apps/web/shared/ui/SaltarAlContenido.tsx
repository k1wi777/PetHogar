/** Primer elemento enfocable de cada layout: permite a quien usa teclado omitir la navegación. */
export function SaltarAlContenido() {
  return (
    <a
      href="#contenido"
      className="bg-primary text-primary-foreground sr-only z-50 rounded-full font-semibold focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-5 focus:py-2.5"
    >
      Saltar al contenido
    </a>
  );
}
