'use client';

import { useEffect, useRef, useState } from 'react';
import { mensajeDe } from '@/shared/lib/errores-usuario';
import { formatearTamano } from '@/shared/lib/archivo';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { Boton } from '@/shared/ui/Boton';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';
import { EstadoVacio } from '@/shared/ui/EstadoVacio';
import { useEliminarFoto, useMarcarPrincipal, useSubirFoto } from '../hooks/useMascotasGestion';
import { esFundacionNoAprobada } from '../lib/errores';
import {
  MAX_FOTOS,
  prepararArchivos,
  procesarCola,
  resumenFinal,
  type ElementoCola,
} from '../lib/subida';
import type { FotoGestion, MascotaGestionDetalle } from '../types';
import { TarjetaFotoGestion } from './TarjetaFotoGestion';
import { ZonaCarga } from './ZonaCarga';

const TEXTO_ESTADO: Readonly<Record<ElementoCola['estado'], string>> = {
  pendiente: 'En espera',
  subiendo: 'Subiendo…',
  listo: 'Subida',
  error: 'No se pudo subir',
  rechazado: 'No válida',
};

/**
 * Galería de la ficha de gestión: carga múltiple (una foto por petición, en cola), cupo de 6,
 * principal y eliminación con confirmación. Los avances y errores se anuncian en una región `aria-live`.
 */
