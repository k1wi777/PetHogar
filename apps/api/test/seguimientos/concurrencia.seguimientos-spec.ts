import 'reflect-metadata';
import {
  FollowUpOverdue,
  FollowUpReminder,
  FollowUpReportReceived,
  FollowUpScheduled,
  WellbeingAlertRaised,
} from '../../src/common/events';
import { AdopcionesService } from '../../src/modules/adopciones/adopciones.service';
import { MascotasService } from '../../src/modules/mascotas/mascotas.service';
import { SeguimientosService } from '../../src/modules/seguimientos/seguimientos.service';
import { ADMIN, arrancarEntorno, type Entorno } from '../auth/helpers';
import {
  type AdoptantePrueba,
  adoptanteConSesion,
  adopcionActiva,
  capturarEventos,
  con,
  contar,
  type Capturado,
  deTipo,
  discoIgualABase,
  ENVIAR_FORMULARIO,
  estadoAdopcion,
  estadoMascota,
  estadosDeAdopcion,
  fechaBogota,
  filaSeguimiento,
  fundacionAprobada,
  type FundacionPrueba,
  jpeg,
  PDF,
  relojSimulado,
  tareas,
} from './helpers';

// V13 (concurrencia, cron y B-32): carreras reales contra Postgres, tareas con reloj simulado y
// atomicidad del cierre con fallos inyectados. Las tareas programadas están deshabilitadas.
describe('V13 — seguimientos: concurrencia, cron y cierre de adopción', () => {
  let e: Entorno;
  let F1: FundacionPrueba;
  let F2: FundacionPrueba;
  let Ad1: AdoptantePrueba;
  let Ad2: AdoptantePrueba;
  let razaId: number;
  let foto: Buffer;
  let capturados: Capturado[];
  let vaciar: () => void;
  let reloj: ReturnType<typeof relojSimulado>;

  const programar = (f: FundacionPrueba, adopcionId: number, cuerpo: object) =>
    con(e.post(`/adopciones/${adopcionId}/seguimientos`), f.access).send(cuerpo);
  const cierre = (f: FundacionPrueba, adopcionId: number, cuerpo: object) =>
    con(e.patch(`/adopciones/${adopcionId}/estado`), f.access).send(cuerpo);
  const resultado = (f: FundacionPrueba, id: number, bienestar = 'bueno') =>
    con(e.patch(`/seguimientos/${id}/resultado`), f.access)
      .field('fechaRealizada', fechaBogota(0))
      .field('estadoBienestar', bienestar)
      .field('observaciones', 'Visto');
  const reportar = (id: number, fotos: number) => {
    const r = con(e.post(`/seguimientos/${id}/reporte`), Ad1.access).field(
      'comentarios',
      'Todo bien',
    );
    for (let i = 0; i < fotos; i++)
      r.attach('fotos', foto, { filename: `f${i}.jpg`, contentType: 'image/jpeg' });
    return r;
  };
  /** Inserta seguimientos por SQL (sin pasar por las reglas de fecha) y devuelve sus ids. */
  const insertar = async (
    adopcionId: number,
    tipo: 'visita' | 'reporte',
    dias: number,
    estado = 'programado',
  ): Promise<number> =>
    (
      (await e.ds.query(
        `INSERT INTO seguimiento (adopcion_id, tipo, fecha_programada, estado)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [adopcionId, tipo, fechaBogota(dias), estado],
      )) as { id: number }[]
    )[0].id;
  const eventosDe = (clase: { eventName: string }, ids: number[]): number[] =>
    deTipo(capturados, clase)
      .map((c) => c.payload.seguimientoId as number)
      .filter((id) => ids.includes(id));
  const nueva = async (nombre: string, f = F1, ad = Ad1) =>
    adopcionActiva(e, f, ad, razaId, nombre);

  beforeAll(async () => {
    process.env.SEGUIMIENTOS_CRON_HABILITADO = 'false';
    e = await arrancarEntorno();
    await e.sesion(ADMIN.email, ADMIN.clave);
    F1 = await fundacionAprobada(e, 'Cali');
    F2 = await fundacionAprobada(e, 'Bogotá');
    [Ad1, Ad2] = [await adoptanteConSesion(e), await adoptanteConSesion(e)];
    [{ id: razaId }] = await e.ds.query('SELECT id FROM raza ORDER BY id LIMIT 1');
    foto = await jpeg();
    ({ lista: capturados, vaciar } = capturarEventos(e));
    reloj = relojSimulado(e);
  });
  afterAll(() => e?.cerrar());
  beforeEach(() => {
    reloj.fijar(null);
    vaciar();
  });

  // ───────────────────────── concurrencia ─────────────────────────
  describe('concurrencia', () => {
    it('seis programaciones idénticas simultáneas dejan una fila, un 201, cinco 409 y un evento', async () => {
      const { adopcionId } = await nueva('Carrera');
      const cuerpo = { tipo: 'visita', fechaProgramada: fechaBogota(8) };
      const res = await Promise.all(
        Array.from({ length: 6 }, () => programar(F1, adopcionId, cuerpo)),
      );
      expect(res.filter((r) => r.status === 201)).toHaveLength(1);
      expect(res.filter((r) => r.status === 409)).toHaveLength(5);
      expect(
        await contar(e, 'SELECT count(*) AS n FROM seguimiento WHERE adopcion_id = $1', [
          adopcionId,
        ]),
      ).toBe(1);
      expect(deTipo(capturados, FollowUpScheduled)).toHaveLength(1);
    });

    it('dos cierres simultáneos del mismo seguimiento: uno prospera, el otro 409, una sola alerta', async () => {
      const { adopcionId } = await nueva('Doble cierre');
      const id = await insertar(adopcionId, 'visita', 3);
      const res = await Promise.all([resultado(F1, id, 'malo'), resultado(F1, id, 'malo')]);
      expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
      expect((await filaSeguimiento(e, id)).estado).toBe('realizado');
      expect(deTipo(capturados, WellbeingAlertRaised)).toHaveLength(1);
    });

    it('reportes simultáneos: nunca más de 5 fotos, sin archivos huérfanos y una sola notificación', async () => {
      const { adopcionId } = await nueva('Reportes');
      const id = await insertar(adopcionId, 'reporte', 4);
      const res = await Promise.all(Array.from({ length: 4 }, () => reportar(id, 3)));
      expect(res.every((r) => r.status === 201)).toBe(true);
      const fotos = await contar(
        e,
        'SELECT count(*) AS n FROM seguimiento_evidencia WHERE seguimiento_id = $1',
        [id],
      );
      expect(fotos).toBe(3); // cada reporte reemplaza al anterior
      await discoIgualABase(e);
      expect(deTipo(capturados, FollowUpReportReceived)).toHaveLength(1);
    });

    it('resultado frente a la tarea de vencidos: el seguimiento acaba realizado y vence a lo sumo una vez', async () => {
      const { adopcionId } = await nueva('Resultado vs cron');
      const id = await insertar(adopcionId, 'visita', -2);
      const [res] = await Promise.all([resultado(F1, id), tareas(e).marcarVencidos()]);
      expect(res.status).toBe(200);
      expect((await filaSeguimiento(e, id)).estado).toBe('realizado');
      expect(eventosDe(FollowUpOverdue, [id]).length).toBeLessThanOrEqual(1);
      await tareas(e).marcarVencidos();
      expect((await filaSeguimiento(e, id)).estado).toBe('realizado');
    });

    it('dos cierres de adopción simultáneos: uno prospera y el otro 409', async () => {
      const { adopcionId, mascotaId } = await nueva('Cierre doble');
      await insertar(adopcionId, 'visita', 4);
      const cuerpo = { estado: 'revocada', motivo: 'Maltrato', mascotaDestino: 'disponible' };
      const res = await Promise.all([
        cierre(F1, adopcionId, cuerpo),
        cierre(F1, adopcionId, cuerpo),
      ]);
      expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await estadoMascota(e, mascotaId)).toBe('disponible');
      expect(await estadosDeAdopcion(e, adopcionId)).toEqual(['cancelado']);
    });

    it('programar frente a cerrar: nunca queda un pendiente en una adopción cerrada', async () => {
      for (let i = 0; i < 5; i++) {
        const { adopcionId } = await nueva(`Carrera cierre ${i}`);
        const [p, c] = await Promise.all([
          programar(F1, adopcionId, { tipo: 'visita', fechaProgramada: fechaBogota(5) }),
          cierre(F1, adopcionId, { estado: 'finalizada', motivo: 'Cumplida' }),
        ]);
        expect(c.status).toBe(200);
        expect([201, 409]).toContain(p.status);
        expect((await estadoAdopcion(e, adopcionId)).estado).toBe('finalizada');
        const pendientes = await contar(
          e,
          `SELECT count(*) AS n FROM seguimiento WHERE adopcion_id = $1 AND estado IN ('programado','vencido')`,
          [adopcionId],
        );
        expect(pendientes).toBe(0);
      }
    });
  });

  // ───────────────────────── tareas programadas ─────────────────────────
  /** Los contadores de las tareas son globales: cada prueba parte sin pendientes ajenos. */
  const aislarTareas = () =>
    e.ds.query(
      `UPDATE seguimiento SET estado = 'cancelado' WHERE estado IN ('programado', 'vencido')`,
    );

  describe('cron de vencidos', () => {
    beforeEach(aislarTareas);

    it('vence solo los programados anteriores a hoy, una vez cada uno, y no toca otros estados', async () => {
      const { adopcionId } = await nueva('Vencidos');
      const pasados = [
        await insertar(adopcionId, 'visita', -1),
        await insertar(adopcionId, 'visita', -5),
        await insertar(adopcionId, 'reporte', -9),
      ];
      const hoy = await insertar(adopcionId, 'visita', 0);
      const futuro = await insertar(adopcionId, 'visita', 4);
      const realizado = await insertar(adopcionId, 'visita', -20, 'realizado');
      const cancelado = await insertar(adopcionId, 'visita', -21, 'cancelado');
      const yaVencido = await insertar(adopcionId, 'visita', -22, 'vencido');
      expect(await tareas(e).marcarVencidos()).toBe(3);
      expect(await tareas(e).marcarVencidos()).toBe(0);
      expect(eventosDe(FollowUpOverdue, pasados).sort()).toEqual([...pasados].sort());
      const otros = [hoy, futuro, realizado, cancelado, yaVencido];
      expect(eventosDe(FollowUpOverdue, otros)).toEqual([]);
      expect(
        (await Promise.all([...pasados, ...otros].map((id) => filaSeguimiento(e, id)))).map(
          (f) => f.estado,
        ),
      ).toEqual([
        'vencido',
        'vencido',
        'vencido',
        'programado',
        'programado',
        'realizado',
        'cancelado',
        'vencido',
      ]);
      const evento = deTipo(capturados, FollowUpOverdue).find(
        (c) => c.payload.seguimientoId === pasados[0],
      )!;
      expect(await evento.vista).toEqual({ estado: 'vencido' }); // se emite tras el commit
    });

    it('vence al terminar el día programado, en la hora de Bogotá', async () => {
      const { adopcionId } = await nueva('Frontera');
      const id = await insertar(adopcionId, 'visita', 2);
      const dia = fechaBogota(2);
      reloj.fijar(`${dia}T23:59:00-05:00`);
      expect(await tareas(e).marcarVencidos()).toBe(0);
      reloj.fijar(`${fechaBogota(3)}T00:01:00-05:00`);
      expect(await tareas(e).marcarVencidos()).toBe(1);
      expect((await filaSeguimiento(e, id)).estado).toBe('vencido');
    });

    it('dos ejecuciones concurrentes: cada seguimiento cambia y emite exactamente una vez', async () => {
      const { adopcionId } = await nueva('Concurrentes');
      const ids = [] as number[];
      for (let i = 1; i <= 8; i++) ids.push(await insertar(adopcionId, 'visita', -i));
      const [a, b] = await Promise.all([tareas(e).marcarVencidos(), tareas(e).marcarVencidos()]);
      expect(a + b).toBe(8);
      const emitidos = eventosDe(FollowUpOverdue, ids);
      expect(emitidos).toHaveLength(8);
      expect(new Set(emitidos).size).toBe(8);
    });

    it('procesa por lotes: 1200 filas se vencen todas, una vez cada una', async () => {
      const { adopcionId } = await nueva('Lotes');
      await e.ds.query(
        `INSERT INTO seguimiento (adopcion_id, tipo, fecha_programada, estado)
         SELECT $1, 'visita', (CURRENT_DATE - g), 'programado' FROM generate_series(2, 1201) g`,
        [adopcionId],
      );
      const [a, b] = await Promise.all([tareas(e).marcarVencidos(), tareas(e).marcarVencidos()]);
      expect(a + b).toBe(1200);
      const emitidos = deTipo(capturados, FollowUpOverdue).map((c) => c.payload.seguimientoId);
      expect(emitidos).toHaveLength(1200);
      expect(new Set(emitidos).size).toBe(1200);
      expect(
        await contar(
          e,
          `SELECT count(*) AS n FROM seguimiento WHERE adopcion_id = $1 AND estado = 'vencido'`,
          [adopcionId],
        ),
      ).toBe(1200);
      await e.ds.query('DELETE FROM seguimiento WHERE adopcion_id = $1', [adopcionId]);
    });

    it('SKIP LOCKED: una fila retenida por otra transacción no bloquea la tarea y se procesa después una sola vez', async () => {
      const { adopcionId } = await nueva('Retenidas');
      const ids = [
        await insertar(adopcionId, 'visita', -1),
        await insertar(adopcionId, 'visita', -2),
        await insertar(adopcionId, 'visita', -3),
      ];
      const otra = e.ds.createQueryRunner();
      await otra.connect();
      await otra.startTransaction();
      let ejecucion: Promise<number> | undefined;
      let temporizador: NodeJS.Timeout | undefined;
      try {
        await otra.query('SELECT id FROM seguimiento WHERE id = ANY($1) FOR UPDATE', [ids]);
        ejecucion = tareas(e).marcarVencidos();
        const sinEsperar = await Promise.race([
          ejecucion,
          new Promise<string>((r) => {
            temporizador = setTimeout(() => r('bloqueada'), 8000);
          }),
        ]);
        expect(sinEsperar).toBe(0);
        expect(
          (await Promise.all(ids.map((id) => filaSeguimiento(e, id)))).map((f) => f.estado),
        ).toEqual(['programado', 'programado', 'programado']);
        expect(eventosDe(FollowUpOverdue, ids)).toEqual([]);
      } finally {
        clearTimeout(temporizador);
        await otra.rollbackTransaction();
        await otra.release();
        await ejecucion;
      }
      expect(await tareas(e).marcarVencidos()).toBe(3);
      expect(eventosDe(FollowUpOverdue, ids)).toHaveLength(3);
      expect(await tareas(e).marcarVencidos()).toBe(0);
    });

    it('un realizado no vuelve a vencido y un vencido todavía puede cerrarse', async () => {
      const { adopcionId } = await nueva('Estados');
      const pendiente = await insertar(adopcionId, 'visita', -4);
      const cerrado = await insertar(adopcionId, 'visita', -5);
      await resultado(F1, cerrado).expect(200);
      await tareas(e).marcarVencidos();
      expect((await filaSeguimiento(e, cerrado)).estado).toBe('realizado');
      expect((await filaSeguimiento(e, pendiente)).estado).toBe('vencido');
      await resultado(F1, pendiente).expect(200);
      expect((await filaSeguimiento(e, pendiente)).estado).toBe('realizado');
      await tareas(e).marcarVencidos();
      expect((await filaSeguimiento(e, pendiente)).estado).toBe('realizado');
    });
  });

  describe('cron de recordatorios', () => {
    beforeEach(aislarTareas);

    it('avisa una sola vez de los que vencen entre hoy y hoy+3 y deja constancia', async () => {
      const { adopcionId } = await nueva('Recordatorios');
      const hoy = await insertar(adopcionId, 'visita', 0);
      const tres = await insertar(adopcionId, 'visita', 3);
      const cuatro = await insertar(adopcionId, 'visita', 4);
      const pasado = await insertar(adopcionId, 'visita', -2);
      const realizado = await insertar(adopcionId, 'visita', 1, 'realizado');
      expect(await tareas(e).emitirRecordatorios()).toBe(2);
      expect(await tareas(e).emitirRecordatorios()).toBe(0);
      const recibidos = deTipo(capturados, FollowUpReminder);
      expect(recibidos.map((c) => c.payload.seguimientoId).sort()).toEqual([hoy, tres].sort());
      const de = (id: number) =>
        recibidos.find((c) => c.payload.seguimientoId === id)!
          .payload as unknown as FollowUpReminder;
      expect(de(hoy).diasRestantes).toBe(0);
      expect(de(tres).diasRestantes).toBe(3);
      expect(de(tres).fechaProgramada.toISOString()).toBe(`${fechaBogota(3)}T05:00:00.000Z`);
      expect((await filaSeguimiento(e, hoy)).recordatorio_enviado_en).not.toBeNull();
      for (const id of [cuatro, pasado, realizado]) {
        expect((await filaSeguimiento(e, id)).recordatorio_enviado_en).toBeNull();
      }
      // Mañana el de hoy+4 entra en la ventana; los ya avisados no se repiten.
      reloj.fijar(`${fechaBogota(1)}T12:00:00-05:00`);
      vaciar();
      expect(await tareas(e).emitirRecordatorios()).toBe(1);
      expect(deTipo(capturados, FollowUpReminder)[0].payload.seguimientoId).toBe(cuatro);
    });

    it('dos ejecuciones concurrentes avisan una sola vez de cada seguimiento', async () => {
      const { adopcionId } = await nueva('Recordatorios concurrentes');
      const ids = [
        await insertar(adopcionId, 'visita', 1),
        await insertar(adopcionId, 'visita', 2),
        await insertar(adopcionId, 'reporte', 2),
      ];
      const [a, b] = await Promise.all([
        tareas(e).emitirRecordatorios(),
        tareas(e).emitirRecordatorios(),
      ]);
      expect(a + b).toBe(3);
      expect(eventosDe(FollowUpReminder, ids).sort()).toEqual([...ids].sort());
    });
  });

  // ───────────────────────── cierre de adopción (B-32) ─────────────────────────
  describe('cierre de adopción', () => {
    it('revocar a disponible: cancela pendientes, libera la mascota y el cron deja de generar eventos', async () => {
      const { adopcionId, mascotaId } = await nueva('Revocada');
      const prog = await insertar(adopcionId, 'visita', 5);
      const venc = await insertar(adopcionId, 'visita', -3, 'vencido');
      const prog2 = await insertar(adopcionId, 'reporte', 1);
      const hecho = await insertar(adopcionId, 'visita', -9, 'realizado');
      expect(await estadoMascota(e, mascotaId)).toBe('adoptada');
      const res = await cierre(F1, adopcionId, {
        estado: 'revocada',
        motivo: '  Maltrato animal  ',
        mascotaDestino: 'disponible',
      }).expect(200);
      expect(res.body).toMatchObject({
        id: adopcionId,
        estado: 'revocada',
        motivoCierre: 'Maltrato animal',
      });
      expect(res.body.fechaCierre).toEqual(expect.any(String));
      expect(await estadoMascota(e, mascotaId)).toBe('disponible');
      const fila = await estadoAdopcion(e, adopcionId);
      expect(fila).toMatchObject({ estado: 'revocada', motivo_cierre: 'Maltrato animal' });
      expect(fila.fecha_cierre).not.toBeNull();
      expect(
        (await Promise.all([prog, venc, prog2, hecho].map((id) => filaSeguimiento(e, id)))).map(
          (f) => f.estado,
        ),
      ).toEqual(['cancelado', 'cancelado', 'cancelado', 'realizado']);
      // La respuesta ya trae los seguimientos cancelados.
      expect(res.body.seguimientos.map((s: { estado: string }) => s.estado).sort()).toEqual([
        'cancelado',
        'cancelado',
        'cancelado',
        'realizado',
      ]);
      // Sin vencimientos, recordatorios ni alertas para lo cancelado.
      reloj.fijar(`${fechaBogota(10)}T12:00:00-05:00`);
      await tareas(e).marcarVencidos();
      await tareas(e).emitirRecordatorios();
      expect(eventosDe(FollowUpOverdue, [prog, venc, prog2, hecho])).toEqual([]);
      expect(eventosDe(FollowUpReminder, [prog, venc, prog2, hecho])).toEqual([]);
      // La mascota reaparece en el catálogo y admite una nueva adopción.
      await e.get(`/mascotas/${mascotaId}`).expect(200);
      const nuevaSolicitud = (await ENVIAR_FORMULARIO(e, Ad2, mascotaId, PDF).expect(201)).body
        .id as number;
      await con(e.patch(`/solicitudes/${nuevaSolicitud}/decision`), F1.access)
        .send({ decision: 'aprobar', fechaEntrega: fechaBogota(0) })
        .expect(200);
      expect(await estadoMascota(e, mascotaId)).toBe('adoptada');
    });

    it('revocar a inactiva deja la mascota inactiva y fuera del catálogo', async () => {
      const { adopcionId, mascotaId } = await nueva('Inactiva');
      await cierre(F1, adopcionId, {
        estado: 'revocada',
        motivo: 'No procede',
        mascotaDestino: 'inactiva',
      }).expect(200);
      expect(await estadoMascota(e, mascotaId)).toBe('inactiva');
      await e.get(`/mascotas/${mascotaId}`).expect(404);
    });

    it('finalizar no toca la mascota, ignora el destino y cancela los pendientes', async () => {
      const { adopcionId, mascotaId } = await nueva('Finalizada');
      const id = await insertar(adopcionId, 'visita', 6);
      const res = await cierre(F1, adopcionId, {
        estado: 'finalizada',
        motivo: 'Seguimiento completo',
        mascotaDestino: 'disponible',
      }).expect(200);
      expect(res.body.estado).toBe('finalizada');
      expect(await estadoMascota(e, mascotaId)).toBe('adoptada');
      expect((await filaSeguimiento(e, id)).estado).toBe('cancelado');
    });

    it('no se reabre ni se opera sobre una adopción cerrada: 409 al repetir, programar, reportar o cerrar', async () => {
      const { adopcionId } = await nueva('Cerrada');
      const rep = await insertar(adopcionId, 'reporte', 6);
      await cierre(F1, adopcionId, { estado: 'finalizada', motivo: 'Fin' }).expect(200);
      const repetido = await cierre(F1, adopcionId, {
        estado: 'revocada',
        motivo: 'x',
        mascotaDestino: 'disponible',
      }).expect(409);
      expect(repetido.body.message).toBe('La adopción ya está finalizada');
      await programar(F1, adopcionId, { tipo: 'visita', fechaProgramada: fechaBogota(9) }).expect(
        409,
      );
      await reportar(rep, 1).expect(409);
      await resultado(F1, rep).expect(409);
      expect((await filaSeguimiento(e, rep)).estado).toBe('cancelado');
      await discoIgualABase(e);
    });

    it('datos inválidos, ajena, inexistente y roles', async () => {
      const { adopcionId, mascotaId } = await nueva('Validaciones');
      const id = await insertar(adopcionId, 'visita', 6);
      await cierre(F1, adopcionId, { estado: 'revocada', motivo: 'x' }).expect(400);
      await cierre(F1, adopcionId, {
        estado: 'revocada',
        motivo: 'x',
        mascotaDestino: 'adoptada',
      }).expect(400);
      await cierre(F1, adopcionId, { estado: 'finalizada', motivo: '   ' }).expect(400);
      await cierre(F1, adopcionId, { estado: 'finalizada' }).expect(400);
      await cierre(F1, adopcionId, { estado: 'finalizada', motivo: 'x'.repeat(301) }).expect(400);
      await cierre(F1, adopcionId, { estado: 'activa', motivo: 'x' }).expect(400);
      await cierre(F1, 0, { estado: 'finalizada', motivo: 'x' }).expect(400);
      const ajena = await cierre(F2, adopcionId, { estado: 'finalizada', motivo: 'x' }).expect(404);
      const inexistente = await cierre(F1, 999999, { estado: 'finalizada', motivo: 'x' }).expect(
        404,
      );
      expect(ajena.body.message).toBe(inexistente.body.message);
      await con(e.patch(`/adopciones/${adopcionId}/estado`), Ad1.access)
        .send({ estado: 'finalizada', motivo: 'x' })
        .expect(403);
      await e
        .patch(`/adopciones/${adopcionId}/estado`)
        .send({ estado: 'finalizada', motivo: 'x' })
        .expect(401);
      expect((await estadoAdopcion(e, adopcionId)).estado).toBe('activa');
      expect(await estadoMascota(e, mascotaId)).toBe('adoptada');
      expect((await filaSeguimiento(e, id)).estado).toBe('programado');
    });

    describe('atomicidad con fallos inyectados', () => {
      const casos: [string, () => jest.SpyInstance][] = [
        [
          'al registrar el cierre',
          () => jest.spyOn(e.app.get(AdopcionesService), 'registrarCierre'),
        ],
        ['al devolver la mascota', () => jest.spyOn(e.app.get(MascotasService), 'transicionar')],
        [
          'al cancelar los seguimientos',
          () => jest.spyOn(e.app.get(SeguimientosService), 'cancelarPendientesDeAdopcion'),
        ],
      ];
      it.each(casos)('un fallo %s no deja ningún cambio parcial ni eventos', async (_, espiar) => {
        const { adopcionId, mascotaId } = await nueva('Atómico');
        const ids = [
          await insertar(adopcionId, 'visita', 5),
          await insertar(adopcionId, 'visita', -2, 'vencido'),
        ];
        const espia = espiar().mockRejectedValueOnce(new Error('fallo inyectado'));
        try {
          await cierre(F1, adopcionId, {
            estado: 'revocada',
            motivo: 'Maltrato',
            mascotaDestino: 'disponible',
          }).expect(500);
        } finally {
          espia.mockRestore();
        }
        expect(await estadoAdopcion(e, adopcionId)).toMatchObject({
          estado: 'activa',
          motivo_cierre: null,
          fecha_cierre: null,
        });
        expect(await estadoMascota(e, mascotaId)).toBe('adoptada');
        expect(await estadosDeAdopcion(e, adopcionId)).toEqual(['programado', 'vencido']);
        expect(eventosDe(FollowUpOverdue, ids)).toEqual([]);
        expect(capturados).toHaveLength(0);
        // Y el reintento, sin fallo, sí cierra.
        await cierre(F1, adopcionId, {
          estado: 'revocada',
          motivo: 'Maltrato',
          mascotaDestino: 'disponible',
        }).expect(200);
        expect(await estadoMascota(e, mascotaId)).toBe('disponible');
        expect(await estadosDeAdopcion(e, adopcionId)).toEqual(['cancelado', 'cancelado']);
      });
    });
  });
});
