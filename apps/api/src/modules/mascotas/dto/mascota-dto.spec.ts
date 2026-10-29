import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { crearValidationPipe } from '../../../common/pipes/validation.pipe';
import { CrearMascotaDto } from './crear-mascota.dto';
import { EditarMascotaDto } from './editar-mascota.dto';
import { ConsultaMascotasFundacionDto } from './consulta-mascotas-fundacion.dto';

const pipe = crearValidationPipe();
const validar = <T>(metatype: new () => T, datos: object): Promise<T> =>
  pipe.transform(datos, { type: 'body', metatype }) as Promise<T>;

const VALIDA = {
  nombre: '  Luna ',
  razaId: 2,
  sexo: 'hembra',
  edadMeses: 12,
  tamano: 'pequeño',
  estadoSalud: 'Sana',
};

async function camposInvalidos(metatype: new () => object, datos: object): Promise<string[]> {
  const error = await validar(metatype, datos).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(BadRequestException);
  const { errores } = (error as BadRequestException).getResponse() as {
    errores: { campo: string }[];
  };
  return errores.map((e) => e.campo).sort();
}

describe('CrearMascotaDto', () => {
  it('acepta datos válidos, recorta el texto y descarta estado y fundacionId', async () => {
    const dto = await validar(CrearMascotaDto, {
      ...VALIDA,
      estado: 'adoptada',
      fundacionId: 99,
      color: '  ',
    });
    expect(dto.nombre).toBe('Luna');
    expect(dto.color).toBeNull();
    expect(dto).not.toHaveProperty('estado');
    expect(dto).not.toHaveProperty('fundacionId');
  });

  it('exige los campos obligatorios, con mensajes por campo', async () => {
    expect(await camposInvalidos(CrearMascotaDto, {})).toEqual([
      'edadMeses',
      'estadoSalud',
      'nombre',
      'razaId',
      'sexo',
      'tamano',
    ]);
  });

  it('valida longitudes, enums, edad y tipos estrictos', async () => {
    const invalidos = await camposInvalidos(CrearMascotaDto, {
      nombre: 'x'.repeat(61),
      razaId: true,
      sexo: 'otro',
      edadMeses: -1,
      tamano: 'enorme',
      estadoSalud: 'x'.repeat(201),
      color: 'x'.repeat(41),
      descripcion: 'x'.repeat(501),
      esterilizado: 'quizas',
      vacunado: 1,
    });
    expect(invalidos).toEqual([
      'color',
      'descripcion',
      'edadMeses',
      'estadoSalud',
      'esterilizado',
      'nombre',
      'razaId',
      'sexo',
      'tamano',
      'vacunado',
    ]);
  });

  it('rechaza edad fuera de rango, decimal y razaId mayor que int4', async () => {
    expect(await camposInvalidos(CrearMascotaDto, { ...VALIDA, edadMeses: 361 })).toEqual([
      'edadMeses',
    ]);
    expect(await camposInvalidos(CrearMascotaDto, { ...VALIDA, edadMeses: 1.5 })).toEqual([
      'edadMeses',
    ]);
    expect(await camposInvalidos(CrearMascotaDto, { ...VALIDA, razaId: 2147483648 })).toEqual([
      'razaId',
    ]);
  });
});

describe('EditarMascotaDto', () => {
  it('no declara estado: se descarta aunque se envíe', async () => {
    const dto = await validar(EditarMascotaDto, { nombre: 'Nuevo', estado: 'disponible' });
    expect(dto).toEqual({ nombre: 'Nuevo' });
    expect(Object.keys(dto)).not.toContain('estado');
  });

  it('un campo obligatorio presente se valida (null y vacío se rechazan)', async () => {
    expect(await camposInvalidos(EditarMascotaDto, { nombre: null, edadMeses: -3 })).toEqual([
      'edadMeses',
      'nombre',
    ]);
    expect(await camposInvalidos(EditarMascotaDto, { nombre: '   ' })).toEqual(['nombre']);
  });

  it('permite limpiar color y descripción con null', async () => {
    const dto = await validar(EditarMascotaDto, { color: null, descripcion: '' });
    expect(dto.color).toBeNull();
    expect(dto.descripcion).toBeNull();
  });
});

describe('ConsultaMascotasFundacionDto', () => {
  it('valida el estado del filtro', async () => {
    const consulta = (datos: object) =>
      pipe.transform(datos, { type: 'query', metatype: ConsultaMascotasFundacionDto });
    await expect(consulta({ estado: 'inactiva' })).resolves.toMatchObject({ estado: 'inactiva' });
    await expect(consulta({ estado: 'borrada' })).rejects.toThrow(BadRequestException);
    await expect(consulta({})).resolves.toMatchObject({ page: 1, limit: 10 });
  });
});
