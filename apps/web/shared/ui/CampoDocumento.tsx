'use client';

import { FileText, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Boton } from '@/shared/ui/Boton';
import { Campo } from '@/shared/ui/Campo';
import { esImagen, formatearTamano, validarDocumento } from '../lib/archivo';

const ACEPTADOS = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf';

interface Vista {
  url: string | null;
  nombre: string;
  tamano: string;
  imagen: boolean;
}

/**
 * Selector de archivo nativo (operable con teclado) con validación previa de tipo y tamaño,
 * previsualización y opción de quitar. El backend sigue siendo la autoridad sobre el contenido.
 */
export function CampoDocumento<T extends FieldValues>({
  control,
  nombre,
  etiqueta,
  ayuda,
  requerido = true,
  textoQuitar = 'Quitar documento',
  textoVistaPrevia = 'Vista previa del documento',
}: {
  control: Control<T>;
  nombre: Path<T>;
  etiqueta: string;
  ayuda?: string;
  /** Por defecto `true`; el comprobante de una donación es opcional. */
  requerido?: boolean;
  textoQuitar?: string;
  textoVistaPrevia?: string;
}) {
  const [vista, setVista] = useState<Vista | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const urlActual = useRef<string | null>(null);

  function liberar() {
    if (urlActual.current) URL.revokeObjectURL(urlActual.current);
    urlActual.current = null;
  }
  useEffect(() => liberar, []);

  function elegir(
    e: ChangeEvent<HTMLInputElement>,
    alCambiar: (archivo: File | undefined) => void,
  ) {
    const archivo = e.target.files?.[0];
    liberar();
    if (!archivo) {
      setVista(null);
      setErrorLocal(null);
      alCambiar(undefined);
      return;
    }
    const resultado = validarDocumento(archivo);
    if (!resultado.ok) {
      // Un archivo inválido nunca queda seleccionado: no se puede enviar por descuido.
      setVista(null);
      setErrorLocal(resultado.mensaje);
      setVersion((v) => v + 1);
      alCambiar(undefined);
      return;
    }
    const imagen = esImagen(resultado.tipo);
    const url = imagen ? URL.createObjectURL(archivo) : null;
    urlActual.current = url;
    setErrorLocal(null);
    setVista({ url, nombre: archivo.name, tamano: formatearTamano(archivo.size), imagen });
    alCambiar(archivo);
  }

  function quitar(alCambiar: (archivo: File | undefined) => void) {
    liberar();
    setVista(null);
    setErrorLocal(null);
    setVersion((v) => v + 1);
    alCambiar(undefined);
  }

  return (
    <Controller
      control={control}
      name={nombre}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-3">
          <Campo
            etiqueta={etiqueta}
            requerido={requerido}
            ayuda={ayuda}
            error={errorLocal ?? fieldState.error?.message}
          >
            <input
              key={version}
              type="file"
              name={field.name}
              ref={field.ref}
              accept={ACEPTADOS}
              onBlur={field.onBlur}
              onChange={(e) => elegir(e, field.onChange)}
              className="bg-card border-border min-h-11 w-full rounded-md border px-3 py-2 text-base aria-invalid:border-destructive aria-invalid:border-2"
            />
          </Campo>
          {vista && (
            <div className="border-border-suave bg-card flex items-center gap-3 rounded-md border p-3">
              {vista.imagen && vista.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- vista local (blob:) que next/image no puede optimizar
                <img
                  src={vista.url}
                  alt={`${textoVistaPrevia} ${vista.nombre}`}
                  className="size-20 rounded object-cover"
                />
              ) : (
                <FileText className="text-muted-foreground size-12 shrink-0" aria-hidden="true" />
              )}
              <p className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-semibold">{vista.nombre}</span>
                <span className="text-muted-foreground">{vista.tamano}</span>
              </p>
              <Boton variante="contorno" onClick={() => quitar(field.onChange)}>
                <Trash2 className="size-4" aria-hidden="true" />
                {textoQuitar}
              </Boton>
            </div>
          )}
        </div>
      )}
    />
  );
}
