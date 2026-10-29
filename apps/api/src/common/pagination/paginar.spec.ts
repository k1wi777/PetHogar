import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginacionQueryDto } from './paginacion-query.dto';
import { desplazamiento, paginar } from './paginar';

describe('paginación', () => {
  it('usa valores por defecto', () => {
    const dto = plainToInstance(PaginacionQueryDto, {});
    expect(dto).toMatchObject({ page: 1, limit: 10 });
  });

  it('convierte la query a números y valida los límites', async () => {
    const valido = plainToInstance(PaginacionQueryDto, { page: '2', limit: '20' });
    expect(valido).toMatchObject({ page: 2, limit: 20 });
    expect(await validate(valido)).toHaveLength(0);

    const invalido = plainToInstance(PaginacionQueryDto, { page: '0', limit: '1000' });
    expect(await validate(invalido)).toHaveLength(2);

    const enorme = plainToInstance(PaginacionQueryDto, { page: '99999999999999999999' });
    expect(await validate(enorme)).toHaveLength(1);
  });

  it('construye la respuesta paginada', () => {
    const dto = plainToInstance(PaginacionQueryDto, { page: '3', limit: '5' });
    expect(paginar(['a', 'b'], 12, dto)).toEqual({
      data: ['a', 'b'],
      total: 12,
      page: 3,
      limit: 5,
    });
    expect(desplazamiento(dto)).toEqual({ skip: 10, take: 5 });
  });
});
