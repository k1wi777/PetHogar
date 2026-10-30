import { useEspecieDeRaza } from '../hooks/useMascotasGestion';
import { etiquetaSexo, etiquetaTamano, formatearEdad } from '@/shared/lib/formato-mascota';
import type { MascotaGestion } from '../types';

const siNo = (v: boolean) => (v ? 'Sí' : 'No');
const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Datos de una mascota que ya no se puede editar (adoptada o inactiva), con la razón arriba. */
export function DatosSoloLectura({ mascota, razon }: { mascota: MascotaGestion; razon: string }) {
  const origen = useEspecieDeRaza(mascota.razaId);
  const filas: [string, string][] = [
    ['Nombre', mascota.nombre],
    ['Especie', origen.nombreEspecie ? capitalizar(origen.nombreEspecie) : 'No disponible'],
    ['Raza', origen.nombreRaza ?? 'No disponible'],
    ['Sexo', etiquetaSexo(mascota.sexo)],
    ['Edad', formatearEdad(mascota.edadMeses, true)],
    ['Tamaño', etiquetaTamano(mascota.tamano)],
    ['Color', mascota.color ?? 'Sin indicar'],
    ['Esterilizado/a', siNo(mascota.esterilizado)],
    ['Vacunas al día', siNo(mascota.vacunado)],
    ['Estado de salud', mascota.estadoSalud],
    ['Descripción', mascota.descripcion ?? 'Sin descripción'],
  ];
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p role="status" className="bg-muted rounded-md p-3">
        {razon}
      </p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="contents">
            <dt className="text-muted-foreground font-semibold">{etiqueta}</dt>
            <dd className="break-words">{valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
