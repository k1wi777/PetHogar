import Link from 'next/link';

/** Vista posterior al registro cuando la API activa la cuenta sin verificar el correo. */
export function CuentaActivada({ mensaje }: { mensaje: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12">
      <h1 className="text-3xl">Tu cuenta está activa</h1>
      <p role="status">{mensaje}</p>
      <Link href="/ingresar" className="text-primary font-semibold underline">
        Ir a ingresar
      </Link>
    </div>
  );
}
