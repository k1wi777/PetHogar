import { describe, expect, it } from 'vitest';
import { textoAnuncio } from './anuncio';

describe('textoAnuncio', () => {
  it('anuncia solo cuando aumenta', () => {
    expect(textoAnuncio(2, 3)).toBe('Tienes una notificación nueva.');
    expect(textoAnuncio(0, 4)).toBe('Tienes 4 notificaciones nuevas.');
  });
  it('no anuncia la primera carga, igual ni bajada', () => {
    expect(textoAnuncio(undefined, 5)).toBeNull();
    expect(textoAnuncio(3, 3)).toBeNull();
    expect(textoAnuncio(3, 1)).toBeNull();
    expect(textoAnuncio(3, undefined)).toBeNull();
  });
});
