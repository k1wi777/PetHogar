'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Boton } from '@/shared/ui/Boton';
import { AreaControlada, CampoControlado } from '@/shared/ui/CampoControlado';
import { registrarFundacion } from '../api/autenticacion';
import { aplicarError } from '../lib/errores-servidor';
import { esquemaFundacion, type DatosFundacion } from '../schemas/fundacion';
import { AvisoFormulario } from './AvisoFormulario';
import { CampoAceptacion } from './CampoAceptacion';
import { CampoContrasena } from './CampoContrasena';
import { CampoDocumento } from './CampoDocumento';

const CAMPOS: ReadonlyArray<keyof DatosFundacion> = [
  'nombre',
  'nit',
  'direccion',
  'ciudad',
  'descripcion',
  'telefono',
  'email',
  'contrasena',
  'documento',
  'aceptaPoliticaDatos',
];

function RegistroEnviado({ mensaje }: { mensaje: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center">
      <CheckCircle2 className="text-success size-12" aria-hidden="true" />
      <h1 className="text-3xl">Recibimos el registro de tu fundación</h1>
      <p role="status">{mensaje}</p>
      <p className="text-muted-foreground">
        Un administrador revisará tu documento. Recibirás un aviso cuando tu fundación sea aprobada
        o si necesitamos más información.
      </p>
      <Boton comoHijo variante="contorno">
        <Link href="/ingresar">Ir a ingresar</Link>
      </Boton>
    </div>
  );
}

export function FormularioRegistroFundacion() {
  const [enviado, setEnviado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<DatosFundacion>({
    resolver: zodResolver(esquemaFundacion),
    mode: 'onTouched',
    shouldFocusError: true,
    defaultValues: {
      nombre: '',
      nit: '',
      direccion: '',
      ciudad: '',
      descripcion: '',
      telefono: '',
      email: '',
      contrasena: '',
      aceptaPoliticaDatos: false,
    },
  });

  async function enviar(datos: DatosFundacion) {
    if (formState.isSubmitting) return;
    setFallo(null);
    try {
      const respuesta = await registrarFundacion(datos);
      setEnviado(respuesta.mensaje);
    } catch (error) {
      aplicarError(error, CAMPOS, {
        marcarCampo: (campo, mensaje, enfocar) =>
          setError(campo as keyof DatosFundacion, { message: mensaje }, { shouldFocus: enfocar }),
        mostrarAviso: setFallo,
      });
    }
  }

  if (enviado) return <RegistroEnviado mensaje={enviado} />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl">Registrar mi fundación</h1>
      <p className="text-muted-foreground">
        Los campos con * son obligatorios. Un administrador revisará tu documento antes de aprobar
        la fundación. ¿Quieres adoptar?{' '}
        <Link href="/registro" className="text-primary font-semibold underline">
          Crea una cuenta de adoptante
        </Link>
        .
      </p>
      <form
        onSubmit={handleSubmit(enviar)}
        noValidate
        aria-busy={formState.isSubmitting || undefined}
        className="flex flex-col gap-4"
      >
        {fallo && <AvisoFormulario>{fallo}</AvisoFormulario>}
        <CampoControlado
          control={control}
          nombre="nombre"
          etiqueta="Nombre de la fundación"
          autoComplete="organization"
          requerido
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoControlado
            control={control}
            nombre="nit"
            etiqueta="NIT"
            ayuda="Ejemplo: 900123456-7"
            autoComplete="off"
            requerido
          />
          <CampoControlado
            control={control}
            nombre="telefono"
            etiqueta="Teléfono"
            type="tel"
            autoComplete="tel"
            ayuda="Entre 7 y 14 dígitos; puede iniciar con +."
            requerido
          />
          <CampoControlado
            control={control}
            nombre="direccion"
            etiqueta="Dirección"
            autoComplete="street-address"
            requerido
          />
          <CampoControlado
            control={control}
            nombre="ciudad"
            etiqueta="Ciudad"
            autoComplete="address-level2"
            requerido
          />
        </div>
        <CampoControlado
          control={control}
          nombre="email"
          etiqueta="Correo electrónico"
          type="email"
          autoComplete="email"
          requerido
        />
        <AreaControlada
          control={control}
          nombre="descripcion"
          etiqueta="Descripción (opcional)"
          ayuda="Cuéntanos brevemente sobre tu fundación (hasta 500 caracteres)."
          rows={4}
        />
        <CampoContrasena control={control} nombre="contrasena" conFortaleza />
        <CampoDocumento
          control={control}
          nombre="documento"
          etiqueta="Documento legal de la fundación"
          ayuda="Cámara de comercio o equivalente. Formatos JPG, PNG o PDF, de hasta 5 MB."
        />
        <CampoAceptacion control={control} nombre="aceptaPoliticaDatos">
          Acepto la política de tratamiento de datos personales (Ley 1581 de 2012).
        </CampoAceptacion>
        <Boton type="submit" cargando={formState.isSubmitting}>
          Enviar registro
        </Boton>
      </form>
      <p>
        ¿Ya tienes cuenta?{' '}
        <Link href="/ingresar" className="text-primary font-semibold underline">
          Ingresar
        </Link>
      </p>
    </div>
  );
}
