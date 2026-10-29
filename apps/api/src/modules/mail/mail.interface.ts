export const MAIL_SERVICE = Symbol('MAIL_SERVICE');

/** Plantillas disponibles y el tipo de sus datos; añadir una = una entrada aquí y en `plantillas/`. */
export interface DatosPlantilla {
  prueba: { nombre: string };
  notificacion: { nombre: string; titulo: string; mensaje: string; enlace?: string };
  'verificacion-correo': { nombre: string; enlace: string; horasVigencia: number };
  'recuperacion-contrasena': { nombre: string; codigo: string; minutosVigencia: number };
  'registro-fundacion-recibido': { nombreFundacion: string };
}

export type NombrePlantilla = keyof DatosPlantilla;

export type MensajeCorreo = {
  [P in NombrePlantilla]: { para: string; plantilla: P; datos: DatosPlantilla[P] };
}[NombrePlantilla];

export interface ResultadoEnvio {
  enviado: boolean;
  error?: string;
}

export interface IMailService {
  /** Nunca lanza: ante cualquier fallo lo registra y devuelve `{ enviado: false, error }`. */
  enviar(mensaje: MensajeCorreo): Promise<ResultadoEnvio>;
}
