'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { esErrorApi } from '@/shared/api/errores';
import { Boton } from '@/shared/ui/Boton';
import { CampoControlado } from '@/shared/ui/CampoControlado';
import { aviso } from '@/shared/ui/Toaster';
import { restablecerContrasena, solicitarCodigo } from '../api/autenticacion';
import { useReenvio } from '../hooks/useReenvio';
import { aplicarError } from '../lib/errores-servidor';
import {
  esquemaCodigo,
  esquemaNuevaContrasena,
  esquemaSolicitudCodigo,
  type DatosCodigo,
  type DatosCorreo,
  type DatosNuevaContrasena,
} from '../schemas/recuperacion';
import { AvisoFormulario } from './AvisoFormulario';
import { CampoContrasena } from './CampoContrasena';

type Paso = 'correo' | 'codigo' | 'contrasena';

const TITULOS: Readonly<Record<Paso, string>> = {
  correo: 'Paso 1 de 3: tu correo',
  codigo: 'Paso 2 de 3: el código',
  contrasena: 'Paso 3 de 3: tu nueva contraseña',
};

/**
 * Recuperación en tres pasos. El backend no valida el código por separado: el paso 2 solo comprueba
 * el formato y el paso 3 envía correo + código + contraseña nueva en una sola llamada. Todo vive en
 * memoria: ni el correo ni el código pasan por la URL ni por el almacenamiento del navegador.
 */
export function FormularioRecuperacion() {
  const [paso, setPaso] = useState<Paso>('correo');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [avisoPaso, setAvisoPaso] = useState<string | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (paso !== 'correo') titulo.current?.focus();
  }, [paso]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl">Recuperar contraseña</h1>
      <h2 ref={titulo} tabIndex={-1} className="text-xl font-bold focus:outline-none">
        {TITULOS[paso]}
      </h2>
      {paso === 'correo' && (
        <PasoCorreo
          alAvanzar={(correo) => {
            setEmail(correo);
            setAvisoPaso(null);
            setPaso('codigo');
          }}
        />
      )}
      {paso === 'codigo' && (
        <PasoCodigo
          email={email}
          aviso={avisoPaso}
          alCambiarCorreo={() => {
            setAvisoPaso(null);
            setPaso('correo');
          }}
          alAvanzar={(valor) => {
            setCodigo(valor);
            setAvisoPaso(null);
            setPaso('contrasena');
          }}
        />
      )}
      {paso === 'contrasena' && (
        <PasoContrasena
          email={email}
          codigo={codigo}
          alRechazarCodigo={(mensaje) => {
            setAvisoPaso(mensaje);
            setPaso('codigo');
          }}
        />
      )}
      <p className="text-base">
        <Link href="/ingresar" className="text-primary font-semibold underline">
          Volver a ingresar
        </Link>
      </p>
    </div>
  );
}

function PasoCorreo({ alAvanzar }: { alAvanzar: (email: string) => void }) {
  const [fallo, setFallo] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<DatosCorreo>({
    resolver: zodResolver(esquemaSolicitudCodigo),
    mode: 'onTouched',
    defaultValues: { email: '' },
  });

  async function enviar({ email }: DatosCorreo) {
    if (formState.isSubmitting) return;
    setFallo(null);
    try {
      await solicitarCodigo(email);
      alAvanzar(email);
    } catch (error) {
      aplicarError(error, [], { marcarCampo: () => undefined, mostrarAviso: setFallo });
    }
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      <p>Escribe el correo de tu cuenta y te enviaremos un código de 6 dígitos.</p>
      {fallo && <AvisoFormulario>{fallo}</AvisoFormulario>}
      <CampoControlado
        control={control}
        nombre="email"
        etiqueta="Correo electrónico"
        type="email"
        autoComplete="email"
        requerido
      />
      <Boton type="submit" cargando={formState.isSubmitting}>
        Enviar código
      </Boton>
    </form>
  );
}

