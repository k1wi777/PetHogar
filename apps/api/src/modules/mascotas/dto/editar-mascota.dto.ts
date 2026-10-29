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

/**
 * Edición parcial de los datos descriptivos. No declara `estado`: el `ValidationPipe` con
 * whitelist lo descarta, así que esta ruta nunca cambia el estado de la mascota.
 */
export class EditarMascotaDto {
  @CampoNombre(true)
  nombre?: string;

  @CampoRazaId(true)
  razaId?: number;

  @CampoSexo(true)
  sexo?: SexoMascota;

  @CampoEdadMeses(true)
  edadMeses?: number;

  @CampoTamano(true)
  tamano?: TamanoMascota;

  @CampoEstadoSalud(true)
  estadoSalud?: string;

  @CampoColor()
  color?: string | null;

  @CampoBooleano('Esterilizado')
  esterilizado?: boolean;

  @CampoBooleano('Vacunado')
  vacunado?: boolean;

  @CampoDescripcion()
  descripcion?: string | null;
}
