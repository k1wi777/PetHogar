const ENTIDADES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (caracter) => ENTIDADES[caracter]);
}

/** Elimina saltos de línea para evitar inyección de cabeceras en el asunto. */
export function sanearAsunto(texto: string): string {
  return texto.replace(/[\r\n]+/g, ' ').trim();
}
