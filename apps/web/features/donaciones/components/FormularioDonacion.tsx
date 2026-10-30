'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { aplicarError } from '@/shared/lib/errores-formulario';
import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { Boton } from '@/shared/ui/Boton';
import { AreaControlada, CampoControlado } from '@/shared/ui/CampoControlado';
import { CampoDocumento } from '@/shared/ui/CampoDocumento';
import { DialogoConfirmacion } from '@/shared/ui/DialogoConfirmacion';
import { GrupoRadio } from '@/shared/ui/GrupoRadio';
import { useCrearDonacion } from '../hooks/useDonaciones';
import { MAX_DESCRIPCION, esquemaDonacion, type DatosDonacion } from '../schemas/donacion';
import { formatearMonto } from '../schemas/monto';
import type { DonacionRegistrada, FundacionDestino, TipoDonacion } from '../types';
import { AvisoSinPagos } from './AvisoSinPagos';

interface Valores {
  tipo?: TipoDonacion;
  monto?: string;
  descripcion?: string;
  comprobante?: File;
}

const CAMPOS = ['tipo', 'monto', 'descripcion', 'comprobante'] as const;
const OPCIONES_TIPO = [
  { valor: 'economica', texto: 'Económica (dinero)' },
  { valor: 'especie', texto: 'En especie (alimento, insumos…)' },
];

function campoDelMensaje(mensaje: string): string | null {
  const t = mensaje.toLowerCase();
  return t.includes('comprobante') || t.includes('archivo') ? 'comprobante' : null;
}

function resumen(d: DatosDonacion): string {
  return d.tipo === 'economica'
    ? `Monto: ${formatearMonto(d.monto)}`
    : `Donación en especie: ${d.descripcion}`;
}

function Exito({ donacion, alOtra }: { donacion: DonacionRegistrada; alOtra: () => void }) {
  return (
    <div className="flex max-w-2xl flex-col items-start gap-4">
      <AvisoSinPagos className="w-full" />
      <CheckCircle2 className="text-success size-12" aria-hidden="true" />
      <h1 className="text-3xl">Registramos tu donación</h1>
      <div role="status" className="flex flex-col gap-1">
        <p>
          Fundación: <strong>{donacion.fundacion.nombre}</strong>
        </p>
        <p>Tipo: {donacion.tipo === 'economica' ? 'Económica' : 'En especie'}</p>
        {donacion.monto && <p>Monto: {formatearMonto(donacion.monto)}</p>}
        {donacion.descripcionEspecie && <p>Descripción: {donacion.descripcionEspecie}</p>}
        <p>{donacion.comprobante ? 'Adjuntaste un comprobante.' : 'No adjuntaste comprobante.'}</p>
      </div>
      <p className="text-muted-foreground">
        Gracias por ayudar. Recuerda que PetHogar solo registra el aporte.
      </p>
      <Boton variante="contorno" onClick={alOtra}>
        Registrar otra donación
      </Boton>
    </div>
  );
}

/** Donación a una fundación fija (D1): tipo con campos condicionales, comprobante y confirmación. */
export function FormularioDonacion({ fundacion }: { fundacion: FundacionDestino }) {
  const [pendiente, setPendiente] = useState<DatosDonacion | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [registrada, setRegistrada] = useState<DonacionRegistrada | null>(null);
  const [intento, setIntento] = useState(0);
  const crear = useCrearDonacion(fundacion.id);
  const { control, handleSubmit, setError } = useForm<Valores>({
    resolver: zodResolver(esquemaDonacion) as unknown as Resolver<Valores>,
    mode: 'onTouched',
    shouldFocusError: true,
    // Los campos que salen de pantalla se descartan: no se validan ni se envían.
    shouldUnregister: true,
    defaultValues: {},
  });
  const tipo = useWatch({ control, name: 'tipo' });
  const descripcion = useWatch({ control, name: 'descripcion' }) ?? '';

  function confirmar() {
    if (!pendiente || crear.isPending) return;
    setFallo(null);
    crear.mutate(pendiente, {
      onSuccess: (d) => {
        setPendiente(null);
        setRegistrada(d);
      },
      onError: (error) => {
        setPendiente(null);
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
      },
    });
  }

  if (registrada) {
    return (
      <Exito
        donacion={registrada}
        alOtra={() => {
          setRegistrada(null);
          setIntento((n) => n + 1);
        }}
      />
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">Registrar una donación</h1>
        <p>
          Fundación: <strong>{fundacion.nombre}</strong>
        </p>
      </header>
      <AvisoSinPagos />
      <form
        key={intento}
        noValidate
        onSubmit={handleSubmit((datos) => setPendiente(datos as unknown as DatosDonacion))}
        className="flex flex-col gap-5"
      >
        {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
        <GrupoRadio
          control={control}
          nombre="tipo"
          leyenda="Tipo de donación"
          opciones={OPCIONES_TIPO}
          requerido
        />
        {tipo === 'economica' && (
          <CampoControlado
            control={control}
            nombre="monto"
            etiqueta="Monto en pesos"
            ayuda="Solo números. Si tiene centavos, usa punto (por ejemplo 50000.50)."
            inputMode="decimal"
            autoComplete="off"
            requerido
          />
        )}
        {tipo === 'especie' && (
          <AreaControlada
            control={control}
            nombre="descripcion"
            etiqueta="¿Qué donaste?"
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
        <Boton type="submit" className="self-start">
          Revisar y registrar
        </Boton>
      </form>
      <DialogoConfirmacion
        abierto={pendiente !== null}
        onAbiertoChange={(a) => !a && !crear.isPending && setPendiente(null)}
        titulo="¿Registrar esta donación?"
        descripcion={
          pendiente ? (
            <>
              A <strong>{fundacion.nombre}</strong>. {resumen(pendiente)}.{' '}
              {pendiente.comprobante
                ? `Comprobante: ${pendiente.comprobante.name}.`
                : 'Sin comprobante.'}{' '}
              PetHogar no procesa pagos: solo registra tu aporte.
            </>
          ) : (
            ''
          )
        }
        textoConfirmar="Sí, registrar donación"
        textoCancelar="Volver"
        cargando={crear.isPending}
        onConfirmar={confirmar}
      />
    </div>
  );
}
