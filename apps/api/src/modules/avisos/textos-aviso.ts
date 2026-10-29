import { ZONA_HORARIA } from '../../common/validation/fecha';
import { LIMITE_MENSAJE, LIMITE_TITULO } from '../notificaciones/notificaciones.constants';
import { recortar } from '../notificaciones/notificaciones.mapeo';
import type {
  ReferenciaNotificacion,
  TipoNotificacion,
} from '../notificaciones/notificaciones.types';

/**
 * Textos de los avisos como funciones puras, sin acceso a datos: cada una recibe SOLO los campos
 * que pueden aparecer en el aviso, de modo que un dato privado (bienestar y observaciones del
 * seguimiento, correo, teléfono, nombre del adoptante o del donante) no puede filtrarse por
 * descuido. Son texto plano (el front no debe interpretarlo como HTML; el correo lo escapa).
 */
export interface Aviso {
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  referencia: ReferenciaNotificacion;
  /** Clave de deduplicación por destinatario: `<evento>:<id>`. */
  clave: string;
}

type TipoSeguimiento = 'visita' | 'reporte';

const aviso = (
  tipo: TipoNotificacion,
  titulo: string,
  mensaje: string,
  referencia: ReferenciaNotificacion,
  clave: string,
): Aviso => ({
  tipo,
  titulo: recortar(titulo, LIMITE_TITULO),
  mensaje: recortar(mensaje, LIMITE_MENSAJE),
  referencia,
  clave,
});

const formateadorFecha = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HORARIA,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** `YYYY-MM-DD` → «5 de noviembre de 2026» (mediodía de Bogotá: sin corrimiento de día). */
export function fechaLarga(dia: string): string {
  return formateadorFecha.format(new Date(`${dia}T12:00:00-05:00`));
}

export function fechaLargaDeInstante(instante: Date): string {
  return formateadorFecha.format(instante);
}

