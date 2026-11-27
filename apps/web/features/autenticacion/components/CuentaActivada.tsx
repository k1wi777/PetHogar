import Link from 'next/link';
import { MarcoAcceso } from './MarcoAcceso';

/** Vista posterior al registro cuando la API activa la cuenta sin verificar el correo. */
export function CuentaActivada({ mensaje }: { mensaje: string }) {
  return (
    <MarcoAcceso>
      <h1 className="text-titulo">Tu cuenta está activa</h1>
      <p role="status">{mensaje}</p>
      <Link
        href="/ingresar"
        className="text-primary inline-flex min-h-11 items-center font-semibold underline self-start"
      >
        Ir a ingresar
      </Link>
    </MarcoAcceso>
  );
}
