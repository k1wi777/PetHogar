'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { Boton } from '@/shared/ui/Boton';
import { reenviarVerificacion } from '../api/autenticacion';
import { useReenvio } from '../hooks/useReenvio';
import { MarcoAcceso } from './MarcoAcceso';

/** Vista posterior al registro: no es una ruta, así el correo no viaja en la URL ni se persiste. */
export function RevisaTuCorreo({ email }: { email: string }) {
  const reenviar = useCallback(() => reenviarVerificacion(email), [email]);
  const reenvio = useReenvio(reenviar);
  return (
    <MarcoAcceso>
      <h1 className="text-titulo">Revisa tu correo</h1>
      <p>
        Te enviamos un enlace para confirmar tu cuenta a <strong>{email}</strong>. Ábrelo para
        activar tu cuenta; después podrás ingresar.
      </p>
      <p className="text-muted-foreground">
        Si no lo ves, revisa la carpeta de correo no deseado. Puedes pedir otro enlace.
      </p>
      <Boton
        variante="contorno"
        onClick={reenvio.reenviar}
        cargando={reenvio.enviando}
        disabled={reenvio.restante > 0}
      >
        {reenvio.restante > 0
          ? `Reenviar enlace (espera ${reenvio.restante} s)`
          : 'Reenviar enlace de verificación'}
      </Boton>
      {reenvio.mensaje && <p role="status">{reenvio.mensaje}</p>}
      {reenvio.error && (
        <p role="alert" className="text-destructive font-medium">
          {reenvio.error}
        </p>
      )}
      <Link
        href="/ingresar"
        className="text-primary inline-flex min-h-11 items-center font-semibold underline self-start"
      >
        Ir a ingresar
      </Link>
    </MarcoAcceso>
  );
}
