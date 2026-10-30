import { afterEach, describe, expect, it } from 'vitest';
import { borrarIndicio, escribirIndicio, leerIndicio } from './indicio';

describe('indicio de sesión', () => {
  afterEach(() => borrarIndicio());

  it('escribe, lee y borra el rol', () => {
    expect(leerIndicio()).toBeNull();
    escribirIndicio('fundacion');
    expect(leerIndicio()).toBe('fundacion');
    borrarIndicio();
    expect(leerIndicio()).toBeNull();
  });

  it('ignora valores que no son un rol', () => {
    expect(leerIndicio('ph_rol=superadmin')).toBeNull();
    expect(leerIndicio('otra=1; ph_rol=adoptante; x=2')).toBe('adoptante');
    expect(leerIndicio('')).toBeNull();
  });
});
