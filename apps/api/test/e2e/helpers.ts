import type request from 'supertest';

export interface PdfDescargado {
  cuerpo: Buffer;
  tipo: string;
  disposicion: string;
  ms: number;
}

/** Descarga un PDF como `Buffer` (superagent no almacena por sí solo los binarios) y mide la respuesta. */
export async function descargarPdf(peticion: request.Test): Promise<PdfDescargado> {
  const inicio = Date.now();
  const res = await peticion.buffer(true).parse((respuesta, devolver) => {
    const trozos: Buffer[] = [];
    respuesta.on('data', (t: Buffer) => trozos.push(t));
    respuesta.on('end', () => devolver(null, Buffer.concat(trozos)));
  });
  return {
    cuerpo: res.body as Buffer,
    tipo: String(res.headers['content-type']),
    disposicion: String(res.headers['content-disposition']),
    ms: Date.now() - inicio,
  };
}

export const esPdfValido = (b: Buffer): boolean =>
  b.subarray(0, 5).toString('latin1') === '%PDF-' &&
  b.subarray(-8).toString('latin1').includes('%%EOF');
