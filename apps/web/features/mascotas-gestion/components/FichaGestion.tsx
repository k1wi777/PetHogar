'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { mensajeDe } from '@/shared/api/errores';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { BadgeEstado } from '@/shared/ui/BadgeEstado';
import { Boton } from '@/shared/ui/Boton';
import { EstadoError } from '@/shared/ui/EstadoError';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { Pestanas } from '@/shared/ui/Pestanas';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useMascotaGestion } from '../hooks/useMascotasGestion';
import { leerConsulta, leerId, leerPestana, rutaLista, RUTA_MASCOTAS } from '../lib/consulta';
import { esFundacionNoAprobada, esNoEncontrada } from '../lib/errores';
import { AccionesEstado } from './AccionesEstado';
import { AvisoFundacionNoAprobada } from './AvisoFundacionNoAprobada';
import { GestorFotos } from './GestorFotos';
import { GuardaFundacionAprobada } from './GuardaFundacionAprobada';
import { PestanaDatos } from './PestanaDatos';
import { PestanaHistorial } from './PestanaHistorial';

function NoEncontrada() {
  return (
    <div className="max-w-3xl">
      <EstadoVacio
        titulo="No encontramos esta mascota"
        descripcion="Es posible que el enlace sea incorrecto o que no sea una mascota de tu fundación."
        accion={
          <Boton comoHijo>
            <Link href={RUTA_MASCOTAS}>Volver a Mis mascotas</Link>
          </Boton>
        }
      />
    </div>
  );
}

function Contenido({ idTexto }: { idTexto: string }) {
  const id = leerId(idTexto);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mascota = useMascotaGestion(id);
  const titulo = useRef<HTMLHeadingElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [noAprobada, setNoAprobada] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [enfocarTitulo, setEnfocarTitulo] = useState(false);
  const pestana = leerPestana(params.get('pestana'));
  const volver = rutaLista(leerConsulta(params));

  // Tras la baja el botón desaparece: el foco pasa al título, pero cuando el diálogo ya cerró
  // (Radix devuelve el foco a su botón justo al desmontarse).
  useEffect(() => {
    if (!enfocarTitulo) return;
    const temporizador = setTimeout(() => {
      titulo.current?.focus();
      setEnfocarTitulo(false);
    }, 0);
    return () => clearTimeout(temporizador);
  }, [enfocarTitulo]);

  function cambiarPestana(valor: string) {
    const siguiente = new URLSearchParams(params.toString());
    siguiente.delete('publicada');
    if (valor === 'datos') siguiente.delete('pestana');
    else siguiente.set('pestana', valor);
    const texto = siguiente.toString();
    router.replace(texto ? `${pathname}?${texto}` : pathname, { scroll: false });
  }

  if (id === null) return <NoEncontrada />;
  if (noAprobada !== null) return <AvisoFundacionNoAprobada mensajeServidor={noAprobada} />;
  if (mascota.isPending)
    return <Skeleton className="h-64 max-w-3xl" etiqueta="Cargando la ficha" />;
  if (mascota.isError) {
    if (esNoEncontrada(mascota.error)) return <NoEncontrada />;
    if (esFundacionNoAprobada(mascota.error)) {
      return <AvisoFundacionNoAprobada mensajeServidor={mensajeDe(mascota.error)} />;
    }
    return (
      <EstadoError alReintentar={() => void mascota.refetch()} reintentando={mascota.isFetching} />
    );
  }

  const datos = mascota.data;
  const alConflicto = (mensaje: string) => {
    setExito(null);
    setAviso(mensaje);
  };

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link
        href={volver}
        className="text-primary inline-flex min-h-11 items-center gap-2 font-semibold underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a Mis mascotas
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 ref={titulo} tabIndex={-1} className="text-3xl break-words focus:outline-none">
            {datos.nombre}
          </h1>
          <BadgeEstado estado={datos.estado} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AccionesEstado
            mascota={datos}
            alBaja={() => {
              setAviso(null);
              setExito(
                `${datos.nombre} fue dada de baja y ya no aparece en el catálogo público (puede tardar hasta un minuto).`,
              );
              setEnfocarTitulo(true);
            }}
            alConflicto={alConflicto}
            alNoAprobada={setNoAprobada}
            alFallo={(mensaje) => {
              setExito(null);
              setAviso(mensaje);
            }}
          />
        </div>
      </header>

      {params.get('publicada') === '1' && !exito && (
        <p role="status" className="border-success bg-card rounded-md border-2 p-3">
          Publicaste a {datos.nombre}. Puede tardar hasta un minuto en verse en el catálogo público.
          Ahora añade sus fotos.
        </p>
      )}
      {exito && (
        <p role="status" className="border-success bg-card rounded-md border-2 p-3">
          {exito}
        </p>
      )}
      {aviso && <AvisoAlerta>{aviso}</AvisoAlerta>}

      <Pestanas
        etiqueta={`Secciones de la ficha de ${datos.nombre}`}
        valor={pestana}
        onCambio={cambiarPestana}
        pestanas={[
          {
            valor: 'datos',
            etiqueta: 'Datos',
            contenido: <PestanaDatos mascota={datos} alConflicto={alConflicto} />,
          },
          {
            valor: 'fotos',
            etiqueta: 'Fotos',
            contenido: <GestorFotos mascota={datos} alNoAprobada={setNoAprobada} />,
          },
          {
            valor: 'historial',
            etiqueta: 'Historial médico',
            contenido: <PestanaHistorial mascota={datos} alNoAprobada={setNoAprobada} />,
          },
        ]}
      />
    </div>
  );
}

/** Ficha de gestión: una sola carga del detalle compartida por datos, fotos, historial y acciones. */
export function FichaGestion({ idTexto }: { idTexto: string }) {
  return (
    <GuardaFundacionAprobada>
      <Contenido idTexto={idTexto} />
    </GuardaFundacionAprobada>
  );
}
