'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { mensajeDe } from '@/shared/api/errores';
import { Boton } from '@/shared/ui/Boton';
import { CampoControlado } from '@/shared/ui/CampoControlado';
import { reenviarVerificacion, verificarCorreo } from '../api/autenticacion';
import { useReenvio } from '../hooks/useReenvio';
import { esquemaSolicitudCodigo, type DatosCorreo } from '../schemas/recuperacion';
import { AvisoFormulario } from './AvisoFormulario';

const SIN_TOKEN = 'El enlace de verificación no es válido. Solicita uno nuevo.';

type Resultado = { estado: 'cargando' } | { estado: 'ok' } | { estado: 'error'; mensaje: string };

/** Peticiones en vuelo por token: el modo estricto monta dos veces y un token usado daría error. */
const EN_VUELO = new Map<string, Promise<unknown>>();

function verificarUnaVez(token: string): Promise<unknown> {
  let peticion = EN_VUELO.get(token);
  if (!peticion) {
    peticion = verificarCorreo(token).finally(() => EN_VUELO.delete(token));
    EN_VUELO.set(token, peticion);
  }
  return peticion;
}

/** Página a la que apunta el correo (`/verificar-correo?token=…`); verifica una sola vez por token. */
export function VerificacionCorreo({ token }: { token?: string | null }) {
  const [resultado, setResultado] = useState<Resultado>({ estado: 'cargando' });

  useEffect(() => {
    if (!token) return;
    let cancelado = false;
    verificarUnaVez(token).then(
      () => {
        if (!cancelado) setResultado({ estado: 'ok' });
      },
      (error: unknown) => {
        if (!cancelado) setResultado({ estado: 'error', mensaje: mensajeDe(error) });
      },
    );
    return () => {
      cancelado = true;
    };
  }, [token]);

  if (token && resultado.estado === 'cargando') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
        <h1 className="text-3xl">Verificando tu correo</h1>
        <p role="status">Un momento, estamos confirmando tu correo…</p>
      </div>
    );
  }

  if (resultado.estado === 'ok') {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
        <h1 className="text-3xl">Tu correo quedó verificado</h1>
        <p role="status">Tu cuenta ya está activa. Ahora puedes ingresar.</p>
        <Boton comoHijo>
          <Link href="/ingresar">Ir a ingresar</Link>
        </Boton>
      </div>
    );
  }

  const mensaje = token && resultado.estado === 'error' ? resultado.mensaje : SIN_TOKEN;
  return <EnlaceInvalido mensaje={mensaje} />;
}

function EnlaceInvalido({ mensaje }: { mensaje: string }) {
  const { control, handleSubmit, getValues } = useForm<DatosCorreo>({
    resolver: zodResolver(esquemaSolicitudCodigo),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });
  const accion = useCallback(
    () => reenviarVerificacion(getValues('email').trim().toLowerCase()),
    [getValues],
  );
  const reenvio = useReenvio(accion);
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
      <h1 className="text-3xl">No pudimos verificar tu correo</h1>
      <AvisoFormulario>{mensaje}</AvisoFormulario>
      <form
        onSubmit={handleSubmit(() => reenvio.reenviar())}
        noValidate
        className="flex flex-col gap-4"
      >
        <CampoControlado
          control={control}
          nombre="email"
          etiqueta="Correo electrónico"
          type="email"
          autoComplete="email"
          ayuda="Escribe el correo con el que te registraste para recibir un enlace nuevo."
          requerido
        />
        <Boton type="submit" cargando={reenvio.enviando} disabled={reenvio.restante > 0}>
          {reenvio.restante > 0
            ? `Enviar enlace nuevo (espera ${reenvio.restante} s)`
            : 'Enviar un enlace nuevo'}
        </Boton>
      </form>
      {reenvio.mensaje && <p role="status">{reenvio.mensaje}</p>}
      {reenvio.error && (
        <p role="alert" className="text-destructive font-medium">
          {reenvio.error}
        </p>
      )}
      <Link href="/ingresar" className="text-primary font-semibold underline">
        Volver a ingresar
      </Link>
    </div>
  );
}
