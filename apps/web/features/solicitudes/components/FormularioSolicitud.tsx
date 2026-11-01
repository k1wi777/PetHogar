'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Download, Info } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { aplicarError } from '@/shared/lib/errores-formulario';
import { Boton } from '@/shared/ui/Boton';
import { AreaControlada } from '@/shared/ui/CampoControlado';
import { CampoDocumento } from '@/shared/ui/CampoDocumento';
import { GrupoRadio } from '@/shared/ui/GrupoRadio';
import { useCrearSolicitud } from '../hooks/useSolicitudes';
import { campoDelMensajeSolicitud, clasificarErrorEnvio } from '../lib/errores';
import { NOMBRE_PLANTILLA_ADOPCION, RUTA_PLANTILLA_ADOPCION } from '../lib/plantilla';
import { MAX_MOTIVO, esquemaSolicitud, type DatosSolicitud } from '../schemas/solicitud';
import { ETIQUETA_VIVIENDA, TIPOS_VIVIENDA, type MascotaParaSolicitar } from '../types';
import { MensajeAviso } from './MensajeAviso';
import { ResumenSolicitud } from './ResumenSolicitud';

const CAMPOS = ['motivo', 'tipoVivienda', 'tieneOtrasMascotas', 'formulario'] as const;
type Fase = 'edicion' | 'resumen' | 'enviada' | 'duplicada' | 'no-disponible';

const OPCIONES_VIVIENDA = TIPOS_VIVIENDA.map((v) => ({ valor: v, texto: ETIQUETA_VIVIENDA[v] }));
const OPCIONES_SI_NO = [
  { valor: 'si', texto: 'Sí' },
  { valor: 'no', texto: 'No' },
];

export function EnlaceMisSolicitudes({ children }: { children: string }) {
  return (
    <Boton comoHijo>
      <Link href="/adoptante/solicitudes">{children}</Link>
    </Boton>
  );
}

/** Confirmación del envío: el formulario desaparece, así que el foco pasa al título. */
function SolicitudEnviada({ mascota }: { mascota: MascotaParaSolicitar }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), []);
  return (
    <div className="flex max-w-xl flex-col items-start gap-4">
      <CheckCircle2 className="text-success size-12" aria-hidden="true" />
      <h1 ref={titulo} tabIndex={-1} className="text-3xl focus:outline-none">
        Enviamos tu solicitud
      </h1>
      <p role="status">
        La fundación {mascota.fundacion.nombre} revisará tu solicitud para adoptar a{' '}
        {mascota.nombre}. Te avisaremos cuando responda.
      </p>
      <EnlaceMisSolicitudes>Ir a mis solicitudes</EnlaceMisSolicitudes>
    </div>
  );
}

