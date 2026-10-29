import type { DatosPlantilla, NombrePlantilla } from '../mail.interface';
import { escaparHtml, sanearAsunto } from './escape';

export interface CorreoRenderizado {
  asunto: string;
  texto: string;
  html: string;
}

interface Contenido {
  asunto: string;
  /** Párrafos en texto plano; se escapan al generar el HTML. */
  parrafos: string[];
  enlace?: string;
}

function layout(parrafos: string[], enlace?: string): string {
  const cuerpo = parrafos.map((p) => `<p>${escaparHtml(p)}</p>`).join('');
  const boton = enlace ? `<p><a href="${escaparHtml(enlace)}">${escaparHtml(enlace)}</a></p>` : '';
  return (
    '<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#222">' +
    '<h1 style="color:#2f6f4f">PetHogar</h1>' +
    `${cuerpo}${boton}` +
    '<hr><p style="font-size:12px;color:#666">Este es un correo automático de PetHogar; ' +
    'por favor no respondas a este mensaje.</p></body></html>'
  );
}

function contenido<P extends NombrePlantilla>(plantilla: P, datos: DatosPlantilla[P]): Contenido {
  switch (plantilla) {
    case 'prueba': {
      const { nombre } = datos as DatosPlantilla['prueba'];
      return {
        asunto: 'Correo de prueba de PetHogar',
        parrafos: [`Hola, ${nombre}.`, 'Este es un correo de prueba: el envío funciona.'],
      };
    }
    case 'notificacion': {
      const d = datos as DatosPlantilla['notificacion'];
      return {
        asunto: d.titulo,
        parrafos: [`Hola, ${d.nombre}.`, d.mensaje],
        enlace: d.enlace,
      };
    }
    default:
      throw new Error(`Plantilla de correo desconocida: ${String(plantilla)}`);
  }
}

/** Genera asunto, texto plano y HTML en español; los datos dinámicos se escapan en el HTML. */
export function renderizar<P extends NombrePlantilla>(
  plantilla: P,
  datos: DatosPlantilla[P],
): CorreoRenderizado {
  const { asunto, parrafos, enlace } = contenido(plantilla, datos);
  const texto = [...parrafos, ...(enlace ? [enlace] : []), '— PetHogar (correo automático)'].join(
    '\n\n',
  );
  return { asunto: sanearAsunto(asunto), texto, html: layout(parrafos, enlace) };
}
