import 'reflect-metadata';
import * as path from 'node:path';
import { SchedulerRegistry } from '@nestjs/schedule';
import request from 'supertest';
import {
  FollowUpReportReceived,
  FollowUpScheduled,
  WellbeingAlertRaised,
} from '../../src/common/events';
import { ADMIN, arrancarEntorno, type Entorno } from '../auth/helpers';
import {
  type AdoptantePrueba,
  adoptanteConSesion,
  adopcionActiva,
  archivosSeguimientos,
  capturarEventos,
  con,
  contar,
  type Capturado,
  deTipo,
  discoIgualABase,
  EJECUTABLE,
  enDisco,
  fechaBogota,
  filaSeguimiento,
  fundacionAprobada,
  type FundacionPrueba,
  jpeg,
  PDF,
  png,
  PROHIBIDAS_ADOPTANTE,
  SVG,
  violacionesDeClaves,
} from './helpers';

// V13 (flujos): seguimiento post-adopción sobre la AppModule real (Postgres, Mailpit y disco).
// Requiere Postgres (DATABASE_*) y Mailpit (SMTP_HOST/SMTP_PORT y MAILPIT_UI_PORT).
// Las tareas programadas se deshabilitan: sus pruebas viven en concurrencia.seguimientos-spec.ts.
interface Foto {
  buffer: Buffer;
  nombre: string;
  tipo: string;
}

