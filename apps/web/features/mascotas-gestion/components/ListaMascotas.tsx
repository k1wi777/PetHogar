'use client';

import { PawPrint } from 'lucide-react';
import Link from 'next/link';
import { formatearFecha } from '@/shared/lib/fechas';
import { etiquetaSexo, etiquetaTamano, formatearEdad } from '@/shared/lib/formato-mascota';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { consultaAUrl, RUTA_MASCOTAS } from '../lib/consulta';
import type { ConsultaMascotas, MascotaGestion } from '../types';

/** Filas de «Mis mascotas»: tarjetas apiladas que no desbordan a 360 px; el estado siempre con texto. */
export function ListaMascotas({
  mascotas,
  consulta,
  alVerTodas,
}: {
  mascotas: MascotaGestion[];
  consulta: ConsultaMascotas;
  alVerTodas: () => void;
}) {
  if (mascotas.length === 0) {
    return consulta.estado ? (
      <EstadoVacio
        titulo="No hay mascotas con este estado"
        descripcion="Prueba con otro estado o muestra todas tus mascotas."
        accion={
          <Boton variante="contorno" onClick={alVerTodas}>
            Ver todas
          </Boton>
        }
      />
    ) : (
      <EstadoVacio
        icono={PawPrint}
        titulo="Aún no has publicado mascotas"
        descripcion="Publica a tu primera mascota para que aparezca en el catálogo de adopción."
        accion={
          <Boton comoHijo>
            <Link href={`${RUTA_MASCOTAS}/nueva`}>Publicar mi primera mascota</Link>
          </Boton>
        }
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3" aria-label="Mascotas">
      {mascotas.map((m) => (
        <li
          key={m.id}
          className="border-border-suave bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-lg font-bold break-words">{m.nombre}</p>
            <p className="text-muted-foreground text-sm">
              {formatearEdad(m.edadMeses)} · {etiquetaTamano(m.tamano)} · {etiquetaSexo(m.sexo)}
            </p>
            <p className="text-muted-foreground text-sm">
              Publicada el {formatearFecha(m.fechaPublicacion)}
            </p>
            <p>
              <span className="sr-only">Estado: </span>
              <BadgeEstado estado={m.estado} />
            </p>
          </div>
          <Boton comoHijo variante="contorno">
            <Link
              href={`${RUTA_MASCOTAS}/${m.id}${consultaAUrl(consulta)}`}
              aria-label={`Gestionar a ${m.nombre}`}
            >
              Gestionar
            </Link>
          </Boton>
        </li>
      ))}
    </ul>
  );
}
