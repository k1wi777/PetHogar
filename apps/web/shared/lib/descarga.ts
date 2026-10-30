import { http } from '@/shared/api/http';
import { rutaDeEnlace } from './enlaces';

const EXTENSIONES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

export function extensionDeTipo(tipo: string): string {
  return EXTENSIONES[tipo] ?? 'bin';
}

/**
 * Pide el archivo con la sesión (nunca una URL pública) y lo entrega como descarga. El nombre se
 * genera aquí con la extensión del tipo real; devuelve el nombre elegido.
 */
export async function descargarArchivo(url: string, nombreBase: string): Promise<string> {
  const { blob, tipo } = await http.descargar(rutaDeEnlace(url));
  const nombre = `${nombreBase}.${extensionDeTipo(tipo)}`;
  const objeto = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = objeto;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  // El navegador necesita el siguiente ciclo para iniciar la descarga antes de liberar el objeto.
  setTimeout(() => URL.revokeObjectURL(objeto), 0);
  return nombre;
}
