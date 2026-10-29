import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { traducirErrorUnico } from './errores-unicos';

const falla = (driverError: object): QueryFailedError =>
  new QueryFailedError('INSERT', [], driverError as never);

describe('traducirErrorUnico', () => {
  it.each([
    ['uq_usuario_email', 'correo'],
    ['uq_adoptante_numero_documento', 'número de documento'],
    ['uq_fundacion_nit', 'NIT'],
  ])('traduce %s a un 409 en español', (constraint, texto) => {
    const r = traducirErrorUnico(falla({ code: '23505', constraint }));
    expect(r).toBeInstanceOf(ConflictException);
    expect((r as ConflictException).message).toContain(texto);
  });

  it('deja intactos los demás errores', () => {
    const otro = falla({ code: '23505', constraint: 'uq_desconocido' });
    expect(traducirErrorUnico(otro)).toBe(otro);
    const generico = new Error('x');
    expect(traducirErrorUnico(generico)).toBe(generico);
    const fk = falla({ code: '23503', constraint: 'uq_usuario_email' });
    expect(traducirErrorUnico(fk)).toBe(fk);
  });
});
