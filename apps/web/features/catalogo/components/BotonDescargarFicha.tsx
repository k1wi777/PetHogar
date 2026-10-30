import { Download } from 'lucide-react';
import { urlApiPublica } from '@/shared/api/servidor';
import { Boton } from '@/shared/ui/Boton';

/**
 * Enlace directo al PDF público: la API responde con `Content-Disposition: attachment`, así que es
 * una navegación sin CORS ni JavaScript.
 */
export function BotonDescargarFicha({ mascotaId, nombre }: { mascotaId: number; nombre: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Boton comoHijo variante="contorno">
        <a href={`${urlApiPublica()}/mascotas/${mascotaId}/ficha.pdf`}>
          <Download className="size-4" aria-hidden="true" />
          Descargar ficha (PDF) <span className="sr-only">de {nombre}</span>
        </a>
      </Boton>
      <p className="text-muted-foreground text-sm">
        Si no se descarga, espera un minuto: hay un límite de 10 descargas por minuto.
      </p>
    </div>
  );
}
