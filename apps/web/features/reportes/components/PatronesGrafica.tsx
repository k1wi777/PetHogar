import {
  COLOR_TRAZO_PATRON,
  OPACIDAD_TRAZO_PATRON,
  PALETA_GRAFICA,
  type PatronGrafica,
} from '@/shared/lib/grafica';

/** Identificador de un patrón dentro de una gráfica (`prefijo` evita choques entre gráficas). */
export function idPatron(prefijo: string, indice: number): string {
  return `${prefijo}-p${indice % PALETA_GRAFICA.length}`;
}

export function rellenoDe(prefijo: string, indice: number): string {
  return `url(#${idPatron(prefijo, indice)})`;
}

function Trazo({ patron }: { patron: PatronGrafica }) {
  const comun = {
    stroke: COLOR_TRAZO_PATRON,
    strokeOpacity: OPACIDAD_TRAZO_PATRON,
    fill: 'none',
  } as const;
  switch (patron) {
    case 'rayas':
      return <path d="M0 2 H8 M0 6 H8" strokeWidth={1.5} {...comun} />;
    case 'puntos':
      return (
        <circle
          cx={4}
          cy={4}
          r={1.5}
          fill={COLOR_TRAZO_PATRON}
          fillOpacity={OPACIDAD_TRAZO_PATRON}
        />
      );
    case 'cuadricula':
      return <path d="M0 4 H8 M4 0 V8" strokeWidth={1.2} {...comun} />;
    case 'diagonal':
      return <path d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6" strokeWidth={1.5} {...comun} />;
    case 'solido':
      return null;
  }
}

/**
 * Definiciones SVG de los patrones de la paleta: cada serie o rebanada lleva color Y patrón, de
 * modo que no se distingue solo por el color. No importa Recharts (lo montan las vistas).
 */
export function PatronesGrafica({ prefijo }: { prefijo: string }) {
  return (
    <defs>
      {PALETA_GRAFICA.map((estilo, i) => (
        <pattern
          key={estilo.patron}
          id={idPatron(prefijo, i)}
          width={8}
          height={8}
          patternUnits="userSpaceOnUse"
        >
          <rect width={8} height={8} fill={estilo.color} />
          <Trazo patron={estilo.patron} />
        </pattern>
      ))}
    </defs>
  );
}
