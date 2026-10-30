import { etiquetaSexo, etiquetaTamano, formatearEdad } from '../lib/formato';
import type { FichaMascota } from '../types';

const siNo = (v: boolean) => (v ? 'Sí' : 'No');

export function DatosMascota({ ficha }: { ficha: FichaMascota }) {
  const datos: [string, string][] = [
    ['Especie', ficha.especie.charAt(0).toUpperCase() + ficha.especie.slice(1)],
    ['Raza', ficha.raza],
    ['Sexo', etiquetaSexo(ficha.sexo)],
    ['Edad', formatearEdad(ficha.edadMeses, true)],
    ['Tamaño', etiquetaTamano(ficha.tamano)],
    ...(ficha.color ? [['Color', ficha.color] as [string, string]] : []),
  ];
  const salud: [string, string][] = [
    ['Vacunado', siNo(ficha.vacunado)],
    ['Esterilizado', siNo(ficha.esterilizado)],
  ];
  return (
    <>
      {ficha.descripcion && <p className="text-lg">{ficha.descripcion}</p>}
      <section aria-labelledby="datos-titulo">
        <h2 id="datos-titulo" className="text-2xl">
          Datos de la mascota
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          {datos.map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground text-sm">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="salud-titulo">
        <h2 id="salud-titulo" className="text-2xl">
          Salud
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          {salud.map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground text-sm">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
          <div className="col-span-2">
            <dt className="text-muted-foreground text-sm">Estado de salud</dt>
            <dd className="font-semibold">{ficha.estadoSalud}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
