import { describe, expect, it } from 'vitest';
import { mascota } from '../prueba-datos';
import {
  EDAD_MAXIMA_MESES,
  MENSAJE_EDAD_MAXIMA,
  MENSAJE_EDAD_OBLIGATORIA,
  aDatosMascota,
  aMeses,
  cambiosMascota,
  desdeMeses,
  edadEnMeses,
  esquemaMascota,
  problemaDeEdad,
  valoresDesdeMascota,
  type ValoresMascota,
} from './mascota';

const validos: ValoresMascota = {
  nombre: ' Firulais ',
  especieId: '1',
  razaId: '11',
  sexo: 'macho',
  anios: '2',
  meses: '6',
  tamano: 'mediano',
  estadoSalud: 'Sano',
  color: '',
  descripcion: '',
  esterilizado: false,
  vacunado: true,
};

const mensajes = (valores: Partial<ValoresMascota>) => {
  const r = esquemaMascota.safeParse({ ...validos, ...valores });
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('conversión de edad', () => {
  it('convierte años y meses a meses y de vuelta', () => {
    expect(aMeses(2, 6)).toBe(30);
    expect(aMeses(0, 5)).toBe(5);
    expect(aMeses(30, 0)).toBe(EDAD_MAXIMA_MESES);
    expect(desdeMeses(30)).toEqual({ anios: 2, meses: 6 });
    expect(desdeMeses(11)).toEqual({ anios: 0, meses: 11 });
    expect(desdeMeses(360)).toEqual({ anios: 30, meses: 0 });
    for (const n of [0, 1, 11, 12, 13, 359, 360]) {
      const { anios, meses } = desdeMeses(n);
      expect(aMeses(anios, meses)).toBe(n);
    }
  });

  it('un campo vacío cuenta como 0 siempre que el otro tenga valor', () => {
    expect(edadEnMeses('2', '')).toBe(24);
    expect(edadEnMeses('', '7')).toBe(7);
    expect(problemaDeEdad('2', '')).toBeNull();
    expect(problemaDeEdad('', '7')).toBeNull();
  });

  it('valida los límites 0 a 360 meses y 0 a 11 meses sueltos', () => {
    expect(problemaDeEdad('', '')).toEqual({ campo: 'anios', mensaje: MENSAJE_EDAD_OBLIGATORIA });
    expect(problemaDeEdad('30', '0')).toBeNull();
    expect(problemaDeEdad('30', '1')).toEqual({ campo: 'anios', mensaje: MENSAJE_EDAD_MAXIMA });
    expect(problemaDeEdad('31', '0')?.mensaje).toBe(MENSAJE_EDAD_MAXIMA);
    expect(problemaDeEdad('0', '12')).toEqual({
      campo: 'meses',
      mensaje: 'Los meses deben estar entre 0 y 11',
    });
    expect(problemaDeEdad('-1', '0')?.campo).toBe('anios');
    expect(problemaDeEdad('1.5', '0')?.campo).toBe('anios');
    expect(problemaDeEdad('1', 'a')?.campo).toBe('meses');
  });
});

describe('esquemaMascota', () => {
  it('acepta datos válidos y sus límites exactos', () => {
    expect(mensajes({})).toEqual([]);
    expect(mensajes({ nombre: 'a'.repeat(60), estadoSalud: 'b'.repeat(200) })).toEqual([]);
    expect(mensajes({ color: 'c'.repeat(40), descripcion: 'd'.repeat(500) })).toEqual([]);
  });

  it('rechaza lo que el backend rechaza, con sus mismos textos', () => {
    expect(mensajes({ nombre: '   ' })).toContain('nombre: El nombre es obligatorio');
    expect(mensajes({ nombre: 'a'.repeat(61) })).toContain(
      'nombre: El nombre no puede superar 60 caracteres',
    );
    expect(mensajes({ estadoSalud: '' })).toContain(
      'estadoSalud: El estado de salud es obligatorio',
    );
    expect(mensajes({ estadoSalud: 'b'.repeat(201) })[0]).toContain('200');
    expect(mensajes({ color: 'c'.repeat(41) })[0]).toContain('40');
    expect(mensajes({ descripcion: 'd'.repeat(501) })[0]).toContain('500');
    expect(mensajes({ razaId: '' })).toContain('razaId: Elige la raza');
    expect(mensajes({ especieId: '' })).toContain('especieId: Elige la especie');
    expect(mensajes({ sexo: '' })[0]).toContain('sexo:');
    expect(mensajes({ tamano: 'enorme' as never })[0]).toContain('tamano:');
  });

  it('el error de edad se marca en el campo que corresponde', () => {
    expect(mensajes({ anios: '30', meses: '5' })).toEqual([`anios: ${MENSAJE_EDAD_MAXIMA}`]);
    expect(mensajes({ anios: '1', meses: '12' })[0]).toMatch(/^meses:/);
  });
});

describe('aDatosMascota y cambiosMascota', () => {
  it('construye el cuerpo con la edad en meses y omite los textos opcionales vacíos', () => {
    expect(aDatosMascota(validos)).toEqual({
      nombre: 'Firulais',
      razaId: 11,
      sexo: 'macho',
      edadMeses: 30,
      tamano: 'mediano',
      estadoSalud: 'Sano',
      esterilizado: false,
      vacunado: true,
    });
    expect(aDatosMascota({ ...validos, color: ' Café ', descripcion: 'Hola' })).toMatchObject({
      color: 'Café',
      descripcion: 'Hola',
    });
  });

  it('la edición envía solo lo modificado y un texto vaciado como null', () => {
    const original = mascota();
    const base = valoresDesdeMascota(original, 1);
    expect(base).toMatchObject({ anios: '2', meses: '6', especieId: '1', razaId: '11' });
    expect(cambiosMascota(base, original)).toEqual({});
    expect(cambiosMascota({ ...base, tamano: 'grande', anios: '3' }, original)).toEqual({
      tamano: 'grande',
      edadMeses: 42,
    });
    expect(cambiosMascota({ ...base, color: '', descripcion: '' }, original)).toEqual({
      color: null,
      descripcion: null,
    });
    expect(cambiosMascota({ ...base, razaId: '12', vacunado: true }, original)).toEqual({
      razaId: 12,
      vacunado: true,
    });
  });
});

describe('el error de la edad aparece junto con los demás', () => {
  it('con un formulario vacío se informan todos los campos obligatorios a la vez', () => {
    const r = esquemaMascota.safeParse({
      nombre: '',
      especieId: '',
      razaId: '',
      sexo: '',
      anios: '',
      meses: '',
      tamano: '',
      estadoSalud: '',
      color: '',
      descripcion: '',
      esterilizado: false,
      vacunado: false,
    });
    const campos = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    expect(campos).toEqual(
      expect.arrayContaining([
        'nombre',
        'especieId',
        'razaId',
        'sexo',
        'anios',
        'tamano',
        'estadoSalud',
      ]),
    );
  });
});