describe('V13 — seguimientos: flujos reales (Postgres, Mailpit y disco)', () => {
  let e: Entorno;
  let F1: FundacionPrueba;
  let F2: FundacionPrueba;
  let Ad1: AdoptantePrueba;
  let Ad2: AdoptantePrueba;
  let admin: string;
  let razaId: number;
  let J: Foto;
  let P: Foto;
  let capturados: Capturado[];
  let vaciar: () => void;
  let A1: number; // adopción principal (F1, Ad1)
  const cuerposFundacion: { ruta: string; cuerpo: unknown }[] = [];
  const cuerposAdoptante: { ruta: string; cuerpo: unknown }[] = [];

  // ───────────────────────── utilidades ─────────────────────────
  const programar = (
    f: FundacionPrueba,
    adopcionId: number | string,
    cuerpo: object,
    ip?: string,
  ) => con(e.post(`/adopciones/${adopcionId}/seguimientos`, ip), f.access).send(cuerpo);
  const programado = async (
    adopcionId: number,
    tipo: 'visita' | 'reporte',
    dias: number,
  ): Promise<number> => {
    const res = await programar(F1, adopcionId, {
      tipo,
      fechaProgramada: fechaBogota(dias),
    }).expect(201);
    return res.body.id as number;
  };
  const reportar = (
    access: string,
    id: number,
    comentarios: string | null,
    fotos: Foto[] = [],
    ip?: string,
  ): request.Test => {
    const r = con(e.post(`/seguimientos/${id}/reporte`, ip), access);
    if (comentarios !== null) r.field('comentarios', comentarios);
    for (const f of fotos) r.attach('fotos', f.buffer, { filename: f.nombre, contentType: f.tipo });
    return r;
  };
  const cerrar = (
    f: FundacionPrueba,
    id: number,
    campos: Record<string, string> = {},
    evidencias: Foto[] = [],
    ip?: string,
  ): request.Test => {
    const r = con(e.patch(`/seguimientos/${id}/resultado`, ip), f.access);
    const completos = {
      fechaRealizada: fechaBogota(0),
      estadoBienestar: 'bueno',
      observaciones: 'Todo en orden',
      ...campos,
    };
    for (const [k, v] of Object.entries(completos)) r.field(k, v);
    for (const f of evidencias) {
      r.attach('evidencias', f.buffer, { filename: f.nombre, contentType: f.tipo });
    }
    return r;
  };
  const evidencias = async (seguimientoId: number) =>
    (await e.ds.query(
      'SELECT id, url, origen FROM seguimiento_evidencia WHERE seguimiento_id = $1 ORDER BY id',
      [seguimientoId],
    )) as { id: number; url: string; origen: string }[];
  const filasSeguimiento = (): Promise<number> =>
    contar(e, 'SELECT count(*) AS n FROM seguimiento');

  beforeAll(async () => {
    process.env.SEGUIMIENTOS_CRON_HABILITADO = 'false';
    e = await arrancarEntorno();
    admin = (await e.sesion(ADMIN.email, ADMIN.clave)).access;
    F1 = await fundacionAprobada(e, 'Cali');
    F2 = await fundacionAprobada(e, 'Bogotá');
    [Ad1, Ad2] = [await adoptanteConSesion(e), await adoptanteConSesion(e)];
    [{ id: razaId }] = await e.ds.query('SELECT id FROM raza ORDER BY id LIMIT 1');
    J = { buffer: await jpeg(), nombre: 'foto.jpg', tipo: 'image/jpeg' };
    P = { buffer: await png(), nombre: 'foto.png', tipo: 'image/png' };
    ({ lista: capturados, vaciar } = capturarEventos(e));
    ({ adopcionId: A1 } = await adopcionActiva(e, F1, Ad1, razaId, 'Firulais'));
  });
  afterAll(() => e?.cerrar());

  it('las tareas programadas están deshabilitadas: no hay ningún temporizador', () => {
    expect(e.app.get(SchedulerRegistry).getCronJobs().size).toBe(0);
  });

  // ───────────────────────── programar (B-28) ─────────────────────────
  describe('programar', () => {
    let visita: number;

    it('la fundación dueña crea un seguimiento programado y el evento sale tras el commit', async () => {
      vaciar();
      const fecha = fechaBogota(5);
      const res = await programar(F1, A1, { tipo: 'visita', fechaProgramada: fecha }).expect(201);
      cuerposFundacion.push({ ruta: 'POST /adopciones/:id/seguimientos', cuerpo: res.body });
      visita = res.body.id;
      expect(res.body).toMatchObject({
        adopcionId: A1,
        tipo: 'visita',
        fechaProgramada: fecha,
        fechaRealizada: null,
        estado: 'programado',
        vencido: false,
        tieneReporte: false,
        mascota: { nombre: 'Firulais' },
        fechaEntrega: fechaBogota(0),
        estadoBienestar: null,
        observaciones: null,
        reporte: null,
        evidencias: [],
      });
      const fila = await filaSeguimiento(e, visita);
      expect(fila).toMatchObject({ estado: 'programado', fecha_programada: fecha });
      const recibidos = deTipo(capturados, FollowUpScheduled);
      expect(recibidos).toHaveLength(1);
      expect(await recibidos[0].vista).toEqual({ estado: 'programado' }); // ya confirmado
      const payload = recibidos[0].payload as unknown as FollowUpScheduled;
      expect(payload).toMatchObject({ seguimientoId: visita, adopcionId: A1 });
      expect(payload.fechaProgramada.toISOString()).toBe(`${fecha}T05:00:00.000Z`);
    });

    it('anónimo 401, adoptante y administrador 403, sin crear nada', async () => {
      const antes = await filasSeguimiento();
      const cuerpo = { tipo: 'visita', fechaProgramada: fechaBogota(6) };
      await e.post(`/adopciones/${A1}/seguimientos`).send(cuerpo).expect(401);
      await con(e.post(`/adopciones/${A1}/seguimientos`), Ad1.access)
        .send(cuerpo)
        .expect(403);
      await con(e.post(`/adopciones/${A1}/seguimientos`), admin)
        .send(cuerpo)
        .expect(403);
      expect(await filasSeguimiento()).toBe(antes);
    });

    it('una adopción ajena es el mismo 404 que una inexistente, sin crear nada', async () => {
      const antes = await filasSeguimiento();
      const cuerpo = { tipo: 'visita', fechaProgramada: fechaBogota(6) };
      const ajena = await programar(F2, A1, cuerpo).expect(404);
      const inexistente = await programar(F1, 999999, cuerpo).expect(404);
      expect(ajena.body.message).toBe('La adopción no existe');
      expect(inexistente.body.message).toBe(ajena.body.message);
      await programar(F1, 0, cuerpo).expect(400);
      expect(await filasSeguimiento()).toBe(antes);
    });

    it('fechas inválidas: 400 con la regla incumplida, sin filas ni eventos', async () => {
      const antes = await filasSeguimiento();
      vaciar();
      const entrega = await programar(F1, A1, {
        tipo: 'visita',
        fechaProgramada: fechaBogota(0),
      }).expect(400);
      expect(entrega.body.message).toContain(`posterior a la fecha de entrega (${fechaBogota(0)})`);
      const [{ id: ayer }] = [{ id: fechaBogota(-1) }];
      // Con la entrega movida al pasado, «anterior a hoy» es la regla que falla.
      await e.ds.query(`UPDATE adopcion SET fecha_entrega = $1 WHERE id = $2`, [
        fechaBogota(-30),
        A1,
      ]);
      const pasada = await programar(F1, A1, { tipo: 'visita', fechaProgramada: ayer }).expect(400);
      expect(pasada.body.message).toBe('La fecha del seguimiento no puede ser anterior a hoy');
      for (const fechaProgramada of ['2026-02-30', '2026-13-01', '15/12/2026', 'mañana', '']) {
        const res = await programar(F1, A1, { tipo: 'visita', fechaProgramada }).expect(400);
        expect(JSON.stringify(res.body)).toMatch(/fecha/i);
      }
      await programar(F1, A1, { tipo: 'llamada', fechaProgramada: fechaBogota(6) }).expect(400);
      await programar(F1, A1, { tipo: 'visita' }).expect(400);
      expect(await filasSeguimiento()).toBe(antes);
      expect(capturados).toHaveLength(0);
    });

    it('hoy es una fecha válida (la entrega fue antes)', async () => {
      const res = await programar(F1, A1, {
        tipo: 'reporte',
        fechaProgramada: fechaBogota(0),
      }).expect(201);
      await e.ds.query('DELETE FROM seguimiento WHERE id = $1', [res.body.id]);
    });

    it('el mismo tipo y fecha es 409; otro tipo u otra fecha, no', async () => {
      const fecha = fechaBogota(5);
      const dup = await programar(F1, A1, { tipo: 'visita', fechaProgramada: fecha }).expect(409);
      expect(dup.body.message).toBe('Ya hay un seguimiento de ese tipo programado para esa fecha');
      await programar(F1, A1, { tipo: 'reporte', fechaProgramada: fecha }).expect(201);
      await programar(F1, A1, { tipo: 'visita', fechaProgramada: fechaBogota(7) }).expect(201);
      expect(
        await contar(e, 'SELECT count(*) AS n FROM seguimiento WHERE adopcion_id = $1', [A1]),
      ).toBe(3);
    });
  });

  // ───────────────────────── reporte (B-30) ─────────────────────────
  describe('reporte del adoptante', () => {
    let rep: number;
    let visita: number;

    beforeAll(async () => {
      rep = await programado(A1, 'reporte', 20);
      visita = await programado(A1, 'visita', 21);
    });

    it('comentarios y fotos reales: se guardan en privado, no se sirven bajo /uploads y se emite una vez', async () => {
      vaciar();
      const res = await reportar(Ad1.access, rep, '  Come y juega mucho  ', [J, P]).expect(201);
      cuerposAdoptante.push({ ruta: 'POST /seguimientos/:id/reporte', cuerpo: res.body });
      expect(res.body.estado).toBe('programado'); // el reporte no cambia el estado
      expect(res.body.tieneReporte).toBe(true);
      expect(res.body.reporte.comentarios).toBe('Come y juega mucho');
      const filas = await evidencias(rep);
      expect(filas).toHaveLength(2);
      expect(filas.every((f) => f.origen === 'adoptante')).toBe(true);
      expect(res.body.reporte.fotos).toEqual(
        filas.map((f) => ({ id: f.id, url: `/api/mis-seguimientos/${rep}/evidencias/${f.id}` })),
      );
      for (const f of filas) {
        expect(f.url).toMatch(/^privado\/seguimientos\/[0-9a-f-]+\.(jpg|png)$/);
        expect(enDisco(e.uploads, f.url)).toBe(true);
        for (const ruta of [
          `/uploads/${f.url}`,
          `/uploads/seguimientos/${path.basename(f.url)}`,
          `/uploads/privado/seguimientos/${path.basename(f.url)}`,
        ]) {
          await request(e.app.getHttpServer()).get(ruta).expect(404);
        }
      }
      const fila = await filaSeguimiento(e, rep);
      expect(fila.reporte_adoptante).toBe('Come y juega mucho');
      expect(fila.reporte_enviado_en).not.toBeNull();
      const recibidos = deTipo(capturados, FollowUpReportReceived);
      expect(recibidos).toHaveLength(1);
      expect(recibidos[0].payload).toEqual(new FollowUpReportReceived(rep, A1));
      expect(await recibidos[0].vista).toEqual({ estado: 'programado' });
    });

    it('un reporte sin fotos es válido', async () => {
      const otro = await programado(A1, 'reporte', 22);
      await reportar(Ad1.access, otro, 'Solo texto').expect(201);
      expect(await evidencias(otro)).toHaveLength(0);
    });

    it('reenviar reemplaza comentarios y fotos, borra los archivos viejos y NO vuelve a notificar', async () => {
      const viejas = await evidencias(rep);
      vaciar();
      const res = await reportar(Ad1.access, rep, 'Corrijo: ahora pesa más', [J]).expect(201);
      expect(res.body.reporte.comentarios).toBe('Corrijo: ahora pesa más');
      const nuevas = await evidencias(rep);
      expect(nuevas).toHaveLength(1);
      for (const v of viejas) expect(enDisco(e.uploads, v.url)).toBe(false);
      expect(enDisco(e.uploads, nuevas[0].url)).toBe(true);
      expect(deTipo(capturados, FollowUpReportReceived)).toHaveLength(0);
      await discoIgualABase(e);
    });

    it('la fundación dueña ve el reporte vigente; el adoptante, el suyo y nada de la valoración interna', async () => {
      const f = await con(e.get(`/fundacion/seguimientos/${rep}`), F1.access).expect(200);
      cuerposFundacion.push({ ruta: 'GET /fundacion/seguimientos/:id', cuerpo: f.body });
      expect(f.body.reporte.comentarios).toBe('Corrijo: ahora pesa más');
      expect(f.body.reporte.fotos).toHaveLength(1);
      expect(f.body.reporte.fotos[0].url).toMatch(
        new RegExp(`^/api/fundacion/seguimientos/${rep}/evidencias/\\d+$`),
      );
      expect(f.body.adoptante).toHaveProperty('nombreCompleto');
      const a = await con(e.get(`/mis-seguimientos/${rep}`), Ad1.access).expect(200);
      cuerposAdoptante.push({ ruta: 'GET /mis-seguimientos/:id', cuerpo: a.body });
      expect(a.body.reporte.comentarios).toBe('Corrijo: ahora pesa más');
      expect(a.body.fundacion).toEqual({ nombre: expect.any(String) });
      for (const clave of ['estadoBienestar', 'observaciones', 'evidencias', 'adoptante']) {
        expect(a.body).not.toHaveProperty(clave);
      }
    });

    it('una visita no admite reporte (409); otro adoptante 404; fundación 403; anónimo 401', async () => {
      const antes = archivosSeguimientos(e.uploads);
      const v = await reportar(Ad1.access, visita, 'x', [J]).expect(409);
      expect(v.body.message).toBe('Este seguimiento es una visita y no admite reporte');
      await reportar(Ad2.access, rep, 'x', [J]).expect(404);
      await reportar(Ad2.access, 999999, 'x', [J]).expect(404);
      await reportar(F1.access, rep, 'x').expect(403);
      await e.post(`/seguimientos/${rep}/reporte`).field('comentarios', 'x').expect(401);
      expect(archivosSeguimientos(e.uploads)).toEqual(antes);
    });

    it('datos y archivos inválidos: 400/413, sin cambios ni archivos huérfanos', async () => {
      const antesFila = await filaSeguimiento(e, rep);
      const antesFotos = await evidencias(rep);
      const antesDisco = archivosSeguimientos(e.uploads);
      await reportar(Ad1.access, rep, null, [J]).expect(400);
      await reportar(Ad1.access, rep, '   ', [J]).expect(400);
      await reportar(Ad1.access, rep, 'x'.repeat(501), [J]).expect(400);
      const seis = Array.from({ length: 6 }, () => J);
      const muchas = await reportar(Ad1.access, rep, 'x', seis).expect(400);
      expect(muchas.body.message).toContain('no pueden ser más de 5');
      await reportar(Ad1.access, rep, 'x', [
        J,
        { buffer: SVG, nombre: 'a.svg', tipo: 'image/svg+xml' },
      ]).expect(400);
      await reportar(Ad1.access, rep, 'x', [
        { buffer: EJECUTABLE, nombre: 'a.jpg', tipo: 'image/jpeg' },
      ]).expect(400);
      await reportar(Ad1.access, rep, 'x', [
        { buffer: PDF, nombre: 'a.pdf', tipo: 'application/pdf' },
      ]).expect(400);
      await reportar(Ad1.access, rep, 'x', [
        { buffer: Buffer.alloc(0), nombre: 'v.jpg', tipo: 'image/jpeg' },
      ]).expect(400);
      const grande = await reportar(Ad1.access, rep, 'x', [
        {
          buffer: Buffer.concat([J.buffer, Buffer.alloc(5 * 1024 * 1024)]),
          nombre: 'g.jpg',
          tipo: 'image/jpeg',
        },
      ]).expect(413);
      expect(grande.body.message).toContain('5 MB');
      expect(await filaSeguimiento(e, rep)).toEqual(antesFila);
      expect(await evidencias(rep)).toEqual(antesFotos);
      expect(archivosSeguimientos(e.uploads)).toEqual(antesDisco);
    });

    it('la tercera foto inválida deshace las dos primeras: ningún archivo queda a medias', async () => {
      const antesDisco = archivosSeguimientos(e.uploads);
      const antesFotos = await evidencias(rep);
      await reportar(Ad1.access, rep, 'x', [
        J,
        P,
        { buffer: SVG, nombre: 'a.svg', tipo: 'image/svg+xml' },
      ]).expect(400);
      expect(archivosSeguimientos(e.uploads)).toEqual(antesDisco);
      expect(await evidencias(rep)).toEqual(antesFotos);
    });
  });

  // ───────────────────────── resultado (B-29) ─────────────────────────
  describe('resultado de la fundación', () => {
    let repConReporte: number;
    let repSinReporte: number;
    let visita: number;

    beforeAll(async () => {
      repConReporte = await programado(A1, 'reporte', 30);
      repSinReporte = await programado(A1, 'reporte', 31);
      visita = await programado(A1, 'visita', 32);
      await reportar(Ad1.access, repConReporte, 'Va todo bien', [J, P]).expect(201);
    });

    it('un reporte que el adoptante no envió no se cierra (409); una visita sí puede cerrarse sin reporte', async () => {
      vaciar();
      const bloqueado = await cerrar(F1, repSinReporte, {}, [J]).expect(409);
      expect(bloqueado.body.message).toBe('El adoptante todavía no ha enviado el reporte');
      expect((await filaSeguimiento(e, repSinReporte)).estado).toBe('programado');
      expect(await evidencias(repSinReporte)).toHaveLength(0);

      const res = await cerrar(
        F1,
        visita,
        { estadoBienestar: 'regular', observaciones: '  Algo flaco  ' },
        [J, P],
      ).expect(200);
      cuerposFundacion.push({ ruta: 'PATCH /seguimientos/:id/resultado', cuerpo: res.body });
      expect(res.body).toMatchObject({
        estado: 'realizado',
        fechaRealizada: fechaBogota(0),
        estadoBienestar: 'regular',
        observaciones: 'Algo flaco',
        vencido: false,
      });
      expect(res.body.evidencias).toHaveLength(2);
      expect(res.body.evidencias[0].url).toMatch(
        new RegExp(`^/api/fundacion/seguimientos/${visita}/evidencias/\\d+$`),
      );
      const filas = await evidencias(visita);
      expect(filas.every((f) => f.origen === 'fundacion')).toBe(true);
      for (const f of filas) expect(enDisco(e.uploads, f.url)).toBe(true);
      // Con regular no hay alerta.
      expect(deTipo(capturados, WellbeingAlertRaised)).toHaveLength(0);
    });

    it('con bienestar malo emite UNA alerta tras el commit; con bueno no', async () => {
      vaciar();
      await cerrar(F1, repConReporte, {
        estadoBienestar: 'malo',
        observaciones: 'Se ve delgado',
      }).expect(200);
      const alertas = deTipo(capturados, WellbeingAlertRaised);
      expect(alertas).toHaveLength(1);
      const [{ mascota_id }] = await e.ds.query(
        `SELECT s.mascota_id FROM adopcion a JOIN solicitud_adopcion s ON s.id = a.solicitud_id WHERE a.id = $1`,
        [A1],
      );
      expect(alertas[0].payload).toEqual(
        new WellbeingAlertRaised(repConReporte, A1, mascota_id, F1.id),
      );
      expect(await alertas[0].vista).toEqual({ estado: 'realizado' });

      const otro = await programado(A1, 'visita', 33);
      vaciar();
      await cerrar(F1, otro, { estadoBienestar: 'bueno' }).expect(200);
      expect(deTipo(capturados, WellbeingAlertRaised)).toHaveLength(0);
    });

    it('un seguimiento realizado no se reabre: 409 y sin alerta ni cambios', async () => {
      vaciar();
      const antes = await filaSeguimiento(e, repConReporte);
      const antesFotos = await evidencias(repConReporte);
      const res = await cerrar(F1, repConReporte, { estadoBienestar: 'bueno' }, [J]).expect(409);
      expect(res.body.message).toBe('El seguimiento ya fue registrado como realizado');
      expect(await filaSeguimiento(e, repConReporte)).toEqual(antes);
      expect(await evidencias(repConReporte)).toEqual(antesFotos);
      expect(capturados).toHaveLength(0);
      await discoIgualABase(e);
      // Y el adoptante tampoco puede reenviar su reporte.
      await reportar(Ad1.access, repConReporte, 'tarde', [J]).expect(409);
      await discoIgualABase(e);
    });

    it('fechas y campos inválidos: 400 sin cambios ni archivos', async () => {
      const pendiente = await programado(A1, 'visita', 34);
      const antes = await filaSeguimiento(e, pendiente);
      const disco = archivosSeguimientos(e.uploads);
      const futura = await cerrar(F1, pendiente, { fechaRealizada: fechaBogota(1) }, [J]).expect(
        400,
      );
      expect(futura.body.message).toBe('La fecha realizada no puede ser futura');
      await e.ds.query('UPDATE adopcion SET fecha_entrega = $1 WHERE id = $2', [
        fechaBogota(-3),
        A1,
      ]);
      const previa = await cerrar(F1, pendiente, { fechaRealizada: fechaBogota(-4) }, [J]).expect(
        400,
      );
      expect(previa.body.message).toContain('anterior a la fecha de entrega');
      const invalidos: Record<string, string>[] = [
        { fechaRealizada: '2026-02-30' },
        { fechaRealizada: 'ayer' },
        { estadoBienestar: 'pésimo' },
        { observaciones: '   ' },
        { observaciones: 'x'.repeat(501) },
      ];
      for (const campos of invalidos) {
        await cerrar(F1, pendiente, campos, [J]).expect(400);
      }
      await con(e.patch(`/seguimientos/${pendiente}/resultado`), F1.access)
        .field('estadoBienestar', 'bueno')
        .expect(400);
      const seis = Array.from({ length: 6 }, () => J);
      await cerrar(F1, pendiente, {}, seis).expect(400);
      await cerrar(F1, pendiente, {}, [
        { buffer: SVG, nombre: 'a.svg', tipo: 'image/svg+xml' },
      ]).expect(400);
      await cerrar(F1, pendiente, {}, [
        {
          buffer: Buffer.concat([J.buffer, Buffer.alloc(5 * 1024 * 1024)]),
          nombre: 'g.jpg',
          tipo: 'image/jpeg',
        },
      ]).expect(413);
      expect(await filaSeguimiento(e, pendiente)).toEqual(antes);
      expect(archivosSeguimientos(e.uploads)).toEqual(disco);
      // La propia fecha de entrega es válida.
      await cerrar(F1, pendiente, { fechaRealizada: fechaBogota(-3) }).expect(200);
    });

    it('ajeno 404 uniforme; adoptante 403; anónimo 401', async () => {
      const pendiente = await programado(A1, 'visita', 35);
      const antes = await filaSeguimiento(e, pendiente);
      const ajeno = await cerrar(F2, pendiente).expect(404);
      const inexistente = await cerrar(F1, 999999).expect(404);
      expect(ajeno.body.message).toBe(inexistente.body.message);
      await con(e.patch(`/seguimientos/${pendiente}/resultado`), Ad1.access)
        .field('estadoBienestar', 'bueno')
        .expect(403);
      await e
        .patch(`/seguimientos/${pendiente}/resultado`)
        .field('estadoBienestar', 'bueno')
        .expect(401);
      expect(await filaSeguimiento(e, pendiente)).toEqual(antes);
    });
  });

  // ───────────────────────── descarga de fotos (R13) ─────────────────────────
  describe('descarga autenticada de fotos', () => {
    let rep: number;
    let reporteFoto: { id: number; url: string };
    let evidenciaFoto: { id: number; url: string };
    let otroSeg: number;

    beforeAll(async () => {
      rep = await programado(A1, 'reporte', 40);
      await reportar(Ad1.access, rep, 'Mira cómo está', [P]).expect(201);
      [reporteFoto] = await evidencias(rep);
      await cerrar(F1, rep, { observaciones: 'Visto' }, [J]).expect(200);
      evidenciaFoto = (await evidencias(rep)).find((f) => f.id !== reporteFoto.id)!;
      otroSeg = await programado(A1, 'visita', 41);
    });

    const rutaF = (seg: number, id: number) => `/fundacion/seguimientos/${seg}/evidencias/${id}`;
    const rutaA = (seg: number, id: number) => `/mis-seguimientos/${seg}/evidencias/${id}`;

    it('la fundación dueña descarga la foto del reporte y la evidencia, con tipo real y cabeceras seguras', async () => {
      const r = await con(e.get(rutaF(rep, reporteFoto.id)), F1.access).expect(200);
      expect(r.headers['content-type']).toBe('image/png');
      expect(Buffer.from(r.body as Buffer).equals(P.buffer)).toBe(true);
      expect(r.headers['content-disposition']).toBe(
        `inline; filename="evidencia-seguimiento-${rep}-${reporteFoto.id}.png"`,
      );
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['cache-control']).toBe('private, no-store');
      expect(r.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
      const ev = await con(e.get(rutaF(rep, evidenciaFoto.id)), F1.access).expect(200);
      expect(ev.headers['content-type']).toBe('image/jpeg');
      expect(Buffer.from(ev.body as Buffer).equals(J.buffer)).toBe(true);
    });

    it('el adoptante dueño descarga solo las fotos de su reporte, nunca las evidencias de la fundación', async () => {
      const propia = await con(e.get(rutaA(rep, reporteFoto.id)), Ad1.access).expect(200);
      expect(propia.headers['content-type']).toBe('image/png');
      expect(propia.headers['x-content-type-options']).toBe('nosniff');
      expect(propia.headers['cache-control']).toBe('private, no-store');
      const interna = await con(e.get(rutaA(rep, evidenciaFoto.id)), Ad1.access).expect(404);
      expect(interna.headers['content-type']).toContain('application/json');
    });

    it('ajenos, inexistentes y cruzados responden el mismo 404; anónimo 401; rol equivocado 403', async () => {
      const mensajes: string[] = [];
      for (const [ruta, access] of [
        [rutaF(rep, reporteFoto.id), F2.access], // fundación ajena
        [rutaA(rep, reporteFoto.id), Ad2.access], // adoptante ajeno
        [rutaF(rep, 999999), F1.access], // foto inexistente
        [rutaF(999999, reporteFoto.id), F1.access], // seguimiento inexistente
        [rutaF(otroSeg, reporteFoto.id), F1.access], // foto de otro seguimiento
        [rutaA(otroSeg, reporteFoto.id), Ad1.access],
      ] as const) {
        const res = await con(e.get(ruta), access).expect(404);
        expect(res.headers['content-type']).toContain('application/json');
        mensajes.push(res.body.message as string);
      }
      expect(new Set(mensajes)).toEqual(new Set(['La foto no existe']));
      await e.get(rutaF(rep, reporteFoto.id)).expect(401);
      await e.get(rutaA(rep, reporteFoto.id)).expect(401);
      await con(e.get(rutaF(rep, reporteFoto.id)), Ad1.access).expect(403);
      await con(e.get(rutaA(rep, reporteFoto.id)), F1.access).expect(403);
      await con(e.get(rutaF(rep, 0)), F1.access).expect(400);
    });
  });

  // ───────────────────────── lecturas, listados y adopciones (R4, R5) ─────────────────────────
  describe('listados por rol', () => {
    let A2: number;

    beforeAll(async () => {
      ({ adopcionId: A2 } = await adopcionActiva(e, F2, Ad2, razaId, 'Otra'));
      await programar(F2, A2, { tipo: 'visita', fechaProgramada: fechaBogota(9) }).expect(201);
    });

    it('cada rol ve solo los suyos, con filtros por estado, tipo y adopción', async () => {
      const todos = await contar(
        e,
        `SELECT count(*) AS n FROM seguimiento WHERE adopcion_id = $1`,
        [A1],
      );
      const f = await con(e.get('/fundacion/seguimientos?limit=100'), F1.access).expect(200);
      expect(f.body.total).toBe(todos);
      expect(f.body.data.every((s: { adopcionId: number }) => s.adopcionId === A1)).toBe(true);
      expect(f.body.data[0].adoptante).toEqual({ nombreCompleto: expect.any(String) });
      const f2 = await con(e.get('/fundacion/seguimientos'), F2.access).expect(200);
      expect(f2.body.total).toBe(1);

      const a = await con(e.get('/mis-seguimientos?limit=100'), Ad1.access).expect(200);
      cuerposAdoptante.push({ ruta: 'GET /mis-seguimientos', cuerpo: a.body });
      expect(a.body.total).toBe(todos);
      expect(a.body.data[0].fundacion).toEqual({ nombre: expect.any(String) });
      expect(a.body.data[0]).not.toHaveProperty('adoptante');
      cuerposFundacion.push({ ruta: 'GET /fundacion/seguimientos', cuerpo: f.body });

      const realizados = await con(
        e.get('/fundacion/seguimientos?estado=realizado&limit=100'),
        F1.access,
      ).expect(200);
      expect(realizados.body.data.length).toBeGreaterThan(0);
      expect(realizados.body.data.every((s: { estado: string }) => s.estado === 'realizado')).toBe(
        true,
      );
      const visitas = await con(
        e.get('/mis-seguimientos?tipo=visita&limit=100'),
        Ad1.access,
      ).expect(200);
      expect(visitas.body.data.every((s: { tipo: string }) => s.tipo === 'visita')).toBe(true);
      // Una adopción ajena devuelve una lista vacía, no un error ni datos.
      const ajena = await con(e.get(`/fundacion/seguimientos?adopcionId=${A2}`), F1.access).expect(
        200,
      );
      expect(ajena.body).toMatchObject({ total: 0, data: [] });
      const propia = await con(
        e.get(`/mis-seguimientos?adopcionId=${A1}&limit=100`),
        Ad1.access,
      ).expect(200);
      expect(propia.body.total).toBe(todos);
      expect((await con(e.get('/mis-seguimientos'), Ad2.access).expect(200)).body.total).toBe(1);
    });

    it('filtros y paginación inválidos: 400', async () => {
      for (const consulta of [
        'estado=x',
        'tipo=x',
        'adopcionId=0',
        'adopcionId=abc',
        'page=0',
        'limit=101',
      ]) {
        await con(e.get(`/fundacion/seguimientos?${consulta}`), F1.access).expect(400);
        await con(e.get(`/mis-seguimientos?${consulta}`), Ad1.access).expect(400);
      }
    });

    it('detalle ajeno o inexistente: el mismo 404 en ambos roles', async () => {
      const [{ id }] = await e.ds.query(
        'SELECT id FROM seguimiento WHERE adopcion_id = $1 LIMIT 1',
        [A2],
      );
      const a = await con(e.get(`/fundacion/seguimientos/${id}`), F1.access).expect(404);
      const b = await con(e.get(`/fundacion/seguimientos/999999`), F1.access).expect(404);
      const c = await con(e.get(`/mis-seguimientos/${id}`), Ad1.access).expect(404);
      expect(new Set([a.body.message, b.body.message, c.body.message])).toEqual(
        new Set(['El seguimiento no existe']),
      );
      await con(e.get('/fundacion/seguimientos'), Ad1.access).expect(403);
      await con(e.get('/mis-seguimientos'), F1.access).expect(403);
      await e.get('/mis-seguimientos').expect(401);
    });

    it('`vencido` se calcula sin esperar al cron: programado con fecha pasada ya se muestra vencido', async () => {
      const id = await programado(A1, 'visita', 50);
      await e.ds.query(`UPDATE seguimiento SET fecha_programada = $1 WHERE id = $2`, [
        fechaBogota(-2),
        id,
      ]);
      const f = await con(e.get(`/fundacion/seguimientos/${id}`), F1.access).expect(200);
      expect(f.body).toMatchObject({ estado: 'programado', vencido: true });
      const a = await con(e.get(`/mis-seguimientos/${id}`), Ad1.access).expect(200);
      expect(a.body).toMatchObject({ estado: 'programado', vencido: true });
      // El de hoy todavía no está vencido (vence al terminar el día).
      const hoy = await programado(A1, 'reporte', 51);
      await e.ds.query(`UPDATE seguimiento SET fecha_programada = $1 WHERE id = $2`, [
        fechaBogota(0),
        hoy,
      ]);
      expect(
        (await con(e.get(`/mis-seguimientos/${hoy}`), Ad1.access).expect(200)).body.vencido,
      ).toBe(false);
    });

    it('GET /mis-adopciones y /fundacion/adopciones traen el resumen real, con total correcto y máximo 20', async () => {
      const [{ id: unica }] = await e.ds.query(
        'SELECT id FROM seguimiento WHERE adopcion_id = $1 LIMIT 1',
        [A2],
      );
      // Una adopción con 22 seguimientos (fechas distintas) para comprobar el tope de 20.
      const { adopcionId: A3 } = await adopcionActiva(e, F1, Ad1, razaId, 'Muchos');
      await e.ds.query(
        `INSERT INTO seguimiento (adopcion_id, tipo, fecha_programada, estado)
         SELECT $1, 'visita', (CURRENT_DATE + g), 'programado' FROM generate_series(1, 22) g`,
        [A3],
      );
      const mias = await con(e.get('/mis-adopciones?limit=100'), Ad1.access).expect(200);
      cuerposAdoptante.push({ ruta: 'GET /mis-adopciones', cuerpo: mias.body });
      const totalAdopciones = await contar(
        e,
        `SELECT count(*) AS n FROM adopcion a JOIN solicitud_adopcion s ON s.id = a.solicitud_id WHERE s.adoptante_id = $1`,
        [Ad1.id],
      );
      expect(mias.body.total).toBe(totalAdopciones);
      const deA1 = mias.body.data.find((a: { id: number }) => a.id === A1);
      expect(deA1.seguimientos.length).toBeGreaterThan(5);
      for (const s of deA1.seguimientos) {
        expect(Object.keys(s).sort()).toEqual([
          'estado',
          'fechaProgramada',
          'fechaRealizada',
          'id',
          'tipo',
          'vencido',
        ]);
      }
      const fechas = deA1.seguimientos.map((s: { fechaProgramada: string }) => s.fechaProgramada);
      expect([...fechas].sort().reverse()).toEqual(fechas); // los más recientes primero
      const deA3 = mias.body.data.find((a: { id: number }) => a.id === A3);
      expect(deA3.seguimientos).toHaveLength(20);
      const masTarde = (
        (await e.ds.query(
          `SELECT to_char(max(fecha_programada),'YYYY-MM-DD') AS f FROM seguimiento WHERE adopcion_id = $1`,
          [A3],
        )) as { f: string }[]
      )[0].f;
      expect(deA3.seguimientos[0].fechaProgramada).toBe(masTarde);

      // La paginación de adopciones no cambia: total y tamaño de página dependen solo de adopciones.
      const pagina = await con(e.get('/mis-adopciones?limit=1&page=1'), Ad1.access).expect(200);
      expect(pagina.body.total).toBe(totalAdopciones);
      expect(pagina.body.data).toHaveLength(1);

      const delF = await con(e.get('/fundacion/adopciones?limit=100'), F1.access).expect(200);
      cuerposFundacion.push({ ruta: 'GET /fundacion/adopciones', cuerpo: delF.body });
      expect(delF.body.data.find((a: { id: number }) => a.id === A3).seguimientos).toHaveLength(20);
      const delF2 = await con(e.get('/fundacion/adopciones'), F2.access).expect(200);
      expect(delF2.body.data[0].seguimientos.map((s: { id: number }) => s.id)).toEqual([unica]);
      // Adopción sin seguimientos: lista vacía.
      const { adopcionId: A4 } = await adopcionActiva(e, F1, Ad1, razaId, 'Sin seguimientos');
      const sin = await con(e.get('/fundacion/adopciones?limit=100'), F1.access).expect(200);
      expect(sin.body.data.find((a: { id: number }) => a.id === A4).seguimientos).toEqual([]);
    });

    it('la paginación es estable y coincide con un oráculo SQL, también con fechas empatadas', async () => {
      // Varias adopciones con seguimientos de la MISMA fecha: el desempate es el id descendente.
      const fecha = fechaBogota(60);
      for (let i = 0; i < 5; i++) {
        const { adopcionId } = await adopcionActiva(e, F1, Ad1, razaId, `Empate ${i}`);
        await e.ds.query(
          `INSERT INTO seguimiento (adopcion_id, tipo, fecha_programada) VALUES ($1, 'visita', $2), ($1, 'reporte', $2)`,
          [adopcionId, fecha],
        );
      }
      const oraculo = (
        (await e.ds.query(
          `SELECT seg.id FROM seguimiento seg
             JOIN adopcion a ON a.id = seg.adopcion_id
             JOIN solicitud_adopcion s ON s.id = a.solicitud_id
             JOIN mascota m ON m.id = s.mascota_id
            WHERE m.fundacion_id = $1
            ORDER BY seg.fecha_programada DESC, seg.id DESC`,
          [F1.id],
        )) as { id: number }[]
      ).map((f) => f.id);
      expect(oraculo.length).toBeGreaterThan(30);
      const vistos: number[] = [];
      for (let page = 1; page <= Math.ceil(oraculo.length / 7); page++) {
        const res = await con(
          e.get(`/fundacion/seguimientos?limit=7&page=${page}`),
          F1.access,
        ).expect(200);
        expect(res.body.total).toBe(oraculo.length);
        vistos.push(...res.body.data.map((s: { id: number }) => s.id));
      }
      expect(vistos).toEqual(oraculo);
      expect(new Set(vistos).size).toBe(vistos.length);
    });
  });

  // ───────────────────────── límites de frecuencia (R22) ─────────────────────────
  describe('límite de frecuencia', () => {
    it('subir reportes, cerrar y descargar tienen su tope por IP (10, 10 y 30 por minuto)', async () => {
      const pendiente = await programado(A1, 'reporte', 70);
      const ipReporte = '172.30.1.1';
      const respuestas = [];
      for (let i = 0; i < 11; i++) {
        respuestas.push((await reportar(Ad1.access, pendiente, null, [], ipReporte)).status);
      }
      expect(respuestas.slice(0, 10).every((s) => s === 400)).toBe(true);
      expect(respuestas[10]).toBe(429);

      const ipCierre = '172.30.1.2';
      const cierres = [];
      for (let i = 0; i < 11; i++) {
        cierres.push(
          (await con(e.patch(`/seguimientos/${pendiente}/resultado`, ipCierre), F1.access)).status,
        );
      }
      expect(cierres.slice(0, 10).every((s) => s === 400)).toBe(true);
      expect(cierres[10]).toBe(429);

      const ipDescarga = '172.30.1.3';
      const descargas = [];
      for (let i = 0; i < 31; i++) {
        descargas.push(
          (
            await con(
              e.get(`/fundacion/seguimientos/${pendiente}/evidencias/999999`, ipDescarga),
              F1.access,
            )
          ).status,
        );
      }
      expect(descargas.slice(0, 30).every((s) => s === 404)).toBe(true);
      expect(descargas[30]).toBe(429);
    });
  });

  // ───────────────────────── barrido final (R13, R14) ─────────────────────────
  describe('barrido de claves prohibidas y de archivos', () => {
    it('ninguna respuesta real expone claves de storage ni datos privados; el adoptante, nada interno', () => {
      expect(cuerposFundacion.length).toBeGreaterThan(3);
      expect(cuerposAdoptante.length).toBeGreaterThanOrEqual(3);
      for (const { ruta, cuerpo } of cuerposFundacion) {
        expect([ruta, violacionesDeClaves(cuerpo)]).toEqual([ruta, []]);
      }
      for (const { ruta, cuerpo } of cuerposAdoptante) {
        expect([ruta, violacionesDeClaves(cuerpo, '$', PROHIBIDAS_ADOPTANTE)]).toEqual([ruta, []]);
      }
    });

    it('sin archivos huérfanos: lo que hay en disco es exactamente lo que está en la base', async () => {
      await discoIgualABase(e);
      expect(archivosSeguimientos(e.uploads).length).toBeGreaterThan(0);
    });
  });
});
