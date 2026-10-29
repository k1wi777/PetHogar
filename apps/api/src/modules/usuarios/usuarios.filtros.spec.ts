import {
  construirFiltroUsuarios,
  escaparLike,
  patronContiene,
  SQL_NOMBRE_USUARIO,
} from './usuarios.filtros';

describe('escaparLike', () => {
  it.each([
    ['100%', '100\\%'],
    ['a_b', 'a\\_b'],
    ['a\\b', 'a\\\\b'],
    ['%_\\', '\\%\\_\\\\'],
    ['sin especiales', 'sin especiales'],
    ["o'brien", "o'brien"],
  ])('%s → %s', (entrada, esperado) => {
    expect(escaparLike(entrada)).toBe(esperado);
  });

  it('el patrón «contiene» envuelve el texto ya escapado', () => {
    expect(patronContiene('a%b')).toBe('%a\\%b%');
  });
});

describe('construirFiltroUsuarios', () => {
  it('sin filtros (o vacíos) no añade condiciones', () => {
    expect(construirFiltroUsuarios({})).toEqual({ condiciones: [], parametros: {} });
    expect(construirFiltroUsuarios({ nombre: '  ', correo: '' })).toEqual({
      condiciones: [],
      parametros: {},
    });
  });

  it('combina nombre, correo y rol; el texto va solo en parámetros, escapado, con ESCAPE', () => {
    const f = construirFiltroUsuarios({ nombre: 'Ana_%', correo: ' x\\y ', rol: 'fundacion' });
    expect(f.condiciones).toHaveLength(3);
    expect(f.parametros).toEqual({ nombre: '%Ana\\_\\%%', correo: '%x\\\\y%', rol: 'fundacion' });
    const sql = f.condiciones.join(' AND ');
    expect(sql).not.toContain('Ana');
    expect(sql).not.toContain('x\\\\y');
    expect(sql.match(/ESCAPE '\\'/g)).toHaveLength(3);
    expect(sql).toContain('f."nombre" ILIKE :nombre');
    expect(sql).toContain('u."email" ILIKE :correo');
  });

  it('una inyección en el texto no llega al SQL', () => {
    const f = construirFiltroUsuarios({ correo: "'; DROP TABLE usuario; --" });
    expect(f.condiciones.join()).not.toContain('DROP');
    expect(f.parametros.correo).toContain('DROP');
  });

  it('el nombre visible une los cuatro campos del adoptante o el de la fundación', () => {
    expect(SQL_NOMBRE_USUARIO).toContain('primer_nombre');
    expect(SQL_NOMBRE_USUARIO).toContain('segundo_apellido');
    expect(SQL_NOMBRE_USUARIO).toContain('f."nombre"');
  });
});
