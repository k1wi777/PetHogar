import { ValidateBy } from 'class-validator';
import { esFechaCalendario } from '../../../common/validation/fecha';

/**
 * Fecha `YYYY-MM-DD` que existe en el calendario. Las reglas contra «hoy» o contra la fecha de
 * entrega las valida el service con el `Reloj` (testeable); los ausentes los reporta `@IsNotEmpty`.
 */
export const EsFechaReal = (mensaje: string): PropertyDecorator =>
  ValidateBy({
    name: 'esFechaReal',
    validator: {
      validate: (valor: unknown) =>
        valor === undefined ||
        valor === null ||
        valor === '' ||
        (typeof valor === 'string' && esFechaCalendario(valor)),
      defaultMessage: () => mensaje,
    },
  });
