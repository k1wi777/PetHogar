import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsString, MinLength, ValidateNested } from 'class-validator';
import { crearValidationPipe } from './validation.pipe';

class DireccionPruebaDto {
  @IsString({ message: 'La ciudad debe ser un texto' })
  ciudad!: string;
}

class PruebaDto {
  @IsString({ message: 'El nombre debe ser un texto' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  nombre!: string;

  @IsInt({ message: 'La edad debe ser un número entero' })
  edad!: number;

  @ValidateNested()
  @Type(() => DireccionPruebaDto)
  direccion!: DireccionPruebaDto;
}

const metadata = { type: 'body' as const, metatype: PruebaDto };

describe('crearValidationPipe', () => {
  const pipe = crearValidationPipe();

  it('agrupa los errores por campo, incluidos los anidados', async () => {
    const error = await pipe
      .transform({ nombre: 'ab', edad: 'x', direccion: {} }, metadata)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    const respuesta = (error as BadRequestException).getResponse() as {
      errores: { campo: string; mensajes: string[] }[];
    };
    expect(respuesta.errores).toEqual(
      expect.arrayContaining([
        { campo: 'nombre', mensajes: ['El nombre debe tener al menos 3 caracteres'] },
        { campo: 'edad', mensajes: ['La edad debe ser un número entero'] },
        { campo: 'direccion.ciudad', mensajes: ['La ciudad debe ser un texto'] },
      ]),
    );
  });

  it('descarta las propiedades no declaradas', async () => {
    const resultado = await pipe.transform(
      { nombre: 'Firulais', edad: 3, direccion: { ciudad: 'Lima' }, extra: 'x' },
      metadata,
    );
    expect(resultado).not.toHaveProperty('extra');
    expect(resultado).toMatchObject({ nombre: 'Firulais', edad: 3 });
  });
});
