import Link from 'next/link';
import { Boton } from '@/shared/ui/Boton';
import type { FundacionPublica } from '../types';

/** Donar a esta fundación: la pantalla de donar (feature `donaciones`) recibe la fundación por la URL. */
export function rutaDonarAFundacion(fundacion: Pick<FundacionPublica, 'id' | 'nombre'>): string {
  const consulta = new URLSearchParams({
    fundacion: String(fundacion.id),
    nombre: fundacion.nombre.slice(0, 100),
  });
  return `/adoptante/donar?${consulta.toString()}`;
}

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
      <Boton comoHijo variante="contorno" className="mt-3">
        <Link href={rutaDonarAFundacion(fundacion)}>Donar a esta fundación</Link>
      </Boton>
    </section>
  );
}
