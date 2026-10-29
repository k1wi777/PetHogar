import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type request from 'supertest';
import {
  FollowUpOverdue,
  FollowUpReminder,
  FollowUpReportReceived,
  FollowUpScheduled,
  WellbeingAlertRaised,
} from '../../src/common/events';
import { Reloj } from '../../src/common/reloj/reloj';
import { SeguimientosTareasService } from '../../src/modules/seguimientos/tareas/seguimientos-tareas.service';
import type { Entorno } from '../auth/helpers';
import {
  type AdoptantePrueba,
  adoptanteConSesion,
  con,
  fechaBogota,
  fundacionAprobada,
  type FundacionPrueba,
  mascotaPublicada,
  PDF,
  violacionesDeClaves,
} from '../adopciones/helpers';

export {
  type AdoptantePrueba,
  adoptanteConSesion,
  con,
  fechaBogota,
  fundacionAprobada,
  type FundacionPrueba,
  mascotaPublicada,
  violacionesDeClaves,
};
export { jpeg, PDF, png, SVG, EJECUTABLE } from '../adopciones/helpers';

export const NOMBRES_EVENTOS = [
  FollowUpScheduled,
  FollowUpReportReceived,
  FollowUpOverdue,
  FollowUpReminder,
  WellbeingAlertRaised,
] as const;

export interface Capturado {
  nombre: string;
  payload: Record<string, unknown>;
  /** Estado del seguimiento visto desde OTRA conexión justo al emitir: prueba que el commit ya ocurrió. */
  vista: Promise<{ estado: string | null }>;
}

/** Captura los eventos de seguimiento con la vista de la base en el instante de emitir. */
export function capturarEventos(e: Entorno): { lista: Capturado[]; vaciar: () => void } {
  const lista: Capturado[] = [];
  const emisor = e.app.get(EventEmitter2);
  for (const clase of NOMBRES_EVENTOS) {
    emisor.on(clase.eventName, (payload: Record<string, unknown>) => {
      lista.push({
        nombre: clase.eventName,
        payload,
        vista: e.ds
          .query('SELECT estado FROM seguimiento WHERE id = $1', [payload.seguimientoId])
          .then((filas: { estado: string }[]) => ({ estado: filas[0]?.estado ?? null })),
      });
    });
  }
  return { lista, vaciar: () => (lista.length = 0) };
}

export const deTipo = (lista: Capturado[], clase: { eventName: string }): Capturado[] =>
  lista.filter((c) => c.nombre === clase.eventName);

/** Reloj simulado sobre el provider real: no hay que reconstruir la AppModule. */
export function relojSimulado(e: Entorno): {
  fijar: (instante: Date | string | null) => void;
} {
  const reloj = e.app.get(Reloj);
  const real = reloj.ahora.bind(reloj);
  let fijo: Date | null = null;
  jest.spyOn(reloj, 'ahora').mockImplementation(() => (fijo ? new Date(fijo) : real()));
  return { fijar: (instante) => (fijo = instante === null ? null : new Date(instante)) };
}

export const tareas = (e: Entorno): SeguimientosTareasService =>
  e.app.get(SeguimientosTareasService);

export interface Escenario {
  mascotaId: number;
  solicitudId: number;
  adopcionId: number;
}

/** Mascota publicada → solicitud → aprobación: deja una adopción activa con entrega hoy. */
export async function adopcionActiva(
  e: Entorno,
  f: FundacionPrueba,
  ad: AdoptantePrueba,
  razaId: number,
  nombre: string,
  fechaEntrega = fechaBogota(0),
): Promise<Escenario> {
  const mascotaId = await mascotaPublicada(e, f, razaId, nombre);
  const solicitudId = (await ENVIAR_FORMULARIO(e, ad, mascotaId, PDF).expect(201)).body
    .id as number;
  await con(e.patch(`/solicitudes/${solicitudId}/decision`), f.access)
    .send({ decision: 'aprobar', fechaEntrega })
    .expect(200);
  const [{ id: adopcionId }]: { id: number }[] = await e.ds.query(
    'SELECT id FROM adopcion WHERE solicitud_id = $1',
    [solicitudId],
  );
  return { mascotaId, solicitudId, adopcionId };
}

