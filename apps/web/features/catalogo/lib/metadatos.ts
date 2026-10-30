import type { Metadata } from 'next';
import type { FichaMascota } from '../types';
import { formatearEdad } from './formato';

const LONGITUD_DESCRIPCION = 160;

function recortar(texto: string, maximo = LONGITUD_DESCRIPCION): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (limpio.length <= maximo) return limpio;
  const corte = limpio.slice(0, maximo - 1);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return `${(ultimoEspacio > maximo / 2 ? corte.slice(0, ultimoEspacio) : corte).trimEnd()}…`;
}

/** URL de la foto principal para compartir: la versión grande, o la miniatura si no la hay. */
export function fotoParaCompartir(ficha: FichaMascota): string | null {
  for (const foto of ficha.fotos) {
    const url = foto.url ?? foto.urlCatalogo;
    if (url) return url;
  }
  return null;
}

export function metadatosFicha(ficha: FichaMascota): Metadata {
  const especie = ficha.especie;
  const title = `${ficha.nombre}, ${especie} en adopción — PetHogar`;
  const description = ficha.descripcion?.trim()
    ? recortar(ficha.descripcion)
    : `${ficha.nombre} es un ${especie} de raza ${ficha.raza}, de ${formatearEdad(ficha.edadMeses, true).toLowerCase()}, y espera un hogar en ${ficha.fundacion.ciudad}.`;
  const foto = fotoParaCompartir(ficha);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(foto ? { images: [{ url: foto, alt: `Foto de ${ficha.nombre}, ${especie}` }] } : {}),
    },
    ...(foto
      ? { twitter: { card: 'summary_large_image', title, description, images: [foto] } }
      : {}),
  };
}

export const METADATOS_NO_ENCONTRADA: Metadata = { title: 'Mascota no encontrada' };
