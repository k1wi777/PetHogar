import { ErrorApi, MENSAJES, type ErrorCampo } from './errores';
import { crearAlmacenToken, type AlmacenToken } from './token';
import type { RespuestaSesion } from './tipos';

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OpcionesSolicitud {
  cuerpo?: unknown;
  consulta?: Record<string, string | number | boolean | null | undefined>;
  /** Envía el access token (por defecto sí). */
  autenticada?: boolean;
  senal?: AbortSignal;
}

/** Subconjunto de `navigator.locks` que usamos. */
export interface Cerrojos {
  request<T>(nombre: string, callback: () => Promise<T>): Promise<T>;
}

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export interface ConfigClienteHttp {
  baseUrl: string;
  fetchImpl?: FetchImpl;
  tokens?: AlmacenToken;
  /** Exclusión entre pestañas; por defecto `navigator.locks` si existe. */
  cerrojos?: Cerrojos | null;
  tiempoEsperaMs?: number;
}

export const NOMBRE_CERROJO_REFRESH = 'pethogar-refresh';
const RUTAS_SIN_RENOVACION = ['/auth/login', '/auth/refresh'];

function cerrojosDelNavegador(): Cerrojos | null {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks as unknown as Cerrojos;
  }
  return null;
}

function mensajeDeCuerpo(cuerpo: unknown, estado: number): string {
  if (cuerpo && typeof cuerpo === 'object' && 'message' in cuerpo) {
    const m = (cuerpo as { message: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m;
    if (Array.isArray(m) && m.length > 0) return m.filter((x) => typeof x === 'string').join(' ');
  }
  return estado >= 500 ? MENSAJES.servidor : MENSAJES.generico;
}

function erroresDeCuerpo(cuerpo: unknown): ErrorCampo[] | undefined {
  if (cuerpo && typeof cuerpo === 'object' && 'errores' in cuerpo) {
    const e = (cuerpo as { errores: unknown }).errores;
    if (Array.isArray(e)) return e as ErrorCampo[];
  }
  return undefined;
}

export class ClienteHttp {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchImpl;
  readonly tokens: AlmacenToken;
  private readonly cerrojos: Cerrojos | null;
  private readonly tiempoEsperaMs: number;
  private renovacionEnCurso: Promise<RespuestaSesion> | undefined;
  private readonly oyentesSesionVencida = new Set<() => void>();

  constructor(config: ConfigClienteHttp) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = config.fetchImpl ?? ((url, init) => globalThis.fetch(url, init));
    this.tokens = config.tokens ?? crearAlmacenToken();
    this.cerrojos = config.cerrojos === undefined ? cerrojosDelNavegador() : config.cerrojos;
    this.tiempoEsperaMs = config.tiempoEsperaMs ?? 15_000;
  }

  /** Se invoca una sola vez por renovación rechazada (401). Devuelve la función para quitarlo. */
  alVencerSesion(oyente: () => void): () => void {
    this.oyentesSesionVencida.add(oyente);
    return () => this.oyentesSesionVencida.delete(oyente);
  }

  async solicitar<T>(
    metodo: MetodoHttp,
    ruta: string,
    opciones: OpcionesSolicitud = {},
  ): Promise<T> {
    const autenticada = opciones.autenticada ?? true;
    const puedeRenovar = autenticada && !RUTAS_SIN_RENOVACION.includes(ruta);
    const tokenUsado = this.tokens.obtener();
    try {
      return await this.enviar<T>(metodo, ruta, opciones, autenticada);
    } catch (error) {
      if (!(error instanceof ErrorApi) || error.estado !== 401 || !puedeRenovar) throw error;
      // Si otra petición ya renovó mientras esta volaba, basta con reintentar con el token nuevo.
      if (this.tokens.obtener() === tokenUsado) await this.renovar();
      try {
        return await this.enviar<T>(metodo, ruta, opciones, autenticada);
      } catch (segundo) {
        if (segundo instanceof ErrorApi && segundo.estado === 401) {
          throw new ErrorApi({
            tipo: 'sesion-vencida',
            estado: 401,
            mensaje: MENSAJES.sesionVencida,
          });
        }
        throw segundo;
      }
    }
  }

  get<T>(ruta: string, opciones?: OpcionesSolicitud) {
    return this.solicitar<T>('GET', ruta, opciones);
  }
  post<T>(ruta: string, opciones?: OpcionesSolicitud) {
    return this.solicitar<T>('POST', ruta, opciones);
  }
  patch<T>(ruta: string, opciones?: OpcionesSolicitud) {
    return this.solicitar<T>('PATCH', ruta, opciones);
  }
  delete<T>(ruta: string, opciones?: OpcionesSolicitud) {
    return this.solicitar<T>('DELETE', ruta, opciones);
  }

  /**
   * Renueva el access token con la cookie de refresh. REGLA CRÍTICA: nunca hay dos renovaciones
   * a la vez (una `Promise` compartida en esta pestaña y un cerrojo entre pestañas), porque el
   * servidor interpreta un refresh concurrente con el mismo token como reutilización y revoca
   * todas las sesiones del usuario.
   */
  renovar(): Promise<RespuestaSesion> {
    if (this.renovacionEnCurso) return this.renovacionEnCurso;
    const promesa = (async () => {
      try {
        const ejecutar = () => this.llamarRefresh();
        return await (this.cerrojos
          ? this.cerrojos.request(NOMBRE_CERROJO_REFRESH, ejecutar)
          : ejecutar());
      } finally {
        this.renovacionEnCurso = undefined;
      }
    })();
    this.renovacionEnCurso = promesa;
    return promesa;
  }

  private async llamarRefresh(): Promise<RespuestaSesion> {
    try {
      const sesion = await this.enviar<RespuestaSesion>('POST', '/auth/refresh', {}, false);
      this.tokens.guardar(sesion.accessToken);
      return sesion;
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 401) {
        this.tokens.limpiar();
        for (const oyente of this.oyentesSesionVencida) oyente();
        throw new ErrorApi({
          tipo: 'sesion-vencida',
          estado: 401,
          mensaje: MENSAJES.sesionVencida,
        });
      }
      throw error;
    }
  }

  private construirUrl(ruta: string, consulta: OpcionesSolicitud['consulta']): string {
    const url = `${this.baseUrl}${ruta}`;
    if (!consulta) return url;
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(consulta)) {
      if (valor !== undefined && valor !== null && valor !== '') params.set(clave, String(valor));
    }
    const texto = params.toString();
    return texto ? `${url}?${texto}` : url;
  }

  private async enviar<T>(
    metodo: MetodoHttp,
    ruta: string,
    opciones: OpcionesSolicitud,
    autenticada: boolean,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = this.tokens.obtener();
    if (autenticada && token) headers.Authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    const { cuerpo } = opciones;
    if (cuerpo instanceof FormData) {
      body = cuerpo;
    } else if (cuerpo !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(cuerpo);
    }

    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), this.tiempoEsperaMs);
    opciones.senal?.addEventListener('abort', () => control.abort(), { once: true });

    let respuesta: Response;
    try {
      respuesta = await this.fetchImpl(this.construirUrl(ruta, opciones.consulta), {
        method: metodo,
        headers,
        body,
        // Solo /auth/* usa la cookie de refresh (Path=/api/auth).
        credentials: ruta.startsWith('/auth/') ? 'include' : 'same-origin',
        signal: control.signal,
      });
    } catch {
      throw new ErrorApi({ tipo: 'red', mensaje: MENSAJES.red });
    } finally {
      clearTimeout(temporizador);
    }

    if (!respuesta.ok) {
      let cuerpoError: unknown;
      try {
        cuerpoError = await respuesta.json();
      } catch {
        cuerpoError = undefined;
      }
      throw new ErrorApi({
        tipo: 'http',
        estado: respuesta.status,
        mensaje: mensajeDeCuerpo(cuerpoError, respuesta.status),
        errores: erroresDeCuerpo(cuerpoError),
      });
    }
    if (respuesta.status === 204) return undefined as T;
    try {
      return (await respuesta.json()) as T;
    } catch {
      throw new ErrorApi({
        tipo: 'respuesta-invalida',
        estado: respuesta.status,
        mensaje: MENSAJES.respuestaInvalida,
      });
    }
  }
}

export function crearClienteHttp(config: ConfigClienteHttp): ClienteHttp {
  return new ClienteHttp(config);
}
