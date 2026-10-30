import { HeartHandshake, PawPrint, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Boton } from '@/shared/ui/Boton';

export const metadata: Metadata = {
  title: 'PetHogar: adopta una mascota y dale un hogar',
  description:
    'PetHogar reúne a fundaciones y refugios con personas que quieren adoptar: conoce a las mascotas, envía tu solicitud y acompaña su nueva vida.',
};

const PASOS = [
  {
    icono: Search,
    titulo: 'Encuentra',
    texto: 'Conoce a las mascotas que esperan un hogar, con su historial médico a la vista.',
  },
  {
    icono: PawPrint,
    titulo: 'Adopta',
    texto: 'Envía tu solicitud y la fundación la revisa con los mismos criterios para todos.',
  },
  {
    icono: HeartHandshake,
    titulo: 'Haz seguimiento',
    texto:
      'Acompaña su adaptación con visitas y reportes, y apoya a las fundaciones con donaciones.',
  },
] as const;

export default function InicioPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <section className="text-center">
        <h1 className="text-4xl">PetHogar</h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-lg">
          Encuentra a tu nuevo mejor amigo y dale un hogar. Aquí las fundaciones y los adoptantes se
          encuentran en un solo lugar, de forma clara y segura.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Boton comoHijo>
            <Link href="/adoptar">Adoptar</Link>
          </Boton>
          <Boton comoHijo variante="secundario">
            <Link href="/adoptante/donar">Donar</Link>
          </Boton>
          <Boton comoHijo variante="contorno">
            <Link href="/ingresar">Ingresar</Link>
          </Boton>
        </div>
      </section>
      <section aria-labelledby="como-funciona" className="mt-14">
        <h2 id="como-funciona" className="text-center text-2xl">
          Cómo funciona
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {PASOS.map(({ icono: Icono, titulo, texto }) => (
            <li
              key={titulo}
              className="bg-card border-border-suave flex flex-col items-center gap-2 rounded-lg border p-5 text-center"
            >
              <Icono className="text-primary size-8" aria-hidden="true" />
              <h3 className="font-heading text-xl font-bold">{titulo}</h3>
              <p className="text-muted-foreground">{texto}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
