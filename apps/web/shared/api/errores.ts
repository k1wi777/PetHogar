export type TipoErrorApi = 'http' | 'red' | 'sesion-vencida' | 'respuesta-invalida';

export interface ErrorCampo {
  campo: string;
  /** El filtro global de la API entrega uno o varios mensajes por campo. */
  mensajes: string[];
}

/** Textos para el usuario, en un único lugar (R6, R7). */
export const MENSAJES = {
  red: 'No pudimos conectar con el servidor. Revisa tu conexión o inténtalo en unos minutos.',
  servidor: 'Algo salió mal de nuestro lado. Inténtalo de nuevo.',
  generico: 'No pudimos completar la acción. Inténtalo de nuevo.',
  sesionVencida: 'Tu sesión venció. Ingresa de nuevo para continuar.',
  respuestaInvalida: 'Recibimos una respuesta inesperada del servidor. Inténtalo de nuevo.',
} as const;

/** Error uniforme del cliente HTTP. */
export class ErrorApi extends Error {
  readonly tipo: TipoErrorApi;
  readonly estado: number;
  readonly mensaje: string;
  readonly errores?: ErrorCampo[];

  constructor(init: {
    tipo: TipoErrorApi;
    estado?: number;
    mensaje: string;
    errores?: ErrorCampo[];
  }) {
    super(init.mensaje);
    this.name = 'ErrorApi';
    this.tipo = init.tipo;
    this.estado = init.estado ?? 0;
    this.mensaje = init.mensaje;
    this.errores = init.errores;
  }

  get esRed(): boolean {
    return this.tipo === 'red';
  }

  get esSesionVencida(): boolean {
    return this.tipo === 'sesion-vencida';
  }
}

export function esErrorApi(valor: unknown): valor is ErrorApi {
  return valor instanceof ErrorApi;
}

/** Mensaje presentable de cualquier error capturado. */
export function mensajeDe(error: unknown): string {
  return esErrorApi(error) ? error.mensaje : MENSAJES.generico;
}