/** Pantalla de «Quiero adoptar»: edición, resumen previo y confirmación explícita (R2 a R7). */
export function FormularioSolicitud({ mascota }: { mascota: MascotaParaSolicitar }) {
  const [fase, setFase] = useState<Fase>('edicion');
  const [fallo, setFallo] = useState<string | null>(null);
  const crear = useCrearSolicitud();
  const { control, handleSubmit, setError, getValues } = useForm<DatosSolicitud>({
    resolver: zodResolver(esquemaSolicitud),
    mode: 'onTouched',
    shouldFocusError: true,
    defaultValues: { motivo: '' },
  });
  const motivo = useWatch({ control, name: 'motivo' }) ?? '';

  function confirmar() {
    if (crear.isPending) return; // evita el doble envío
    setFallo(null);
    const datos = getValues();
    crear.mutate(
      {
        mascotaId: mascota.id,
        motivo: datos.motivo.trim(),
        tipoVivienda: datos.tipoVivienda,
        tieneOtrasMascotas: datos.tieneOtrasMascotas,
        formulario: datos.formulario,
      },
      {
        onSuccess: () => setFase('enviada'),
        onError: (error) => {
          const clase = clasificarErrorEnvio(error);
          if (clase.tipo === 'duplicada') return setFase('duplicada');
          if (clase.tipo === 'no-disponible') return setFase('no-disponible');
          const salida = aplicarError(
            error,
            CAMPOS,
            {
              marcarCampo: (campo, mensaje, enfocar) =>
                setError(
                  campo as keyof DatosSolicitud,
                  { message: mensaje },
                  { shouldFocus: enfocar },
                ),
              mostrarAviso: setFallo,
            },
            (mensaje) => campoDelMensajeSolicitud(mensaje),
          );
          // Un error de campo se corrige en el formulario; el resto se ve junto al resumen.
          if (salida.tipo === 'campos' && salida.campos.length > 0) setFase('edicion');
        },
      },
    );
  }

  if (fase === 'enviada') return <SolicitudEnviada mascota={mascota} />;
  if (fase === 'duplicada') {
    return (
      <MensajeAviso
        titulo="Ya tienes una solicitud para esta mascota"
        mensaje={`Ya enviaste una solicitud activa para adoptar a ${mascota.nombre}. Puedes ver cómo va en «Mis solicitudes».`}
      >
        <EnlaceMisSolicitudes>Ir a mis solicitudes</EnlaceMisSolicitudes>
      </MensajeAviso>
    );
  }
  if (fase === 'no-disponible') {
    return (
      <MensajeAviso
        titulo="Esta mascota ya no está disponible"
        mensaje="Es posible que otra familia la haya adoptado o que la fundación ya no la tenga publicada."
      >
        <Boton comoHijo>
          <Link href="/adoptar">Ver otras mascotas</Link>
        </Boton>
      </MensajeAviso>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl">Solicitud para adoptar a {mascota.nombre}</h1>
        <p className="text-muted-foreground">
          Fundación responsable: <strong>{mascota.fundacion.nombre}</strong> (
          {mascota.fundacion.ciudad}
          ). Los campos con * son obligatorios.
        </p>
      </header>

      {fase === 'resumen' && (
        <ResumenSolicitud
          mascota={mascota}
          datos={getValues()}
          enviando={crear.isPending}
          fallo={fallo}
          alEditar={() => {
            setFallo(null);
            setFase('edicion');
          }}
          alConfirmar={confirmar}
        />
      )}

      {/* Se conserva montado al revisar el resumen para no perder lo escrito ni el archivo. */}
      <form
        hidden={fase !== 'edicion'}
        noValidate
        onSubmit={handleSubmit(() => setFase('resumen'))}
        className="flex flex-col gap-5"
      >
        <AreaControlada
          control={control}
          nombre="motivo"
          etiqueta="¿Por qué quieres adoptar?"
          ayuda={`${motivo.length} de ${MAX_MOTIVO} caracteres`}
          rows={5}
          requerido
        />
        <GrupoRadio
          control={control}
          nombre="tipoVivienda"
          leyenda="Tipo de vivienda"
          opciones={OPCIONES_VIVIENDA}
          requerido
        />
        <GrupoRadio
          control={control}
          nombre="tieneOtrasMascotas"
          leyenda="¿Tienes otras mascotas?"
          opciones={OPCIONES_SI_NO}
          requerido
          aTexto={(v) => (v === true ? 'si' : v === false ? 'no' : '')}
          aValor={(t) => t === 'si'}
        />
        <div className="flex flex-col gap-2">
          <CampoDocumento
            control={control}
            nombre="formulario"
            etiqueta="Formulario de adopción firmado"
            ayuda="JPG, PNG o PDF, máximo 5 MB."
            textoQuitar="Quitar archivo"
            textoVistaPrevia="Vista previa del formulario"
          />
          <p className="flex items-start gap-2 text-sm">
            <Info className="text-info-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Descarga la plantilla, imprímela, fírmala y súbela aquí. Si tu fundación tiene su
              propio formato, pídeselo y adjúntalo igual.
            </span>
          </p>
          <a
            href={RUTA_PLANTILLA_ADOPCION}
            download={NOMBRE_PLANTILLA_ADOPCION}
            className="text-primary inline-flex min-h-11 items-center gap-2 self-start font-semibold underline"
          >
            <Download className="size-4" aria-hidden="true" />
            Descargar plantilla (PDF)
          </a>
        </div>
        <div className="flex flex-wrap gap-3">
          <Boton type="submit">Revisar mi solicitud</Boton>
          <Boton comoHijo variante="contorno">
            <Link href={`/mascotas/${mascota.id}`}>Volver a la ficha</Link>
          </Boton>
        </div>
      </form>
    </div>
  );
}
