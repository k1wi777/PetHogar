import { HeartHandshake, PawPrint, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
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

// Copias de las fotos de demostración (ver `public/portada/LICENCIAS.md`). Son decorativas: no se
// presentan como mascotas en adopción, por eso su texto alternativo va vacío.
const FOTOS = [
  { src: '/portada/luna.webp', ancho: 960, alto: 840, marco: 'col-span-2 row-span-2' },
  { src: '/portada/nieve.webp', ancho: 600, alto: 600, marco: 'lg:rotate-3' },
  { src: '/portada/pelusa.webp', ancho: 600, alto: 600, marco: 'lg:-rotate-3' },
] as const;

export default function InicioPage() {
  return (
    <>
      <div data-sin-patron className="bg-acento text-acento-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-6 sm:py-10 lg:grid-cols-[5fr_6fr] lg:gap-12 lg:py-16">
          <section>
            <h1 className="text-portada">PetHogar</h1>
            <p className="mt-3 max-w-xl text-lg font-medium sm:mt-5 sm:text-xl">
              Encuentra a tu nuevo mejor amigo y dale un hogar. Aquí las fundaciones y los
              adoptantes se encuentran en un solo lugar, de forma clara y segura.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 sm:mt-8 sm:gap-3">
              <Boton comoHijo className="min-h-12 px-6 text-lg sm:px-8">
                <Link href="/adoptar">Adoptar</Link>
              </Boton>
              <Boton comoHijo variante="secundario" className="min-h-12 px-4 sm:px-5">
                <Link href="/adoptante/donar">Donar</Link>
              </Boton>
              <Boton comoHijo variante="contorno" className="border-primary min-h-12 px-4 sm:px-5">
                <Link href="/ingresar">Ingresar</Link>
              </Boton>
            </div>
          </section>
          <div className="entrada-portada grid aspect-[4/3] grid-cols-3 grid-rows-2 gap-2 sm:gap-4">
            {FOTOS.map((foto, i) => (
              <div
                key={foto.src}
                className={`bg-card relative overflow-hidden rounded-xl p-1 shadow-lg sm:p-1.5 ${foto.marco}`}
              >
                <Image
                  src={foto.src}
                  alt=""
                  width={foto.ancho}
                  height={foto.alto}
                  unoptimized
                  loading="eager"
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  className="size-full rounded-lg object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <section aria-labelledby="como-funciona" className="bg-secondary text-secondary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <h2 id="como-funciona" className="text-titulo md:text-center">
            Cómo funciona
          </h2>
          <ul className="mt-10 flex flex-col md:grid md:grid-cols-3">
            {PASOS.map(({ icono: Icono, titulo, texto }) => (
              // El trazo une cada paso con el siguiente: vertical en móvil, horizontal desde `md`.
              <li
                key={titulo}
                className="after:bg-primary relative flex gap-4 pb-10 after:absolute after:top-16 after:bottom-0 after:left-8 after:w-1 after:-translate-x-1/2 last:pb-0 last:after:hidden md:flex-col md:items-center md:gap-5 md:px-4 md:pb-0 md:text-center md:after:top-8 md:after:right-auto md:after:bottom-auto md:after:left-[calc(50%+2rem)] md:after:h-1 md:after:w-[calc(100%-4rem)] md:after:translate-x-0 md:after:-translate-y-1/2"
              >
                <span className="bg-primary text-primary-foreground flex size-16 shrink-0 items-center justify-center rounded-full">
                  <Icono className="size-8" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-2xl">{titulo}</h3>
                  <p className="mt-2 max-w-xs text-lg">{texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
