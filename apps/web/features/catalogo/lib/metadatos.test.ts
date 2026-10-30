import { describe, expect, it } from 'vitest';
import { fichaEjemplo } from '../prueba-datos';
import { fotoParaCompartir, metadatosFicha } from './metadatos';

describe('metadatosFicha', () => {
  it('con foto: título, descripción y Open Graph con la versión grande', () => {
    const m = metadatosFicha(fichaEjemplo());
    expect(m.title).toBe('Luna, perro en adopción — PetHogar');
    expect(m.description).toBe('Cariñosa y juguetona.');
    expect(m.openGraph).toMatchObject({
      title: 'Luna, perro en adopción — PetHogar',
      type: 'website',
      images: [{ url: 'http://api/uploads/publico/a.webp' }],
    });
    expect(m.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it('usa la miniatura si la versión grande es nula', () => {
    const f = fichaEjemplo({
      fotos: [{ id: 2, esPrincipal: true, urlCatalogo: 'http://api/m.webp', url: null }],
    });
    expect(fotoParaCompartir(f)).toBe('http://api/m.webp');
  });

  it('sin foto no declara imagen ni tarjeta grande', () => {
    const m = metadatosFicha(
      fichaEjemplo({ fotos: [{ id: 1, esPrincipal: true, urlCatalogo: null, url: null }] }),
    );
    expect(m.openGraph).not.toHaveProperty('images');
    expect(m.twitter).toBeUndefined();
  });

  it('recorta descripciones largas a unos 160 caracteres', () => {
    const m = metadatosFicha(fichaEjemplo({ descripcion: 'palabra '.repeat(80) }));
    expect(String(m.description).length).toBeLessThanOrEqual(160);
    expect(String(m.description).endsWith('…')).toBe(true);
  });

  it('sin descripción compone un texto con raza, edad y ciudad', () => {
    const m = metadatosFicha(fichaEjemplo({ descripcion: null }));
    expect(m.description).toContain('Criollo');
    expect(m.description).toContain('2 años y 6 meses');
    expect(m.description).toContain('Montería');
  });
});
