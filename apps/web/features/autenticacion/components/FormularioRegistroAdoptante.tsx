'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Boton } from '@/shared/ui/Boton';
import { CampoControlado, SelectorControlado } from '@/shared/ui/CampoControlado';
import { registrarAdoptante } from '../api/autenticacion';
import { aplicarError } from '../lib/errores-servidor';
import { esquemaAdoptante, fechaMaximaNacimiento, type DatosAdoptante } from '../schemas/adoptante';
import { AvisoFormulario } from './AvisoFormulario';
import { CampoAceptacion } from './CampoAceptacion';
import { CampoContrasena } from './CampoContrasena';
import { RevisaTuCorreo } from './RevisaTuCorreo';

const CAMPOS: ReadonlyArray<keyof DatosAdoptante> = [
  'primerNombre',
  'segundoNombre',
  'primerApellido',
  'segundoApellido',
  'tipoDocumento',
  'numeroDocumento',
  'fechaNacimiento',
  'telefono',
  'email',
  'direccion',
  'ciudad',
  'contrasena',
  'aceptaPoliticaDatos',
];

const TIPOS = [
  { valor: 'CC', texto: 'Cédula de ciudadanía (CC)' },
  { valor: 'CE', texto: 'Cédula de extranjería (CE)' },
  { valor: 'PA', texto: 'Pasaporte (PA)' },
];

export function FormularioRegistroAdoptante() {
  const [registrado, setRegistrado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<DatosAdoptante>({
    resolver: zodResolver(esquemaAdoptante),
    mode: 'onTouched',
    shouldFocusError: true,
    defaultValues: {
      primerNombre: '',
      segundoNombre: '',
      primerApellido: '',
      segundoApellido: '',
      numeroDocumento: '',
      fechaNacimiento: '',
      telefono: '',
      email: '',
      direccion: '',
      ciudad: '',
      contrasena: '',
      aceptaPoliticaDatos: false,
    },
  });

  async function enviar(datos: DatosAdoptante) {
    if (formState.isSubmitting) return;
    setFallo(null);
    try {
      await registrarAdoptante(datos);
      setRegistrado(datos.email);
    } catch (error) {
      aplicarError(error, CAMPOS, {
        marcarCampo: (campo, mensaje, enfocar) =>
          setError(campo as keyof DatosAdoptante, { message: mensaje }, { shouldFocus: enfocar }),
        mostrarAviso: setFallo,
      });
    }
  }

  if (registrado) return <RevisaTuCorreo email={registrado} />;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl">Crear cuenta de adoptante</h1>
      <p className="text-muted-foreground">
        Los campos con * son obligatorios. ¿Eres una fundación o refugio?{' '}
        <Link href="/registro-fundacion" className="text-primary font-semibold underline">
          Registra tu fundación
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
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoControlado
            control={control}
            nombre="primerNombre"
            etiqueta="Primer nombre"
            autoComplete="given-name"
            requerido
          />
          <CampoControlado
            control={control}
            nombre="segundoNombre"
            etiqueta="Segundo nombre (opcional)"
            autoComplete="additional-name"
          />
          <CampoControlado
            control={control}
            nombre="primerApellido"
            etiqueta="Primer apellido"
            autoComplete="family-name"
            requerido
          />
          <CampoControlado
            control={control}
            nombre="segundoApellido"
            etiqueta="Segundo apellido (opcional)"
          />
          <SelectorControlado
            control={control}
            nombre="tipoDocumento"
            etiqueta="Tipo de documento"
            opciones={TIPOS}
            requerido
          />
          <CampoControlado
            control={control}
            nombre="numeroDocumento"
            etiqueta="Número de documento"
            autoComplete="off"
            requerido
          />
          <CampoControlado
            control={control}
            nombre="fechaNacimiento"
            etiqueta="Fecha de nacimiento"
            type="date"
            autoComplete="bday"
            max={fechaMaximaNacimiento(new Date())}
            ayuda="Debes ser mayor de 18 años."
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
        </div>
        <CampoControlado
          control={control}
          nombre="email"
          etiqueta="Correo electrónico"
          type="email"
          autoComplete="email"
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
        <CampoContrasena control={control} nombre="contrasena" conFortaleza />
        <CampoAceptacion control={control} nombre="aceptaPoliticaDatos">
          Acepto la política de tratamiento de datos personales (Ley 1581 de 2012).
        </CampoAceptacion>
        <Boton type="submit" cargando={formState.isSubmitting}>
          Crear mi cuenta
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
