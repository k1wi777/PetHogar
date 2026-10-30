import { AvisoAlerta } from '@/shared/ui/AvisoAlerta';
import { Boton } from '@/shared/ui/Boton';
import type { DatosSolicitud } from '../schemas/solicitud';
import { ETIQUETA_VIVIENDA, type MascotaParaSolicitar } from '../types';

/** Paso previo al envío: lo que se enviará, con confirmación explícita y vuelta a editar (R4). */
export function ResumenSolicitud({
  mascota,
  datos,
  enviando,
  fallo,
  alEditar,
  alConfirmar,
}: {
  mascota: MascotaParaSolicitar;
  datos: Partial<DatosSolicitud>;
  enviando: boolean;
  fallo: string | null;
  alEditar: () => void;
  alConfirmar: () => void;
}) {
  const filas: Array<[string, string]> = [
    ['Mascota', `${mascota.nombre} (${mascota.fundacion.nombre})`],
    ['Motivo', datos.motivo?.trim() ?? ''],
    ['Tipo de vivienda', datos.tipoVivienda ? ETIQUETA_VIVIENDA[datos.tipoVivienda] : ''],
    ['Otras mascotas', datos.tieneOtrasMascotas ? 'Sí' : 'No'],
    ['Formulario firmado', datos.formulario?.name ?? ''],
  ];
  return (
    <section aria-labelledby="resumen-titulo" className="flex flex-col gap-4">
      <h2 id="resumen-titulo" className="text-2xl">
        Revisa tu solicitud antes de enviarla
      </h2>
      <dl className="border-border-suave bg-card grid gap-3 rounded-lg border p-4 sm:grid-cols-[12rem_1fr]">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="contents">
            <dt className="font-semibold">{etiqueta}</dt>
            <dd className="break-words whitespace-pre-line">{valor}</dd>
          </div>
        ))}
      </dl>
      {fallo && <AvisoAlerta>{fallo}</AvisoAlerta>}
      <div className="flex flex-wrap gap-3">
        <Boton onClick={alConfirmar} cargando={enviando}>
          Confirmar y enviar
        </Boton>
        <Boton variante="contorno" onClick={alEditar} disabled={enviando}>
          Volver a editar
        </Boton>
      </div>
    </section>
  );
}
