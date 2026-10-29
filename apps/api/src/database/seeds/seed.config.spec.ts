import { leerSeedConfig, TELEFONO_ADMIN_POR_DEFECTO } from './seed.config';

const VALIDO = {
  SEED_ADMIN_EMAIL: 'admin@pethogar.local',
  SEED_ADMIN_PASSWORD: 'una-clave-larga-1',
};

describe('leerSeedConfig', () => {
  it('acepta variables válidas y usa el teléfono por defecto', () => {
    const c = leerSeedConfig(VALIDO);
    expect(c.adminEmail).toBe('admin@pethogar.local');
    expect(c.adminTelefono).toBe(TELEFONO_ADMIN_POR_DEFECTO);
    expect(c.demo).toBe(false);
  });

  it('informa en español cada variable ausente', () => {
    expect(() => leerSeedConfig({})).toThrow(/SEED_ADMIN_EMAIL: es obligatoria/);
    expect(() => leerSeedConfig({})).toThrow(/SEED_ADMIN_PASSWORD: es obligatoria/);
  });

  it('rechaza correo inválido y contraseña corta', () => {
    expect(() =>
      leerSeedConfig({ SEED_ADMIN_EMAIL: 'no-es-correo', SEED_ADMIN_PASSWORD: 'corta' }),
    ).toThrow(
      /SEED_ADMIN_EMAIL: debe ser un correo[\s\S]*SEED_ADMIN_PASSWORD: debe tener al menos 10/,
    );
  });

  it('rechaza un teléfono demasiado largo', () => {
    expect(() => leerSeedConfig({ ...VALIDO, SEED_ADMIN_TELEFONO: '1'.repeat(16) })).toThrow(
      /SEED_ADMIN_TELEFONO/,
    );
  });

  it('exige SEED_DEMO_PASSWORD solo con --demo', () => {
    expect(() => leerSeedConfig(VALIDO)).not.toThrow();
    expect(() => leerSeedConfig(VALIDO, ['--demo'])).toThrow(/SEED_DEMO_PASSWORD/);
    const c = leerSeedConfig({ ...VALIDO, SEED_DEMO_PASSWORD: 'demo-clave-larga' }, ['--demo']);
    expect(c.demo).toBe(true);
    expect(c.demoPassword).toBe('demo-clave-larga');
  });
});
