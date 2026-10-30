/** Criterios de la política de contraseñas del backend (8 a 64, mayúscula, minúscula y número). */
export const LONGITUD_MIN = 8;
export const LONGITUD_MAX = 64;
/** Solo estímulo: la política real no exige más de 8. */
const LONGITUD_FUERTE = 12;

export type ClaveCriterio = 'longitud' | 'mayuscula' | 'minuscula' | 'numero';
export type NivelFortaleza = 'vacia' | 'debil' | 'media' | 'fuerte';

export interface Criterio {
  clave: ClaveCriterio;
  texto: string;
  cumplido: boolean;
}

export const TEXTO_NIVEL: Readonly<Record<NivelFortaleza, string>> = {
  vacia: 'Escribe una contraseña',
  debil: 'Contraseña débil',
  media: 'Contraseña aceptable',
  fuerte: 'Contraseña fuerte',
};

export function evaluarFortaleza(contrasena: string): {
  criterios: Criterio[];
  nivel: NivelFortaleza;
} {
  const criterios: Criterio[] = [
    {
      clave: 'longitud',
      texto: `Entre ${LONGITUD_MIN} y ${LONGITUD_MAX} caracteres`,
      cumplido: contrasena.length >= LONGITUD_MIN && contrasena.length <= LONGITUD_MAX,
    },
    { clave: 'mayuscula', texto: 'Una letra mayúscula', cumplido: /[A-Z]/.test(contrasena) },
    { clave: 'minuscula', texto: 'Una letra minúscula', cumplido: /[a-z]/.test(contrasena) },
    { clave: 'numero', texto: 'Un número', cumplido: /\d/.test(contrasena) },
  ];
  if (contrasena.length === 0) return { criterios, nivel: 'vacia' };
  if (!criterios.every((c) => c.cumplido)) return { criterios, nivel: 'debil' };
  return { criterios, nivel: contrasena.length >= LONGITUD_FUERTE ? 'fuerte' : 'media' };
}
