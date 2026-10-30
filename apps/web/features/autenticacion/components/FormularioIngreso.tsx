'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSesion } from '@/shared/auth/SesionProvider';
import { PANEL_POR_ROL, rutaInternaSegura } from '@/shared/lib/acceso';
import { mensajeDe } from '@/shared/api/errores';
import { Boton } from '@/shared/ui/Boton';
import { CampoControlado } from '@/shared/ui/CampoControlado';
import { aviso } from '@/shared/ui/Toaster';
import { avisoDeFundacion } from '../lib/aviso-fundacion';
import { reenviarVerificacion } from '../api/autenticacion';
import { useReenvio } from '../hooks/useReenvio';
import { clasificarErrorLogin } from '../lib/estado-cuenta';
import { traducirError } from '../lib/errores-servidor';
import { esquemaLogin, type DatosLogin } from '../schemas/login';
import { AvisoFormulario } from './AvisoFormulario';
import { CampoContrasena } from './CampoContrasena';

interface Fallo {
  mensaje: string;
  sinVerificar: boolean;
}

export function FormularioIngreso({ siguiente }: { siguiente?: string | null }) {
  const router = useRouter();
  const { iniciarSesion } = useSesion();
  const [fallo, setFallo] = useState<Fallo | null>(null);
  const { control, handleSubmit, resetField, getValues, formState } = useForm<DatosLogin>({
    resolver: zodResolver(esquemaLogin),
    mode: 'onTouched',
    defaultValues: { email: '', contrasena: '' },
  });

  const reenviarEnlace = useCallback(
    () => reenviarVerificacion(getValues('email').trim().toLowerCase()),
    [getValues],
  );
  const reenvio = useReenvio(reenviarEnlace);

  async function enviar(datos: DatosLogin) {
    if (formState.isSubmitting) return;
    setFallo(null);
    try {
      const usuario = await iniciarSesion(datos.email, datos.contrasena);
      const aviso_ = avisoDeFundacion(usuario);
      if (aviso_) aviso.info(aviso_);
      const destino = rutaInternaSegura(siguiente);
      const duenoDelDestino = destino ? rolDelPanel(destino.split('?')[0]) : null;
      router.replace(
        destino && (!duenoDelDestino || duenoDelDestino === usuario.rol)
          ? destino
          : PANEL_POR_ROL[usuario.rol],
      );
    } catch (error) {
      const estado = clasificarErrorLogin(error);
      const salida = traducirError(error, []);
      const mensaje =
        salida.tipo === 'campos' ? (salida.aviso ?? mensajeDe(error)) : salida.mensaje;
      setFallo({ mensaje, sinVerificar: estado === 'sin-verificar' });
      // La contraseña nunca se conserva tras un fallo; el correo sí, para reintentar.
      resetField('contrasena', { defaultValue: '' });
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl">Ingresar</h1>
      <form
        onSubmit={handleSubmit(enviar)}
        noValidate
        aria-busy={formState.isSubmitting || undefined}
        className="flex flex-col gap-4"
      >
        {fallo && (
          <AvisoFormulario
            accion={
              fallo.sinVerificar ? (
                <div className="flex flex-col gap-2">
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
                  {reenvio.mensaje && (
                    <span role="status" className="text-sm">
                      {reenvio.mensaje}
                    </span>
                  )}
                  {reenvio.error && (
                    <span className="text-destructive text-sm">{reenvio.error}</span>
                  )}
                </div>
              ) : undefined
            }
          >
            {fallo.mensaje}
          </AvisoFormulario>
        )}
        <CampoControlado
          control={control}
          nombre="email"
          etiqueta="Correo electrónico"
          type="email"
          autoComplete="email"
          requerido
        />
        <CampoContrasena control={control} nombre="contrasena" autoComplete="current-password" />
        <Boton type="submit" cargando={formState.isSubmitting}>
          Ingresar
        </Boton>
      </form>
      <nav aria-label="Otras opciones" className="flex flex-col gap-2 text-base">
        <Link href="/recuperar" className="text-primary font-semibold underline">
          Olvidé mi contraseña
        </Link>
        <p>
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="text-primary font-semibold underline">
            Regístrate como adoptante
          </Link>{' '}
          o{' '}
          <Link href="/registro-fundacion" className="text-primary font-semibold underline">
            registra tu fundación
          </Link>
          .
        </p>
      </nav>
    </div>
  );
}
