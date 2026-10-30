'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Upload } from 'lucide-react';
import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { aplicarError } from '@/shared/lib/errores-formulario';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { BotonDescarga } from '@/shared/ui/BotonDescarga';
import { Boton } from '@/shared/ui/Boton';
import { CampoDocumento } from '@/shared/ui/CampoDocumento';
import { useSubirActa } from '../hooks/useAdopcionesGestion';
import { esAdopcionCerrada, esAdopcionInexistente, esErrorDeArchivoActa } from '../lib/errores';
import { esquemaActa } from '../schemas/acta';
import type { AdopcionFundacion } from '../types';

interface Valores {
  acta?: File;
}

/**
 * Acta firmada de la adopción: la descarga autenticada (siempre que exista) y, solo con la
 * adopción activa, subir o reemplazar el archivo. El backend es la autoridad sobre el contenido.
 */
export function ActaAdopcion({ adopcion }: { adopcion: AdopcionFundacion }) {
  const activa = adopcion.estado === 'activa';
  const [fallo, setFallo] = useState<string | null>(null);
  const [subida, setSubida] = useState(false);
  const subir = useSubirActa(adopcion.id);
  const { control, handleSubmit, setError, reset } = useForm<Valores>({
    resolver: zodResolver(esquemaActa) as unknown as Resolver<Valores>,
    mode: 'onTouched',
    shouldFocusError: true,
    defaultValues: {},
  });

  async function enviar(datos: Valores) {
    setFallo(null);
    setSubida(false);
    try {
      await subir.mutateAsync(datos.acta as File);
      reset({});
      setSubida(true);
      // `mutateAsync` espera a que la lista traiga el acta; el siguiente ciclo ya la pinta.
      setTimeout(
        () =>
          document
            .querySelector<HTMLButtonElement>(`#descarga-acta-${adopcion.id} button`)
            ?.focus(),
        0,
      );
    } catch (error) {
      if (esErrorDeArchivoActa(error)) {
        const mensaje = error instanceof Error ? error.message : 'No pudimos subir el acta.';
        return setError('acta', { message: mensaje }, { shouldFocus: true });
      }
      if (esAdopcionCerrada(error)) {
        return setFallo('Esta adopción ya fue cerrada: ya no se puede cambiar el acta.');
      }
      if (esAdopcionInexistente(error)) return setFallo('La adopción ya no existe.');
      aplicarError(
        error,
        ['acta'],
        {
          marcarCampo: (campo, mensaje, enfocarCampo) =>
            setError(campo as keyof Valores, { message: mensaje }, { shouldFocus: enfocarCampo }),
          mostrarAviso: setFallo,
        },
        () => null,
      );
    }
  }

  return (
    <section aria-labelledby={`acta-${adopcion.id}`} className="flex flex-col gap-3">
      <h3 id={`acta-${adopcion.id}`} className="text-lg font-bold">
        Acta firmada
      </h3>
      {adopcion.acta ? (
        <div id={`descarga-acta-${adopcion.id}`}>
          <BotonDescarga
            url={adopcion.acta.url}
            nombreBase={`acta-adopcion-${adopcion.id}`}
            etiqueta="Descargar acta"
          />
        </div>
      ) : (
        <p className="text-muted-foreground">
          {activa ? 'Aún no hay acta firmada.' : 'Esta adopción se cerró sin acta firmada.'}
        </p>
      )}
      <div aria-live="polite" className="text-sm">
        {subida && <p className="text-success-foreground font-semibold">Acta guardada.</p>}
      </div>

      {activa ? (
        <form
          noValidate
          onSubmit={handleSubmit((d) => (subir.isPending ? undefined : enviar(d)))}
          className="border-border-suave flex flex-col gap-3 rounded-md border p-4"
          aria-label={`${adopcion.acta ? 'Reemplazar' : 'Subir'} el acta de ${adopcion.mascota.nombre}`}
        >
          {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
          <CampoDocumento
            control={control}
            nombre="acta"
            etiqueta={adopcion.acta ? 'Nueva acta firmada' : 'Acta firmada'}
            ayuda="Archivo JPG, PNG o PDF de hasta 5 MB."
            textoQuitar="Quitar acta"
            textoVistaPrevia="Vista previa del acta"
          />
          <Boton
            type="submit"
            variante="secundario"
            cargando={subir.isPending}
            className="w-full sm:w-auto sm:self-start"
          >
            {!subir.isPending && <Upload className="size-4" aria-hidden="true" />}
            {adopcion.acta ? 'Reemplazar acta' : 'Subir acta'}
          </Boton>
        </form>
      ) : (
        <>
          {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
          <p className="text-muted-foreground text-sm">
            Ya no se puede cambiar el acta de una adopción cerrada.
          </p>
        </>
      )}
    </section>
  );
}