export function GestorFotos({
  mascota,
  alNoAprobada,
}: {
  mascota: MascotaGestionDetalle;
  alNoAprobada: (mensaje: string) => void;
}) {
  const fotos = mascota.fotos;
  const lleno = fotos.length >= MAX_FOTOS;
  const subir = useSubirFoto(mascota.id);
  const principal = useMarcarPrincipal(mascota.id);
  const eliminar = useEliminarFoto(mascota.id);
  const [cola, setCola] = useState<ElementoCola[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [anuncio, setAnuncio] = useState('');
  const [fallo, setFallo] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<{ foto: FotoGestion; posicion: number } | null>(null);
  const [enfocarTitulo, setEnfocarTitulo] = useState(false);
  const contador = useRef(0);
  const encabezado = useRef<HTMLHeadingElement>(null);
  const ocupada = subiendo || principal.isPending || eliminar.isPending;

  // La tarjeta eliminada desaparece: el foco pasa al encabezado, y se hace cuando el diálogo ya cerró
  // (Radix devuelve el foco al botón que lo abrió justo al desmontarse).
  useEffect(() => {
    if (!enfocarTitulo || aEliminar !== null) return;
    const temporizador = setTimeout(() => {
      encabezado.current?.focus();
      setEnfocarTitulo(false);
    }, 0);
    return () => clearTimeout(temporizador);
  }, [enfocarTitulo, aEliminar]);

  function cambiar(id: number, cambio: Partial<Pick<ElementoCola, 'estado' | 'mensaje'>>) {
    setCola((previa) => previa.map((e) => (e.id === id ? { ...e, ...cambio } : e)));
  }

  async function ejecutar(elementos: ElementoCola[], rechazadas: number) {
    if (elementos.length === 0) {
      setAnuncio(resumenFinal({ subidas: 0, fallidas: 0, parada: null }, rechazadas));
      return;
    }
    setSubiendo(true);
    let n = 0;
    const resumen = await procesarCola(
      elementos,
      (a) => subir.mutateAsync(a),
      (id, cambio) => {
        cambiar(id, cambio);
        if (cambio.estado === 'subiendo') {
          n++;
          const nombre = elementos.find((e) => e.id === id)?.archivo.name ?? '';
          setAnuncio(`Subiendo ${n} de ${elementos.length}: ${nombre}`);
        }
      },
    );
    setSubiendo(false);
    setAnuncio(resumenFinal(resumen, rechazadas));
    if (resumen.parada === 'no-aprobada') {
      alNoAprobada(resumen.mensaje ?? '');
    }
  }

  function elegir(archivos: File[]) {
    setFallo(null);
    const { aceptados, rechazados } = prepararArchivos(archivos, fotos.length);
    const nuevos: ElementoCola[] = [
      ...rechazados.map(({ archivo, mensaje }) => ({
        id: ++contador.current,
        archivo,
        estado: 'rechazado' as const,
        mensaje,
      })),
      ...aceptados.map((archivo) => ({
        id: ++contador.current,
        archivo,
        estado: 'pendiente' as const,
      })),
    ];
    setCola(nuevos);
    void ejecutar(
      nuevos.filter((e) => e.estado === 'pendiente'),
      rechazados.length,
    );
  }

  function reintentarFallidas() {
    const fallidas = cola.filter((e) => e.estado === 'error').map((e) => e.archivo);
    if (fallidas.length === 0) return;
    elegir(fallidas);
  }

  function fallar(error: unknown) {
    if (esFundacionNoAprobada(error)) return alNoAprobada(mensajeDe(error));
    setFallo(mensajeDe(error));
  }

  function marcarPrincipal(foto: FotoGestion, posicion: number) {
    setFallo(null);
    principal.mutate(foto.id, {
      onSuccess: () => setAnuncio(`La foto ${posicion} ahora es la principal`),
      onError: fallar,
    });
  }

  function confirmarEliminar() {
    if (!aEliminar) return;
    const { posicion } = aEliminar;
    setFallo(null);
    eliminar.mutate(aEliminar.foto.id, {
      onSuccess: () => {
        setAEliminar(null);
        setAnuncio(`Eliminaste la foto ${posicion}`);
        setEnfocarTitulo(true);
      },
      onError: (error) => {
        setAEliminar(null);
        fallar(error);
      },
    });
  }

  const hayFallidas = cola.some((e) => e.estado === 'error');

  return (
    <section aria-labelledby="titulo-fotos" className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2
          id="titulo-fotos"
          ref={encabezado}
          tabIndex={-1}
          className="text-2xl focus:outline-none"
        >
          Fotos
        </h2>
        <p className="text-muted-foreground">
          {fotos.length} de {MAX_FOTOS} fotos. La primera que subas queda como principal.
        </p>
      </div>

      <ZonaCarga
        alElegir={elegir}
        deshabilitada={lleno || subiendo}
        descripcion={
          lleno
            ? `Alcanzaste el máximo de ${MAX_FOTOS} fotos. Elimina una para subir otra.`
            : 'JPG o PNG, hasta 5 MB cada una.'
        }
      />

      {/* Región viva: anuncia el avance de la subida y los resultados a lectores de pantalla. */}
      <p role="status" aria-live="polite" className="min-h-6 font-semibold">
        {anuncio}
      </p>
      {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}

      {cola.length > 0 && (
        <div className="flex flex-col gap-3">
          <ul aria-label="Estado de la subida" className="flex flex-col gap-2">
            {cola.map((e) => (
              <li
                key={e.id}
                className="border-border-suave bg-card flex flex-col gap-1 rounded-md border p-3"
              >
                <span className="font-semibold break-all">
                  {e.archivo.name}{' '}
                  <span className="text-muted-foreground text-sm font-normal">
                    ({formatearTamano(e.archivo.size)})
                  </span>
                </span>
                <span
                  className={
                    e.estado === 'error' || e.estado === 'rechazado'
                      ? 'text-destructive'
                      : undefined
                  }
                >
                  {TEXTO_ESTADO[e.estado]}
                  {e.mensaje ? `: ${e.mensaje}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {!subiendo && (
            <div className="flex flex-wrap gap-3">
              {hayFallidas && (
                <Boton variante="contorno" onClick={reintentarFallidas}>
                  Reintentar las fallidas
                </Boton>
              )}
              <Boton variante="fantasma" onClick={() => setCola([])}>
                Limpiar lista
              </Boton>
            </div>
          )}
        </div>
      )}

      {fotos.length === 0 ? (
        <EstadoVacio
          titulo="Aún no tiene fotos"
          descripcion="Sube al menos una foto: las mascotas con fotos reciben más solicitudes."
        />
      ) : (
        <ul
          aria-label="Galería de fotos"
          className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2"
        >
          {fotos.map((foto, i) => (
            <TarjetaFotoGestion
              key={foto.id}
              foto={foto}
              nombreMascota={mascota.nombre}
              posicion={i + 1}
              total={fotos.length}
              ocupada={ocupada}
              alMarcarPrincipal={() => marcarPrincipal(foto, i + 1)}
              alEliminar={() => setAEliminar({ foto, posicion: i + 1 })}
            />
          ))}
        </ul>
      )}

      <DialogoConfirmacion
        abierto={aEliminar !== null}
        onAbiertoChange={(v) => !eliminar.isPending && !v && setAEliminar(null)}
        titulo={`¿Eliminar la foto ${aEliminar?.posicion ?? ''}?`}
        descripcion={
          aEliminar?.foto.esPrincipal && fotos.length > 1
            ? 'Es la foto principal: otra foto pasará a ser la principal. Esta acción no se puede deshacer.'
            : 'Esta acción no se puede deshacer.'
        }
        textoConfirmar="Sí, eliminar"
        destructivo
        cargando={eliminar.isPending}
        onConfirmar={confirmarEliminar}
      />
    </section>
  );
}