function PasoCodigo({
  email,
  aviso: avisoPaso,
  alCambiarCorreo,
  alAvanzar,
}: {
  email: string;
  aviso: string | null;
  alCambiarCorreo: () => void;
  alAvanzar: (codigo: string) => void;
}) {
  const { control, handleSubmit } = useForm<DatosCodigo>({
    resolver: zodResolver(esquemaCodigo),
    mode: 'onTouched',
    defaultValues: { codigo: '' },
  });
  const pedirOtro = useCallback(() => solicitarCodigo(email), [email]);
  const reenvio = useReenvio(pedirOtro);

  return (
    <div className="flex flex-col gap-4">
      <p role="status">
        Si el correo <strong>{email}</strong> pertenece a una cuenta, te enviamos un código de 6
        dígitos. El código vence en pocos minutos. Si no llega, revisa la carpeta de correo no
        deseado y espera unos minutos antes de pedir otro: no es posible pedir códigos seguidos.
      </p>
      {avisoPaso && <AvisoFormulario>{avisoPaso}</AvisoFormulario>}
      <form
        onSubmit={handleSubmit(({ codigo }) => alAvanzar(codigo))}
        noValidate
        className="flex flex-col gap-4"
      >
        <CampoControlado
          control={control}
          nombre="codigo"
          etiqueta="Código de 6 dígitos"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          requerido
        />
        <Boton type="submit">Continuar</Boton>
      </form>
      <div className="flex flex-col gap-2">
        <Boton
          variante="contorno"
          onClick={reenvio.reenviar}
          cargando={reenvio.enviando}
          disabled={reenvio.restante > 0}
        >
          {reenvio.restante > 0
            ? `Pedir otro código (espera ${reenvio.restante} s)`
            : 'Pedir otro código'}
        </Boton>
        {reenvio.mensaje && (
          <p role="status" className="text-sm">
            {reenvio.mensaje}
          </p>
        )}
        {reenvio.error && (
          <p role="alert" className="text-destructive text-sm">
            {reenvio.error}
          </p>
        )}
        <Boton variante="fantasma" onClick={alCambiarCorreo}>
          Usar otro correo
        </Boton>
      </div>
    </div>
  );
}

function PasoContrasena({
  email,
  codigo,
  alRechazarCodigo,
}: {
  email: string;
  codigo: string;
  alRechazarCodigo: (mensaje: string) => void;
}) {
  const router = useRouter();
  const [fallo, setFallo] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<DatosNuevaContrasena>({
    resolver: zodResolver(esquemaNuevaContrasena),
    mode: 'onTouched',
    defaultValues: { nuevaContrasena: '' },
  });

  async function enviar({ nuevaContrasena }: DatosNuevaContrasena) {
    if (formState.isSubmitting) return;
    setFallo(null);
    try {
      await restablecerContrasena({ email, codigo, nuevaContrasena });
    } catch (error) {
      const salida = aplicarError(error, ['nuevaContrasena'], {
        marcarCampo: (campo, mensaje, enfocar) =>
          setError(campo as 'nuevaContrasena', { message: mensaje }, { shouldFocus: enfocar }),
        mostrarAviso: setFallo,
      });
      // Un 400 sin error de contraseña es el rechazo del código: se vuelve al paso 2 con el correo intacto.
      if (esErrorApi(error) && error.estado === 400) {
        if (salida.tipo === 'aviso') alRechazarCodigo(salida.mensaje);
        else if (salida.tipo === 'campos' && salida.campos.length === 0) {
          alRechazarCodigo(salida.aviso ?? error.mensaje);
        }
      }
      return;
    }
    aviso.exito('Tu contraseña se cambió. Ya puedes ingresar con la nueva.');
    router.replace('/ingresar');
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      {fallo && <AvisoFormulario>{fallo}</AvisoFormulario>}
      <CampoContrasena
        control={control}
        nombre="nuevaContrasena"
        etiqueta="Nueva contraseña"
        conFortaleza
      />
      <Boton type="submit" cargando={formState.isSubmitting}>
        Cambiar contraseña
      </Boton>
    </form>
  );
}
