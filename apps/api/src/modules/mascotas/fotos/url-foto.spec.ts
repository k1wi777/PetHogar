import { urlPublicaFoto } from './url-foto';

describe('urlPublicaFoto', () => {
  const storage = { urlPublica: jest.fn((k: string) => `http://x/uploads/${k.slice(8)}`) };

  it('convierte una clave pública en su URL', () => {
    expect(urlPublicaFoto(storage as never, 'publico/mascotas/a.jpg')).toBe(
      'http://x/uploads/mascotas/a.jpg',
    );
  });

  it('devuelve null (sin lanzar ni exponer nada) para claves que no son públicas', () => {
    expect(urlPublicaFoto(storage as never, '/uploads/demo/luna.jpg')).toBeNull();
    expect(urlPublicaFoto(storage as never, 'privado/fundaciones/a.pdf')).toBeNull();
    expect(urlPublicaFoto(storage as never, '')).toBeNull();
  });
});
