import type { Usuario } from '@/shared/api/tipos';

/** Aviso al entrar una fundación que aún no está aprobada; la observación es texto, nunca HTML. */
export function avisoDeFundacion(usuario: Usuario): string | null {
  const fundacion = usuario.fundacion;
  if (!fundacion || fundacion.estadoValidacion === 'aprobada') return null;
  if (fundacion.estadoValidacion === 'pendiente') {
    return 'Tu fundación está pendiente de validación. Un administrador la revisará y te avisaremos; mientras tanto puedes entrar a tu panel.';
  }
  const observacion = fundacion.observacionValidacion?.trim();
  return observacion
    ? `Tu fundación fue rechazada. Observación del administrador: ${observacion}`
    : 'Tu fundación fue rechazada. Comunícate con un administrador de PetHogar para más información.';
}
