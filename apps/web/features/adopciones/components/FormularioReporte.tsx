'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { aplicarError } from '@/shared/lib/errores-formulario';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { Boton } from '@/shared/ui/Boton';
import { AreaControlada } from '@/shared/ui/CampoControlado';
import { CampoFotos } from '@/shared/ui/CampoFotos';
import { claves, useEnviarReporte } from '../hooks/useAdopciones';
import {
  MAX_COMENTARIOS,
  MAX_FOTOS_REPORTE,
  esquemaReporte,
  type DatosReporte,
} from '../schemas/reporte';

const CAMPOS = ['comentarios', 'fotos'] as const;

function campoDelMensaje(mensaje: string): string | null {
  const t = mensaje.toLowerCase();
  return t.includes('foto') || t.includes('archivo') ? 'fotos' : null;
}

/** Reporte del adoptante: comentarios y hasta 5 fotos con previsualización (R14). */
export function FormularioReporte({ seguimientoId }: { seguimientoId: number }) {
  const [fallo, setFallo] = useState<string | null>(null);
  const enviar = useEnviarReporte(seguimientoId);
  const queryClient = useQueryClient();
  const { control, handleSubmit, setError } = useForm<DatosReporte>({
    resolver: zodResolver(esquemaReporte),
    mode: 'onTouched',
    shouldFocusError: true,
    defaultValues: { comentarios: '', fotos: [] },
  });
  const comentarios = useWatch({ control, name: 'comentarios' }) ?? '';

  function alEnviar(datos: DatosReporte) {
    if (enviar.isPending) return;
    setFallo(null);
    enviar.mutate(
      { comentarios: datos.comentarios.trim(), fotos: datos.fotos ?? [] },
      {
        onError: (error) => {
          aplicarError(
            error,
            CAMPOS,
            {
              marcarCampo: (campo, mensaje, enfocar) =>
                setError(
                  campo as keyof DatosReporte,
                  { message: mensaje },
                  { shouldFocus: enfocar },
                ),
              mostrarAviso: setFallo,
            },
            campoDelMensaje,
          );
          // Si el seguimiento cambió mientras tanto (409), se recarga lo vigente.
          void queryClient.invalidateQueries({ queryKey: claves.seguimiento(seguimientoId) });
        },
      },
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(alEnviar)}
      aria-busy={enviar.isPending || undefined}
      className="flex max-w-2xl flex-col gap-5"
    >
      {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
      <AreaControlada
        control={control}
        nombre="comentarios"
        etiqueta="Cuéntanos cómo está la mascota"
        ayuda={`${comentarios.length} de ${MAX_COMENTARIOS} caracteres`}
        rows={5}
        requerido
      />
      <CampoFotos
        control={control}
        nombre="fotos"
        etiqueta="Fotos (opcional)"
        ayuda={`JPG o PNG, máximo 5 MB cada una, hasta ${MAX_FOTOS_REPORTE} fotos.`}
        maximo={MAX_FOTOS_REPORTE}
      />
      <Boton type="submit" cargando={enviar.isPending} className="self-start">
        Enviar reporte
      </Boton>
    </form>
  );
}
