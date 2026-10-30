import { MapPin } from 'lucide-react';
import { TarjetaMascota } from '@/shared/ui/TarjetaMascota';
import { formatearEdad } from '@/shared/lib/formato-mascota';
import type { MascotaCatalogo } from '../types';

export function ListaMascotas({ mascotas }: { mascotas: MascotaCatalogo[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {mascotas.map((m) => (
        <li key={m.id} className="flex">
          <div className="flex-1">
            <TarjetaMascota
              mascota={{
                nombre: m.nombre,
                especie: m.especie.charAt(0).toUpperCase() + m.especie.slice(1),
                raza: m.raza,
                edad: formatearEdad(m.edadMeses),
                fotoUrl: m.fotoPrincipal?.urlCatalogo ?? null,
                href: `/mascotas/${m.id}`,
              }}
            >
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                {m.ciudad} · {m.fundacion.nombre}
              </p>
            </TarjetaMascota>
          </div>
        </li>
      ))}
    </ul>
  );
}
