/** Lee los correos que envía la API real desde la API HTTP de Mailpit (`TEST_MAILPIT_URL`). */

interface ResumenMensaje {
  ID: string;
  Subject: string;
  Created: string;
}

const dormir = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

export function urlMailpit(): string {
  const url = process.env.TEST_MAILPIT_URL;
  if (!url) throw new Error('Define TEST_MAILPIT_URL (p. ej. http://localhost:58025). Ver V17.');
  return url.replace(/\/+$/, '');
}

/**
 * Espera el correo más reciente para `para` cuyo asunto cumpla `asunto` y que sea posterior a
 * `desde`; devuelve su texto plano. Solo borra después los mensajes que leyó.
 */
export async function esperarCorreo(
  para: string,
  asunto: RegExp,
  desde: number,
  esperaMs = 15_000,
): Promise<string> {
  const base = urlMailpit();
  const limite = Date.now() + esperaMs;
  while (Date.now() < limite) {
    const respuesta = await fetch(
      `${base}/api/v1/search?query=${encodeURIComponent(`to:${para}`)}`,
    );
    const { messages } = (await respuesta.json()) as { messages: ResumenMensaje[] };
    const buscado = messages.find(
      (m) => asunto.test(m.Subject) && Date.parse(m.Created) >= desde - 2000,
    );
    if (buscado) {
      const detalle = await fetch(`${base}/api/v1/message/${buscado.ID}`);
      const { Text } = (await detalle.json()) as { Text: string };
      await fetch(`${base}/api/v1/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IDs: [buscado.ID] }),
      });
      return Text;
    }
    await dormir(300);
  }
  throw new Error(`No llegó a ${para} un correo con asunto ${asunto} en ${esperaMs} ms`);
}

/** Token del enlace `…/verificar-correo?token=…` del correo de verificación. */
export function tokenDeVerificacion(texto: string): string {
  const coincide = /\/verificar-correo\?token=([^\s"<>&]+)/.exec(texto);
  if (!coincide) throw new Error('El correo no trae el enlace de verificación esperado');
  return decodeURIComponent(coincide[1]!);
}

/** Código de 6 dígitos del correo de recuperación («Tu código … es: 123456»). */
export function codigoDeRecuperacion(texto: string): string {
  const coincide = /es:\s*(\d{6})\b/.exec(texto);
  if (!coincide) throw new Error('El correo no trae el código de recuperación esperado');
  return coincide[1]!;
}
