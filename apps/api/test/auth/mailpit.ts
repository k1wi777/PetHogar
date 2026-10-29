// V10: Mailpit se consulta por su API HTTP (MAILPIT_HOST y MAILPIT_UI_PORT; por defecto localhost:8025).
const API = `http://${process.env.MAILPIT_HOST ?? 'localhost'}:${process.env.MAILPIT_UI_PORT ?? '8025'}/api/v1`;

interface ResumenMensaje {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

export interface MensajeCorreo {
  id: string;
  asunto: string;
  texto: string;
}

export async function mensajesPara(destinatario: string): Promise<MensajeCorreo[]> {
  const lista = (await (await fetch(`${API}/messages?limit=500`)).json()) as {
    messages: ResumenMensaje[];
  };
  const propios = lista.messages.filter((m) => m.To.some((t) => t.Address === destinatario));
  return Promise.all(
    propios.map(async (m) => {
      const detalle = (await (await fetch(`${API}/message/${m.ID}`)).json()) as { Text: string };
      return { id: m.ID, asunto: m.Subject, texto: detalle.Text };
    }),
  );
}

/** El envío es asíncrono respecto a la respuesta HTTP: se espera hasta `cantidad` mensajes. */
export async function esperarMensajes(
  destinatario: string,
  cantidad: number,
  tiempoMs = 8000,
): Promise<MensajeCorreo[]> {
  const limite = Date.now() + tiempoMs;
  let mensajes = await mensajesPara(destinatario);
  while (mensajes.length < cantidad && Date.now() < limite) {
    await new Promise((r) => setTimeout(r, 200));
    mensajes = await mensajesPara(destinatario);
  }
  return mensajes;
}

/** Solo borra los mensajes que creó la prueba, no el buzón completo. */
export async function borrarMensajes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await fetch(`${API}/messages`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  });
}

export function extraerToken(texto: string): string {
  const coincidencia = /verificar-correo\?token=([A-Za-z0-9_%-]+)/.exec(texto);
  if (!coincidencia) throw new Error('El correo no contiene el enlace de verificación');
  return decodeURIComponent(coincidencia[1]);
}
