'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { aplicarError } from '@/shared/lib/errores-formulario';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { Boton } from '@/shared/ui/Boton';
import { AreaControlada, CampoControlado } from '@/shared/ui/CampoControlado';
import { CampoDocumento } from '@/shared/ui/CampoDocumento';
import { GrupoRadio } from '@/shared/ui/GrupoRadio';
import { aviso } from '@/shared/ui/Toaster';
import { useRegistrarDonacionManual } from '../hooks/useDonacionesGestion';
import { RUTA_DONACIONES } from '../lib/consulta';
import {
  MAX_DESCRIPCION,
  esquemaDonacionManual,
  type DatosDonacionManualValidados,
} from '../schemas/donacion-manual';
import type { TipoDonacion } from '../types';

interface Valores {
  nombreDonante?: string;
  tipo?: TipoDonacion;
  monto?: string;
  descripcion?: string;
  comprobante?: File;
}

const CAMPOS = ['nombreDonante', 'tipo', 'monto', 'descripcion', 'comprobante'] as const;
const OPCIONES_TIPO = [
  { valor: 'economica', texto: 'Económica (dinero)' },
  { valor: 'especie', texto: 'En especie (alimento, insumos…)' },
];

function campoDelMensaje(mensaje: string): string | null {
  const t = mensaje.toLowerCase();
  return t.includes('comprobante') || t.includes('archivo') ? 'comprobante' : null;
}

/** Registro manual de un aporte presencial: tipo con campos condicionales y comprobante opcional. */
export function FormularioDonacionManual() {
  const router = useRouter();
  const [fallo, setFallo] = useState<string | null>(null);
  const registrar = useRegistrarDonacionManual();
  const { control, handleSubmit, setError } = useForm<Valores>({
    resolver: zodResolver(esquemaDonacionManual) as unknown as Resolver<Valores>,
    mode: 'onTouched',
    shouldFocusError: true,
    // Los campos que salen de pantalla se descartan: no se validan ni se envían.
    shouldUnregister: true,
    defaultValues: { nombreDonante: '' },
  });
  const tipo = useWatch({ control, name: 'tipo' });
  const descripcion = useWatch({ control, name: 'descripcion' }) ?? '';

  async function enviar(datos: DatosDonacionManualValidados) {
    if (registrar.isPending) return;
    setFallo(null);
    try {
      await registrar.mutateAsync(datos);
      aviso.exito(`Aporte de ${datos.nombreDonante} registrado`);
      router.push(`${RUTA_DONACIONES}?registrado=1`);
    } catch (error) {
      aplicarError(
        error,
        CAMPOS,
        {
          marcarCampo: (campo, mensaje, enfocar) =>
            setError(campo as keyof Valores, { message: mensaje }, { shouldFocus: enfocar }),
          mostrarAviso: setFallo,
        },
        campoDelMensaje,
      );
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit((d) => enviar(d as unknown as DatosDonacionManualValidados))}
      aria-busy={registrar.isPending || undefined}
      className="flex max-w-2xl flex-col gap-5"
    >
      {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
      <CampoControlado
        control={control}
        nombre="nombreDonante"
        etiqueta="Nombre del donante"
        ayuda="Entre 2 y 100 caracteres. El donante no necesita tener cuenta en PetHogar."
        autoComplete="off"
        requerido
      />
      <GrupoRadio
        control={control}
        nombre="tipo"
        leyenda="Tipo de aporte"
        opciones={OPCIONES_TIPO}
        requerido
      />
      {tipo === 'economica' && (
        <CampoControlado
          control={control}
          nombre="monto"
          etiqueta="Monto en pesos"
          ayuda="Sin puntos de miles; usa punto o coma para los decimales (por ejemplo 50000,50). Máximo $ 1.000.000.000."
          inputMode="decimal"
          autoComplete="off"
          requerido
        />
      )}
      {tipo === 'especie' && (
        <AreaControlada
          control={control}
          nombre="descripcion"
          etiqueta="¿Qué donó?"
          ayuda={`${descripcion.length} de ${MAX_DESCRIPCION} caracteres`}
          rows={4}
          requerido
        />
      )}
      <CampoDocumento
        control={control}
        nombre="comprobante"
        etiqueta="Comprobante (opcional)"
        ayuda="JPG, PNG o PDF, máximo 5 MB."
        requerido={false}
        textoQuitar="Quitar comprobante"
        textoVistaPrevia="Vista previa del comprobante"
      />
      <Boton type="submit" cargando={registrar.isPending} className="w-full self-start sm:w-auto">
        Registrar aporte
      </Boton>
    </form>
  );
}