export const ENVIAR_FORMULARIO = (
  e: Entorno,
  a: AdoptantePrueba,
  mascotaId: number,
  formulario: Buffer,
): request.Test =>
  con(e.post('/solicitudes'), a.access)
    .field('mascotaId', String(mascotaId))
    .field('motivo', 'Quiero darle un hogar lleno de cariño')
    .field('tipoVivienda', 'casa')
    .field('tieneOtrasMascotas', 'false')
    .attach('formulario', formulario, { filename: 'f.pdf', contentType: 'application/pdf' });

/** Archivos de `uploads/privado/seguimientos` (reportes y evidencias). */
export const archivosSeguimientos = (uploads: string): string[] => {
  const carpeta = path.join(uploads, 'privado', 'seguimientos');
  return existsSync(carpeta) ? readdirSync(carpeta).sort() : [];
};
export const enDisco = (uploads: string, clave: string): boolean =>
  existsSync(path.join(uploads, clave));

/** Claves registradas en la base (son lo único que debe haber en disco). */
export async function clavesEnBase(e: Entorno): Promise<string[]> {
  const filas: { url: string }[] = await e.ds.query(
    'SELECT url FROM seguimiento_evidencia ORDER BY url',
  );
  return filas.map((f) => path.basename(f.url));
}

/** Disco y base deben coincidir exactamente: sin archivos huérfanos ni filas sin archivo. */
export async function discoIgualABase(e: Entorno): Promise<void> {
  expect(archivosSeguimientos(e.uploads)).toEqual(await clavesEnBase(e));
}

export const filaSeguimiento = async (e: Entorno, id: number) =>
  (
    (await e.ds.query(
      `SELECT id, adopcion_id, tipo, estado, estado_bienestar, observaciones, reporte_adoptante,
              to_char(fecha_programada,'YYYY-MM-DD') AS fecha_programada,
              to_char(fecha_realizada,'YYYY-MM-DD') AS fecha_realizada,
              reporte_enviado_en, recordatorio_enviado_en
         FROM seguimiento WHERE id = $1`,
      [id],
    )) as {
      id: number;
      adopcion_id: number;
      tipo: string;
      estado: string;
      estado_bienestar: string | null;
      observaciones: string | null;
      reporte_adoptante: string | null;
      fecha_programada: string;
      fecha_realizada: string | null;
      reporte_enviado_en: Date | null;
      recordatorio_enviado_en: Date | null;
    }[]
  )[0];

export const estadoMascota = async (e: Entorno, id: number): Promise<string> =>
  ((await e.ds.query('SELECT estado FROM mascota WHERE id = $1', [id])) as { estado: string }[])[0]
    .estado;

export const estadoAdopcion = async (e: Entorno, id: number) =>
  (
    (await e.ds.query('SELECT estado, motivo_cierre, fecha_cierre FROM adopcion WHERE id = $1', [
      id,
    ])) as { estado: string; motivo_cierre: string | null; fecha_cierre: Date | null }[]
  )[0];

export const estadosDeAdopcion = async (e: Entorno, adopcionId: number): Promise<string[]> =>
  (
    (await e.ds.query('SELECT estado FROM seguimiento WHERE adopcion_id = $1 ORDER BY id', [
      adopcionId,
    ])) as { estado: string }[]
  ).map((f) => f.estado);

export const contar = async (e: Entorno, sql: string, params: unknown[] = []): Promise<number> =>
  Number(((await e.ds.query(sql, params)) as { n: string }[])[0].n);

/** Claves y datos que ninguna respuesta puede traer, y lo que el adoptante no debe ver de la fundación. */
export const PROHIBIDAS_ADOPTANTE =
  /^(formularioUrl|formulario_url|actaUrl|acta_url|clave|contrasena|password|numeroDocumento|tipoDocumento|fechaNacimiento|direccion|nit|documentoUrl|usuarioId|estadoBienestar|observaciones|evidencias|adoptante|email|telefono)$/i;
