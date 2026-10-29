import { SnakeNamingStrategy, aSnakeCase } from './snake-naming.strategy';
import { crearOpcionesTypeOrm } from './typeorm.options';

describe('SnakeNamingStrategy', () => {
  const estrategia = new SnakeNamingStrategy();

  it('convierte camelCase a snake_case', () => {
    expect(aSnakeCase('fechaNacimiento')).toBe('fecha_nacimiento');
    expect(aSnakeCase('URLBase')).toBe('url_base');
  });

  it('nombra tablas, columnas y relaciones', () => {
    expect(estrategia.tableName('SolicitudAdopcion', undefined)).toBe('solicitud_adopcion');
    expect(estrategia.columnName('fechaNacimiento', undefined, [])).toBe('fecha_nacimiento');
    expect(estrategia.columnName('fechaNacimiento', 'custom', [])).toBe('custom');
    expect(estrategia.joinColumnName('fundacionActual', 'id')).toBe('fundacion_actual_id');
  });
});

describe('crearOpcionesTypeOrm', () => {
  it('desactiva la sincronización y usa la naming strategy', () => {
    const opciones = crearOpcionesTypeOrm({
      DATABASE_HOST: 'h',
      DATABASE_PORT: 5432,
      DATABASE_USER: 'u',
      DATABASE_PASSWORD: 'p',
      DATABASE_NAME: 'd',
    });
    expect(opciones.synchronize).toBe(false);
    expect(opciones.namingStrategy).toBeInstanceOf(SnakeNamingStrategy);
  });
});
