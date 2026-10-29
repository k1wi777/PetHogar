import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

export const ID_MAXIMO = 2_147_483_647;

/**
 * Identificador numérico de ruta: entero positivo que cabe en un `integer` de Postgres. Sin el
 * tope, un id enorme llegaría a la consulta y provocaría un error 500 de la base de datos.
 */
@Injectable()
export class IdEnteroPipe implements PipeTransform<string, number> {
  transform(valor: string): number {
    if (!/^\d{1,10}$/.test(valor)) throw new BadRequestException('El identificador no es válido');
    const id = Number(valor);
    if (id < 1 || id > ID_MAXIMO) throw new BadRequestException('El identificador no es válido');
    return id;
  }
}
