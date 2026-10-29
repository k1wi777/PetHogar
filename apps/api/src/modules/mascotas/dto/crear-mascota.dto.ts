import { SexoMascota, TamanoMascota } from '../entities/mascota.enum';
import {
  CampoBooleano,
  CampoColor,
  CampoDescripcion,
  CampoEdadMeses,
  CampoEstadoSalud,
  CampoNombre,
  CampoRazaId,
  CampoSexo,
  CampoTamano,
} from './campos-mascota';

/** Alta de una mascota. No declara `estado` ni `fundacionId`: salen de la base y del guard. */
export class CrearMascotaDto {
  @CampoNombre()
  nombre!: string;

  @CampoRazaId()
  razaId!: number;

  @CampoSexo()
  sexo!: SexoMascota;

  @CampoEdadMeses()
  edadMeses!: number;

  @CampoTamano()
  tamano!: TamanoMascota;

  @CampoEstadoSalud()
  estadoSalud!: string;

  @CampoColor()
  color?: string | null;

  @CampoBooleano('Esterilizado')
  esterilizado?: boolean;

  @CampoBooleano('Vacunado')
  vacunado?: boolean;

  @CampoDescripcion()
  descripcion?: string | null;
}
