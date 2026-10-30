import type { ClienteHttp } from '@/shared/api/cliente';
import { http } from '@/shared/api/http';
import type { DatosAdoptante } from '../schemas/adoptante';
import type { DatosFundacion } from '../schemas/fundacion';

export interface RespuestaMensaje {
  mensaje: string;
}

/** Quita los opcionales vacíos: el backend espera que no vengan en lugar de llegar como texto vacío. */
function sinVacios<T extends object>(datos: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(datos).filter(([, valor]) => valor !== '' && valor !== undefined),
  ) as Partial<T>;
}

export function registrarAdoptante(
  datos: DatosAdoptante,
  cliente: ClienteHttp = http,
): Promise<RespuestaMensaje> {
  return cliente.post<RespuestaMensaje>('/auth/register/adoptante', {
    cuerpo: sinVacios(datos),
    autenticada: false,
  });
}

/** Multipart: los campos de texto y el archivo en `documento`; el navegador fija el `Content-Type`. */
export function registrarFundacion(
  datos: DatosFundacion,
  cliente: ClienteHttp = http,
): Promise<RespuestaMensaje & { estadoValidacion?: string }> {
  const { documento, ...texto } = datos;
  const formulario = new FormData();
  for (const [clave, valor] of Object.entries(sinVacios(texto))) {
    formulario.append(clave, String(valor));
  }
  formulario.append('documento', documento);
  return cliente.post('/auth/register/fundacion', { cuerpo: formulario, autenticada: false });
}

export function verificarCorreo(
  token: string,
  cliente: ClienteHttp = http,
): Promise<RespuestaMensaje> {
  return cliente.get<RespuestaMensaje>('/auth/verify-email', {
    consulta: { token },
    autenticada: false,
  });
}

export function reenviarVerificacion(
  email: string,
  cliente: ClienteHttp = http,
): Promise<RespuestaMensaje> {
  return cliente.post<RespuestaMensaje>('/auth/verify-email/resend', {
    cuerpo: { email },
    autenticada: false,
  });
}

export function solicitarCodigo(
  email: string,
  cliente: ClienteHttp = http,
): Promise<RespuestaMensaje> {
  return cliente.post<RespuestaMensaje>('/auth/forgot-password', {
    cuerpo: { email },
    autenticada: false,
  });
}

export function restablecerContrasena(
  datos: { email: string; codigo: string; nuevaContrasena: string },
  cliente: ClienteHttp = http,
): Promise<RespuestaMensaje> {
  return cliente.post<RespuestaMensaje>('/auth/reset-password', {
    cuerpo: datos,
    autenticada: false,
  });
}
