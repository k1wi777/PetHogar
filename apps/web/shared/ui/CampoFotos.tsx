'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { SOLO_IMAGENES, formatearTamano, validarDocumento } from '@/shared/lib/archivo';
import { Boton } from './Boton';
import { Campo } from './Campo';

const ACEPTADOS = '.jpg,.jpeg,.png,image/jpeg,image/png';

interface Foto {
  archivo: File;
  url: string;
}

/**
 * Varias fotos (JPG o PNG, máximo configurable, 5 MB cada una) con previsualización, «Quitar»
 * por foto y contador. Una foto inválida o la que excede el máximo no se añade y se explica el
 * motivo. El backend sigue siendo la autoridad sobre el contenido real.
 */
export function CampoFotos<T extends FieldValues>({
  control,
  nombre,
  etiqueta,
  ayuda,
  maximo = 5,
}: {
  control: Control<T>;
  nombre: Path<T>;
  etiqueta: string;
  ayuda?: string;
  maximo?: number;
}) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const fotosRef = useRef<Foto[]>([]);
  const idLista = useId();

  useEffect(
    () => () => {
      fotosRef.current.forEach((f) => URL.revokeObjectURL(f.url));
    },
    [],
  );

  function guardar(siguientes: Foto[], alCambiar: (archivos: File[]) => void) {
    fotosRef.current = siguientes;
    setFotos(siguientes);
    alCambiar(siguientes.map((f) => f.archivo));
  }

  function elegir(e: ChangeEvent<HTMLInputElement>, alCambiar: (archivos: File[]) => void) {
    const elegidos = Array.from(e.target.files ?? []);
    if (elegidos.length === 0) return;
    const nuevas: Foto[] = [];
    let error: string | null = null;
    for (const archivo of elegidos) {
      if (fotosRef.current.length + nuevas.length >= maximo) {
        error = `Puedes adjuntar hasta ${maximo} fotos. Quita alguna para añadir otra.`;
        break;
      }
      const resultado = validarDocumento(archivo, SOLO_IMAGENES);
      if (!resultado.ok) {
        error = `${archivo.name}: ${resultado.mensaje}`;
        continue;
      }
      nuevas.push({ archivo, url: URL.createObjectURL(archivo) });
    }
    setErrorLocal(error);
    // El selector nativo se reinicia para poder elegir de nuevo el mismo archivo.
    setVersion((v) => v + 1);
    if (nuevas.length > 0) guardar([...fotosRef.current, ...nuevas], alCambiar);
  }

  function quitar(indice: number, alCambiar: (archivos: File[]) => void) {
    const quitada = fotosRef.current[indice];
    if (quitada) URL.revokeObjectURL(quitada.url);
    setErrorLocal(null);
    guardar(
      fotosRef.current.filter((_, i) => i !== indice),
      alCambiar,
    );
  }

  return (
    <Controller
      control={control}
      name={nombre}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-3">
          <Campo etiqueta={etiqueta} ayuda={ayuda} error={errorLocal ?? fieldState.error?.message}>
            <input
              key={version}
              type="file"
              multiple
              name={field.name}
              ref={field.ref}
              accept={ACEPTADOS}
              disabled={fotos.length >= maximo}
              onBlur={field.onBlur}
              onChange={(e) => elegir(e, field.onChange)}
              className="bg-card border-border aria-invalid:border-destructive min-h-11 w-full rounded-md border px-3 py-2 text-base aria-invalid:border-2 disabled:opacity-60"
            />
          </Campo>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {fotos.length} de {maximo} fotos
          </p>
          {fotos.length > 0 && (
            <ul id={idLista} className="grid gap-3 sm:grid-cols-2" aria-label="Fotos adjuntas">
              {fotos.map((foto, i) => (
                <li
                  key={foto.url}
                  className="border-border-suave bg-card flex items-center gap-3 rounded-md border p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- vista local (blob:) que next/image no puede optimizar */}
                  <img
                    src={foto.url}
                    alt={`Vista previa de la foto ${foto.archivo.name}`}
                    className="size-20 rounded object-cover"
                  />
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-semibold">{foto.archivo.name}</span>
                    <span className="text-muted-foreground">
                      {formatearTamano(foto.archivo.size)}
                    </span>
                  </p>
                  <Boton
                    variante="contorno"
                    onClick={() => quitar(i, field.onChange)}
                    aria-label={`Quitar la foto ${foto.archivo.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Quitar
                  </Boton>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    />
  );
}