/** `"50000.50"` → «$ 50.000,50 COP»; sin pasar por `Number` (el monto es una cadena exacta). */
export function formatearMonto(monto: string): string {
  const [enteros, decimales = '00'] = monto.split('.');
  const miles = enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${miles}${decimales === '00' ? '' : `,${decimales}`} COP`;
}

const articuloSeguimiento = (tipo: TipoSeguimiento): string =>
  tipo === 'visita' ? 'una visita' : 'un reporte';
const nombreSeguimiento = (tipo: TipoSeguimiento): string =>
  tipo === 'visita' ? 'visita' : 'reporte';

function cuando(dias: number): string {
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'mañana';
  return `en ${dias} días`;
}

// ---- Fundaciones -------------------------------------------------------------------------

export function fundacionRegistrada(d: { fundacionId: number; nombre: string }): Aviso {
  return aviso(
    'validacion',
    'Nueva fundación por validar',
    `Nueva fundación por validar: ${d.nombre}.`,
    { tipo: 'fundacion', id: d.fundacionId },
    `foundation.registered:${d.fundacionId}`,
  );
}

/** La observación es la que el destinatario ya ve en su propia vista de validación. */
export function fundacionValidada(d: {
  fundacionId: number;
  decision: 'aprobada' | 'rechazada';
  observacion: string | null;
}): Aviso {
  const referencia = { tipo: 'fundacion', id: d.fundacionId } as const;
  const clave = `foundation.validated:${d.fundacionId}:${d.decision}`;
  if (d.decision === 'aprobada') {
    return aviso(
      'validacion',
      'Tu fundación fue aprobada',
      'Ya puedes publicar mascotas y recibir solicitudes de adopción.',
      referencia,
      clave,
    );
  }
  return aviso(
    'validacion',
    'Tu fundación fue rechazada',
    d.observacion
      ? `Observación del administrador: ${d.observacion}`
      : 'El administrador rechazó el registro de tu fundación.',
    referencia,
    clave,
  );
}

// ---- Solicitudes y adopciones --------------------------------------------------------------

/** Sin el nombre del adoptante: la fundación lo ve en la solicitud. */
export function solicitudRecibida(d: { solicitudId: number; mascota: string }): Aviso {
  return aviso(
    'solicitud',
    'Nueva solicitud de adopción',
    `Nueva solicitud para ${d.mascota}.`,
    { tipo: 'solicitud', id: d.solicitudId },
    `adoption-request.created:${d.solicitudId}`,
  );
}

export function solicitudAprobada(d: { solicitudId: number; mascota: string }): Aviso {
  return aviso(
    'solicitud',
    'Tu solicitud fue aprobada',
    `Tu solicitud para ${d.mascota} fue aprobada. Consulta «Mis adopciones» para ver los detalles.`,
    { tipo: 'solicitud', id: d.solicitudId },
    `adoption.approved:${d.solicitudId}`,
  );
}

/** Solo la recibe el adoptante autor: la observación es privada entre fundación y solicitante. */
export function solicitudRechazada(d: {
  solicitudId: number;
  mascota: string;
  observacion: string | null;
  automatica: boolean;
}): Aviso {
  const referencia = { tipo: 'solicitud', id: d.solicitudId } as const;
  const clave = `adoption.rejected:${d.solicitudId}`;
  if (d.automatica) {
    return aviso(
      'solicitud',
      'Tu solicitud no fue aceptada',
      `La mascota ${d.mascota} ya fue adoptada: la fundación aprobó otra solicitud.`,
      referencia,
      clave,
    );
  }
  const observacion = d.observacion ? ` Observación de la fundación: ${d.observacion}` : '';
  return aviso(
    'solicitud',
    'Tu solicitud fue rechazada',
    `Tu solicitud para ${d.mascota} fue rechazada.${observacion}`,
    referencia,
    clave,
  );
}

/** Sin el motivo del cierre: el adoptante lo consulta en «Mis adopciones». */
export function adopcionCerrada(d: {
  adopcionId: number;
  estado: 'finalizada' | 'revocada';
  mascota: string;
}): Aviso {
  const finalizada = d.estado === 'finalizada';
  return aviso(
    'adopcion',
    finalizada ? 'Tu adopción fue finalizada' : 'Tu adopción fue revocada',
    finalizada
      ? `La fundación finalizó la adopción de ${d.mascota}. Ya no tendrás seguimientos pendientes.`
      : `La fundación revocó la adopción de ${d.mascota} y se cancelaron sus seguimientos pendientes. Consulta «Mis adopciones» para ver el motivo.`,
    { tipo: 'adopcion', id: d.adopcionId },
    `adoption.closed:${d.adopcionId}`,
  );
}

// ---- Seguimientos --------------------------------------------------------------------------

export function seguimientoProgramado(d: {
  seguimientoId: number;
  fundacion: string;
  tipo: TipoSeguimiento;
  mascota: string;
  fecha: string;
}): Aviso {
  return aviso(
    'seguimiento',
    'Seguimiento programado',
    `${d.fundacion} programó ${articuloSeguimiento(d.tipo)} para ${d.mascota} el ${fechaLarga(d.fecha)}.`,
    { tipo: 'seguimiento', id: d.seguimientoId },
    `follow-up.scheduled:${d.seguimientoId}`,
  );
}

export function seguimientoPorVencer(d: {
  seguimientoId: number;
  tipo: TipoSeguimiento;
  mascota: string;
  fecha: string;
  diasRestantes: number;
}): Aviso {
  return aviso(
    'seguimiento',
    'Tu seguimiento está por vencer',
    `El seguimiento (${nombreSeguimiento(d.tipo)}) de ${d.mascota} vence ${cuando(d.diasRestantes)}, el ${fechaLarga(d.fecha)}.`,
    { tipo: 'seguimiento', id: d.seguimientoId },
    `follow-up.reminder:${d.seguimientoId}`,
  );
}

export function seguimientoVencidoAdoptante(d: { seguimientoId: number; mascota: string }): Aviso {
  return aviso(
    'seguimiento',
    'Seguimiento vencido',
    `El seguimiento de ${d.mascota} está vencido. Envía tu reporte o contacta a la fundación.`,
    { tipo: 'seguimiento', id: d.seguimientoId },
    `follow-up.overdue:${d.seguimientoId}`,
  );
}

export function seguimientoVencidoFundacion(d: { seguimientoId: number; mascota: string }): Aviso {
  return aviso(
    'seguimiento',
    'Seguimiento vencido',
    `Seguimiento vencido de ${d.mascota}.`,
    { tipo: 'seguimiento', id: d.seguimientoId },
    `follow-up.overdue:${d.seguimientoId}`,
  );
}

export function reporteRecibido(d: { seguimientoId: number; mascota: string }): Aviso {
  return aviso(
    'seguimiento',
    'Reporte de seguimiento recibido',
    `El adoptante de ${d.mascota} envió su reporte de seguimiento.`,
    { tipo: 'seguimiento', id: d.seguimientoId },
    `follow-up.report-received:${d.seguimientoId}`,
  );
}

/** Sin la valoración ni las observaciones: solo avisa de que hay que revisar el seguimiento. */
export function alertaBienestarFundacion(d: { seguimientoId: number; mascota: string }): Aviso {
  return aviso(
    'seguimiento',
    'Alerta de bienestar',
    `Alerta de bienestar en el seguimiento de ${d.mascota}.`,
    { tipo: 'seguimiento', id: d.seguimientoId },
    `wellbeing-alert.raised:${d.seguimientoId}`,
  );
}

/** El administrador solo accede al detalle de la fundación: la referencia apunta a ella. */
export function alertaBienestarAdministrador(d: {
  seguimientoId: number;
  fundacionId: number;
  fundacion: string;
  mascota: string;
}): Aviso {
  return aviso(
    'seguimiento',
    'Alerta de bienestar',
    `Alerta de bienestar en el seguimiento de ${d.mascota} (fundación ${d.fundacion}).`,
    { tipo: 'fundacion', id: d.fundacionId },
    `wellbeing-alert.raised:${d.seguimientoId}`,
  );
}

// ---- Donaciones ----------------------------------------------------------------------------

/** Sin el nombre del donante ni su contacto: la fundación lo ve en su listado de donaciones. */
export function donacionRecibida(d: {
  donacionId: number;
  tipo: 'economica' | 'especie';
  monto: string | null;
}): Aviso {
  const detalle =
    d.tipo === 'economica' && d.monto ? `económica de ${formatearMonto(d.monto)}` : 'en especie';
  return aviso(
    'donacion',
    'Recibiste una donación',
    `Recibiste una donación ${detalle}.`,
    { tipo: 'donacion', id: d.donacionId },
    `donation.registered:${d.donacionId}`,
  );
}

/**
 * Aviso al propio donante: su clave también deduplica la confirmación por correo (el correo solo
 * sale si esta notificación es nueva).
 */
export function donacionRegistrada(d: {
  donacionId: number;
  fundacion: string;
  tipo: 'economica' | 'especie';
  monto: string | null;
}): Aviso {
  const detalle =
    d.tipo === 'economica' && d.monto ? `económica de ${formatearMonto(d.monto)}` : 'en especie';
  return aviso(
    'donacion',
    'Donación registrada',
    `Registramos tu donación ${detalle} a ${d.fundacion}. ¡Gracias por ayudar!`,
    { tipo: 'donacion', id: d.donacionId },
    `donation.registered:${d.donacionId}`,
  );
}

/** Detalle del correo de confirmación al propio donante. */
export function detalleDonacion(d: {
  tipo: 'economica' | 'especie';
  monto: string | null;
  descripcionEspecie: string | null;
}): string {
  if (d.tipo === 'economica' && d.monto) return `Donación económica de ${formatearMonto(d.monto)}`;
  return `Donación en especie${d.descripcionEspecie ? `: ${d.descripcionEspecie}` : ''}`;
}
