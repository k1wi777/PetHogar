import type { FundacionPublica } from '../types';

export function FundacionResponsable({ fundacion }: { fundacion: FundacionPublica }) {
  return (
    <section
      aria-labelledby="fundacion-titulo"
      className="bg-card border-border-suave rounded-lg border p-4"
    >
      <h2 id="fundacion-titulo" className="text-2xl">
        Fundación responsable
      </h2>
      <p className="mt-2 font-semibold">{fundacion.nombre}</p>
      <p className="text-muted-foreground text-sm">{fundacion.ciudad}</p>
      {fundacion.descripcion && <p className="mt-2">{fundacion.descripcion}</p>}
    </section>
  );
}
