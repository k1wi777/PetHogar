import 'reflect-metadata';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdoptionApproved, WellbeingAlertRaised } from '../../src/common/events';
import { MAIL_TRANSPORT } from '../../src/modules/mail/mail.module';
import { AvisosService } from '../../src/modules/avisos/avisos.service';
import { NotificacionesService } from '../../src/modules/notificaciones/notificaciones.service';
import { ADMIN, arrancarEntorno, CLAVE, type Entorno } from '../auth/helpers';
import {
  adopcionActiva,
  adoptanteConSesion,
  type AdoptantePrueba,
  con,
  contar,
  correosConAsunto,
  ENVIAR_FORMULARIO,
  esperarCorreos,
  esperarHasta,
  esperarNotificacion,
  fechaBogota,
  fundacionAprobada,
  type FundacionPrueba,
  mascotaPublicada,
  mensajesPara,
  notificacionesConClave,
  notificacionesDe,
  PDF,
  PROHIBIDAS_V14,
  relojSimulado,
  tareas,
  usuarioIdDe,
  usuarioIdDeFundacion,
  violacionesDeClaves,
} from './helpers';

// V14 (avisos y notificaciones): B-35 y B-36 con eventos reales sobre la AppModule real. Los
// listeners son asíncronos: se espera por sondeo (BD y API HTTP de Mailpit) con tiempo máximo.
describe('V14 — avisos por eventos y notificaciones (Postgres, Mailpit y disco)', () => {
  let e: Entorno;
  let F1: FundacionPrueba;
  let Ad1: AdoptantePrueba;
  let Ad2: AdoptantePrueba;
  let admin: string;
  let razaId: number;
  let usuarioF1: number;
  let usuarioAd1: number;
  let usuarioAd2: number;
  let usuarioAdmin: number;
  let admin2: number;
  let admin3Inactivo: number;
  const respuestas: unknown[] = [];

  const solicitar = async (ad: AdoptantePrueba, mascotaId: number): Promise<number> =>
    (await ENVIAR_FORMULARIO(e, ad, mascotaId, PDF).expect(201)).body.id as number;
  const decidir = (solicitudId: number, cuerpo: object) =>
    con(e.patch(`/solicitudes/${solicitudId}/decision`), F1.access).send(cuerpo);
  const aprobar = (solicitudId: number) =>
    decidir(solicitudId, { decision: 'aprobar', fechaEntrega: fechaBogota(0) });
  const total = (sql: string, params: unknown[] = []) => contar(e, sql, params);
  const nuevoAdmin = async (activo: boolean): Promise<number> => {
    const email = e.nuevoCorreo();
    const [{ id }]: { id: number }[] = await e.ds.query(
      `INSERT INTO usuario (rol_id, email, contrasena, telefono, activo, email_verificado)
       SELECT id, $1, 'hash-no-usable', '3000000001', $2, true FROM rol WHERE nombre = 'administrador'
       RETURNING id`,
      [email, activo],
    );
    return id;
  };
  const nuevaFundacionPendiente = async (nombre: string) => {
    const email = e.nuevoCorreo();
    const nit = `98${e.sufijo}${Math.floor(Math.random() * 1000)}`.slice(0, 20);
    await e.registrarFundacion(email, nit, nombre).expect(201);
    await e.ds.query('UPDATE usuario SET email_verificado = true WHERE email = $1', [email]);
    const [{ id }]: { id: number }[] = await e.ds.query('SELECT id FROM fundacion WHERE nit = $1', [
      nit,
    ]);
    return {
      id,
      email,
      usuarioId: await usuarioIdDe(e, email),
      access: (await e.sesion(email)).access,
    };
  };
  const validar = (fundacionId: number, cuerpo: object) =>
    con(e.patch(`/admin/fundaciones/${fundacionId}/validacion`), admin).send(cuerpo);

  beforeAll(async () => {
    process.env.SEGUIMIENTOS_CRON_HABILITADO = 'false';
    e = await arrancarEntorno();
    admin = (await e.sesion(ADMIN.email, ADMIN.clave)).access;
    F1 = await fundacionAprobada(e, 'Cali');
    [Ad1, Ad2] = [await adoptanteConSesion(e), await adoptanteConSesion(e)];
    [{ id: razaId }] = await e.ds.query('SELECT id FROM raza ORDER BY id LIMIT 1');
    usuarioF1 = await usuarioIdDeFundacion(e, F1.id);
    [usuarioAd1, usuarioAd2, usuarioAdmin] = await Promise.all([
      usuarioIdDe(e, Ad1.email),
      usuarioIdDe(e, Ad2.email),
      usuarioIdDe(e, ADMIN.email),
    ]);
    admin2 = await nuevoAdmin(true);
    admin3Inactivo = await nuevoAdmin(false);
  });
  afterAll(() => e?.cerrar());

  // ───────────────────────── solicitudes y adopciones ─────────────────────────
  describe('solicitudes y adopciones', () => {
    let mascota: number;
    let S1: number;
    let S2: number;

    it('crear solicitudes avisa a la fundación (sin el nombre del adoptante) y no envía correo', async () => {
      mascota = await mascotaPublicada(e, F1, razaId, 'Luna');
      S1 = await solicitar(Ad1, mascota);
      S2 = await solicitar(Ad2, mascota);
      for (const s of [S1, S2]) {
        const n = await esperarNotificacion(e, usuarioF1, `adoption-request.created:${s}`);
        expect(n).toMatchObject({
          tipo: 'solicitud',
          entidad: 'solicitud',
          entidad_id: s,
          mensaje: 'Nueva solicitud para Luna.',
          leida: false,
        });
        expect(n.mensaje).not.toMatch(/Ana|Pérez/);
      }
      expect(await correosConAsunto(F1.email, 'Nueva solicitud de adopción')).toEqual([]);
    });

    it('aprobar avisa al ADOPTANTE (notificación y correo) y no a la fundación; la rival recibe el rechazo automático', async () => {
      await aprobar(S1).expect(200);

      const aprobada = await esperarNotificacion(e, usuarioAd1, `adoption.approved:${S1}`);
      expect(aprobada).toMatchObject({ tipo: 'solicitud', entidad: 'solicitud', entidad_id: S1 });
      expect(aprobada.mensaje).toContain('Luna');
      const [correo] = await esperarCorreos(Ad1.email, 'Tu solicitud fue aprobada', 1);
      expect(correo.texto).toContain('Luna');
      expect(correo.texto).toContain('http://localhost:3000/notificaciones');

      // El aviso de la aprobación NO va a la fundación que la decidió.
      expect(
        await total(
          `SELECT count(*) AS n FROM notificacion WHERE usuario_id = $1 AND clave LIKE 'adoption.approved:%'`,
          [usuarioF1],
        ),
      ).toBe(0);
      expect(await correosConAsunto(F1.email, 'Tu solicitud fue aprobada')).toEqual([]);

      // La rival (rechazo automático): sin la observación interna, con correo.
      const rechazada = await esperarNotificacion(e, usuarioAd2, `adoption.rejected:${S2}`);
      expect(rechazada.mensaje).toContain('ya fue adoptada');
      expect(rechazada.mensaje).not.toContain('aprobó otra solicitud.'.toUpperCase());
      await esperarCorreos(Ad2.email, 'Tu solicitud no fue aceptada', 1);
      // La aprobada no recibe un rechazo.
      expect(
        await total(
          `SELECT count(*) AS n FROM notificacion WHERE usuario_id = $1 AND clave LIKE 'adoption.rejected:%'`,
          [usuarioAd1],
        ),
      ).toBe(0);
    });

    it('rechazo manual con observación: solo la recibe el adoptante autor, con correo', async () => {
      const m2 = await mascotaPublicada(e, F1, razaId, 'Rocky');
      const s3 = await solicitar(Ad1, m2);
      const obs = 'No cumple el perfil: vivienda sin patio cercado';
      await decidir(s3, { decision: 'rechazar', observacion: obs }).expect(200);

      const n = await esperarNotificacion(e, usuarioAd1, `adoption.rejected:${s3}`);
      expect(n.mensaje).toContain(obs);
      expect(n.mensaje).toContain('Rocky');
      const [correo] = await esperarCorreos(Ad1.email, 'Tu solicitud fue rechazada', 1);
      expect(correo.texto).toContain(obs);
      // Nadie más (otro adoptante, fundación, administradores) ve la observación.
      expect(
        await total(
          `SELECT count(*) AS n FROM notificacion WHERE mensaje LIKE '%vivienda sin patio%'`,
        ),
      ).toBe(1);
      expect(
        await mensajesPara(Ad2.email).then((l) => l.filter((m) => m.texto.includes('patio'))),
      ).toEqual([]);
    });
  });

  // ───────────────────────── fundaciones ─────────────────────────
  describe('fundaciones', () => {
    it('registrar una fundación avisa a todos los administradores ACTIVOS y no a la cuenta desactivada', async () => {
      const f = await nuevaFundacionPendiente('Patitas del Sur');
      const clave = `foundation.registered:${f.id}`;
      for (const id of [usuarioAdmin, admin2]) {
        const n = await esperarNotificacion(e, id, clave);
        expect(n).toMatchObject({ tipo: 'validacion', entidad: 'fundacion', entidad_id: f.id });
        expect(n.mensaje).toContain('Patitas del Sur');
      }
      expect(await notificacionesConClave(e, admin3Inactivo, clave)).toEqual([]);
      expect(await notificacionesConClave(e, f.usuarioId, clave)).toEqual([]);
      expect(await notificacionesConClave(e, usuarioF1, clave)).toEqual([]);
    });

    it('decidir la validación avisa a la fundación con correo; rechazada y luego aprobada generan dos avisos', async () => {
      const f = await nuevaFundacionPendiente('Huellas del Norte');
      await validar(f.id, { decision: 'rechazada', observacion: 'Falta el RUT vigente' }).expect(
        200,
      );

      const rechazo = await esperarNotificacion(
        e,
        f.usuarioId,
        `foundation.validated:${f.id}:rechazada`,
      );
      expect(rechazo).toMatchObject({ tipo: 'validacion', entidad: 'fundacion', entidad_id: f.id });
      expect(rechazo.mensaje).toContain('Falta el RUT vigente');
      const [correoRechazo] = await esperarCorreos(f.email, 'Tu fundación fue rechazada', 1);
      expect(correoRechazo.texto).toContain('Falta el RUT vigente');
      expect(correoRechazo.texto).toContain('Huellas del Norte');

      // Una fundación rechazada puede ver el resultado aunque no esté aprobada.
      const antes = await con(e.get('/notificaciones'), f.access).expect(200);
      expect(antes.body.data.map((n: { titulo: string }) => n.titulo)).toContain(
        'Tu fundación fue rechazada',
      );

      await validar(f.id, { decision: 'aprobada' }).expect(200);
      await esperarNotificacion(e, f.usuarioId, `foundation.validated:${f.id}:aprobada`);
      await esperarCorreos(f.email, 'Tu fundación fue aprobada', 1);
      expect(await notificacionesDe(e, f.usuarioId)).toHaveLength(2);
      // Ningún administrador recibe correo por la decisión.
      expect(await mensajesPara('admin@pethogar.local')).toEqual([]);
    });
  });

  // ───────────────────────── seguimientos y cierre de adopción ─────────────────────────
  describe('seguimientos y cierre', () => {
    let A: number; // adopción activa de Ad1 con F1
    const programar = (cuerpo: object) =>
      con(e.post(`/adopciones/${A}/seguimientos`), F1.access).send(cuerpo);
    const resultado = (id: number, campos: Record<string, string>) => {
      const r = con(e.patch(`/seguimientos/${id}/resultado`), F1.access);
      for (const [k, v] of Object.entries({ fechaRealizada: fechaBogota(0), ...campos }))
        r.field(k, v);
      return r;
    };
    const eventosAlerta: WellbeingAlertRaised[] = [];

    beforeAll(async () => {
      ({ adopcionId: A } = await adopcionActiva(e, F1, Ad1, razaId, 'Firulais'));
      e.app.get(EventEmitter2).on(WellbeingAlertRaised.eventName, (ev: WellbeingAlertRaised) => {
        eventosAlerta.push(ev);
      });
    });

    it('programar avisa al adoptante (notificación y correo) y no a la fundación', async () => {
      const res = await programar({ tipo: 'visita', fechaProgramada: fechaBogota(5) }).expect(201);
      const n = await esperarNotificacion(e, usuarioAd1, `follow-up.scheduled:${res.body.id}`);
      expect(n).toMatchObject({
        tipo: 'seguimiento',
        entidad: 'seguimiento',
        entidad_id: res.body.id,
      });
      expect(n.mensaje).toMatch(
        /^Refugio Cali programó una visita para Firulais el \d{1,2} de \w+ de 20\d\d\.$/,
      );
      const [correo] = await esperarCorreos(Ad1.email, 'Seguimiento programado', 1);
      expect(correo.texto).toContain('Firulais');
      expect(
        await notificacionesConClave(e, usuarioF1, `follow-up.scheduled:${res.body.id}`),
      ).toEqual([]);
    });

    it('el reporte del adoptante avisa a la fundación, sin correo y sin avisar al propio adoptante', async () => {
      const prog = await programar({ tipo: 'reporte', fechaProgramada: fechaBogota(20) }).expect(
        201,
      );
      await con(e.post(`/seguimientos/${prog.body.id}/reporte`), Ad1.access)
        .field('comentarios', 'Se adaptó muy bien, come y juega')
        .expect(201);
      const n = await esperarNotificacion(
        e,
        usuarioF1,
        `follow-up.report-received:${prog.body.id}`,
      );
      expect(n.mensaje).toBe('El adoptante de Firulais envió su reporte de seguimiento.');
      expect(n.mensaje).not.toContain('Se adaptó');
      expect(
        await notificacionesConClave(e, usuarioAd1, `follow-up.report-received:${prog.body.id}`),
      ).toEqual([]);
      expect(await correosConAsunto(F1.email, 'Reporte de seguimiento recibido')).toEqual([]);
    });

    it('alerta de bienestar (malo): fundación y administradores activos; sin valoración ni observaciones; bueno/regular no alertan', async () => {
      const bueno = (
        await programar({ tipo: 'visita', fechaProgramada: fechaBogota(1) }).expect(201)
      ).body.id;
      const regular = (
        await programar({ tipo: 'visita', fechaProgramada: fechaBogota(2) }).expect(201)
      ).body.id;
      const malo = (
        await programar({ tipo: 'visita', fechaProgramada: fechaBogota(3) }).expect(201)
      ).body.id;
      const OBS = 'OBSERVACION-PRIVADA-X: el perro está desnutrido';

      eventosAlerta.length = 0;
      await resultado(bueno, { estadoBienestar: 'bueno', observaciones: OBS }).expect(200);
      await resultado(regular, { estadoBienestar: 'regular', observaciones: OBS }).expect(200);
      expect(eventosAlerta).toHaveLength(0);
      for (const id of [bueno, regular]) {
        for (const u of [usuarioF1, usuarioAdmin, admin2]) {
          expect(await notificacionesConClave(e, u, `wellbeing-alert.raised:${id}`)).toEqual([]);
        }
      }

      await resultado(malo, { estadoBienestar: 'malo', observaciones: OBS }).expect(200);
      const clave = `wellbeing-alert.raised:${malo}`;
      const aFundacion = await esperarNotificacion(e, usuarioF1, clave);
      const aAdmin = await esperarNotificacion(e, usuarioAdmin, clave);
      const aAdmin2 = await esperarNotificacion(e, admin2, clave);
      expect(aFundacion).toMatchObject({ entidad: 'seguimiento', entidad_id: malo });
      expect(aAdmin).toMatchObject({ entidad: 'fundacion', entidad_id: F1.id });
      expect(aAdmin2.mensaje).toContain('Firulais');
      expect(await notificacionesConClave(e, admin3Inactivo, clave)).toEqual([]);
      expect(await notificacionesConClave(e, usuarioAd1, clave)).toEqual([]);
      // Ni la valoración ni la observación aparecen en ningún aviso ni correo de nadie.
      expect(
        await total(
          `SELECT count(*) AS n FROM notificacion WHERE mensaje ILIKE '%OBSERVACION-PRIVADA-X%' OR mensaje ILIKE '%desnutrido%' OR mensaje ~* '\\mmalo\\M'`,
        ),
      ).toBe(0);
      for (const correo of [Ad1.email, F1.email]) {
        expect(
          (await mensajesPara(correo)).filter((m) => m.texto.includes('OBSERVACION-PRIVADA-X')),
        ).toEqual([]);
      }
    });

    it('recordatorio y vencimiento (cron con reloj simulado): adoptante con correo; fundación solo la campana', async () => {
      const reloj = relojSimulado(e);
      const proximo = (
        await programar({ tipo: 'visita', fechaProgramada: fechaBogota(6) }).expect(201)
      ).body.id;
      reloj.fijar(`${fechaBogota(5)}T09:00:00-05:00`); // faltan 1 día
      expect(await tareas(e).emitirRecordatorios()).toBeGreaterThanOrEqual(1);
      const recordatorio = await esperarNotificacion(
        e,
        usuarioAd1,
        `follow-up.reminder:${proximo}`,
      );
      expect(recordatorio.mensaje).toContain('vence mañana');
      await esperarCorreos(Ad1.email, 'Tu seguimiento está por vencer', 1);
      expect(await tareas(e).emitirRecordatorios()).toBe(0); // una sola vez
      expect(await notificacionesConClave(e, usuarioF1, `follow-up.reminder:${proximo}`)).toEqual(
        [],
      );

      reloj.fijar(`${fechaBogota(7)}T09:00:00-05:00`);
      const vencidos = await tareas(e).marcarVencidos();
      expect(vencidos).toBeGreaterThanOrEqual(1);
      const alAdoptante = await esperarNotificacion(e, usuarioAd1, `follow-up.overdue:${proximo}`);
      expect(alAdoptante.mensaje).toContain('Envía tu reporte');
      const alaFundacion = await esperarNotificacion(e, usuarioF1, `follow-up.overdue:${proximo}`);
      expect(alaFundacion.mensaje).toBe('Seguimiento vencido de Firulais.');
      await esperarCorreos(Ad1.email, 'Seguimiento vencido', 1);
      expect(await correosConAsunto(F1.email, 'Seguimiento vencido')).toEqual([]);
      reloj.fijar(null);
    });

    it('cerrar la adopción avisa al adoptante, sin el motivo y sin correo', async () => {
      const { adopcionId } = await adopcionActiva(e, F1, Ad2, razaId, 'Toby');
      const MOTIVO = 'MOTIVO-PRIVADO-DEL-CIERRE: maltrato comprobado';
      await con(e.patch(`/adopciones/${adopcionId}/estado`), F1.access)
        .send({ estado: 'revocada', motivo: MOTIVO, mascotaDestino: 'disponible' })
        .expect(200);
      const n = await esperarNotificacion(e, usuarioAd2, `adoption.closed:${adopcionId}`);
      expect(n).toMatchObject({ tipo: 'adopcion', entidad: 'adopcion', entidad_id: adopcionId });
      expect(n.titulo).toBe('Tu adopción fue revocada');
      expect(n.mensaje).not.toMatch(/MOTIVO-PRIVADO|maltrato/);
      expect(
        await total(`SELECT count(*) AS n FROM notificacion WHERE mensaje LIKE '%MOTIVO-PRIVADO%'`),
      ).toBe(0);
      expect(await correosConAsunto(Ad2.email, 'Tu adopción fue revocada')).toEqual([]);

      const { adopcionId: otra } = await adopcionActiva(e, F1, Ad2, razaId, 'Nube');
      await con(e.patch(`/adopciones/${otra}/estado`), F1.access)
        .send({ estado: 'finalizada', motivo: 'Todo en orden' })
        .expect(200);
      const f = await esperarNotificacion(e, usuarioAd2, `adoption.closed:${otra}`);
      expect(f.titulo).toBe('Tu adopción fue finalizada');
    });
  });

  // ───────────────────────── donaciones por evento ─────────────────────────
  describe('donación (evento real)', () => {
    it('una donación avisa a la fundación y al donante (con correo) una sola vez', async () => {
      const res = await con(e.post('/donaciones'), Ad1.access)
        .field('fundacionId', String(F1.id))
        .field('tipo', 'especie')
        .field('descripcion', 'Tres cobijas')
        .expect(201);
      const clave = `donation.registered:${res.body.id}`;
      const aFundacion = await esperarNotificacion(e, usuarioF1, clave);
      expect(aFundacion.mensaje).toBe('Recibiste una donación en especie.');
      const aDonante = await esperarNotificacion(e, usuarioAd1, clave);
      expect(aDonante.mensaje).toContain('Refugio Cali');
      const [correo] = await esperarCorreos(Ad1.email, 'Confirmamos tu donación en PetHogar', 1);
      expect(correo.texto).toContain('Tres cobijas');
    });
  });

  // ───────────────────────── idempotencia y aislamiento de fallos ─────────────────────────
  describe('idempotencia y fallos', () => {
    it('emitir dos veces el mismo evento deja 1 notificación y 1 correo', async () => {
      const Ad = await adoptanteConSesion(e);
      const usuarioAd = await usuarioIdDe(e, Ad.email);
      const m = await mascotaPublicada(e, F1, razaId, 'Duplicada');
      const s = await solicitar(Ad, m);
      await aprobar(s).expect(200);
      const clave = `adoption.approved:${s}`;
      await esperarNotificacion(e, usuarioAd, clave);
      await esperarCorreos(Ad.email, 'Tu solicitud fue aprobada', 1);

      const [{ id: adopcionId }]: { id: number }[] = await e.ds.query(
        'SELECT id FROM adopcion WHERE solicitud_id = $1',
        [s],
      );
      const evento = new AdoptionApproved(s, adopcionId, m, F1.id, Ad.id);
      const bus = e.app.get(EventEmitter2);
      await bus.emitAsync(AdoptionApproved.eventName, evento);
      await bus.emitAsync(AdoptionApproved.eventName, evento);
      await Promise.all([
        bus.emitAsync(AdoptionApproved.eventName, evento),
        bus.emitAsync(AdoptionApproved.eventName, evento),
      ]);

      expect(await notificacionesConClave(e, usuarioAd, clave)).toHaveLength(1);
      expect(await correosConAsunto(Ad.email, 'Tu solicitud fue aprobada')).toHaveLength(1);
    });

    it('con el SMTP caído la operación responde bien y la notificación existe', async () => {
      const Ad = await adoptanteConSesion(e);
      const usuarioAd = await usuarioIdDe(e, Ad.email);
      const m = await mascotaPublicada(e, F1, razaId, 'SinCorreo');
      const s = await solicitar(Ad, m);
      const transporte = e.app.get<{ sendMail: (...a: unknown[]) => Promise<unknown> }>(
        MAIL_TRANSPORT,
        {
          strict: false,
        },
      );
      const espia = jest.spyOn(transporte, 'sendMail').mockRejectedValue(new Error('ECONNREFUSED'));
      try {
        await aprobar(s).expect(200);
        const n = await esperarNotificacion(e, usuarioAd, `adoption.approved:${s}`);
        expect(n.tipo).toBe('solicitud');
        await esperarHasta(
          async () => espia.mock.calls.some((c) => JSON.stringify(c).includes(Ad.email)),
          'intento de envío con el SMTP caído',
        );
        expect(await correosConAsunto(Ad.email, 'Tu solicitud fue aprobada')).toEqual([]);
        expect(await total('SELECT count(*) AS n FROM adopcion WHERE solicitud_id = $1', [s])).toBe(
          1,
        );
      } finally {
        espia.mockRestore();
      }
    });

    it('un listener que lanza no rompe al emisor ni a los demás avisos', async () => {
      const bus = e.app.get(EventEmitter2);
      const avisos = e.app.get(AvisosService);
      const rota = jest
        .spyOn(avisos, 'solicitudAprobada')
        .mockRejectedValue(new Error('listener roto'));
      const sincrono = (): never => {
        throw new Error('listener síncrono roto');
      };
      bus.on(AdoptionApproved.eventName, sincrono);
      try {
        const Ad = await adoptanteConSesion(e);
        const usuarioAd = await usuarioIdDe(e, Ad.email);
        const m = await mascotaPublicada(e, F1, razaId, 'Fallo');
        const s = await solicitar(Ad, m);
        // La respuesta de la operación principal es la normal.
        await aprobar(s).expect(200);
        expect(await total('SELECT count(*) AS n FROM adopcion WHERE solicitud_id = $1', [s])).toBe(
          1,
        );
        await esperarHasta(
          async () => e.textoLogs().includes('listener roto'),
          'registro del listener roto en el log',
        );
        expect(await notificacionesConClave(e, usuarioAd, `adoption.approved:${s}`)).toEqual([]);

        // Otros avisos siguen funcionando: un rechazo llega a su destinatario.
        const Ad3 = await adoptanteConSesion(e);
        const m2 = await mascotaPublicada(e, F1, razaId, 'Otra');
        const s2 = await solicitar(Ad3, m2);
        await decidir(s2, { decision: 'rechazar', observacion: 'No cumple' }).expect(200);
        await esperarNotificacion(e, await usuarioIdDe(e, Ad3.email), `adoption.rejected:${s2}`);
      } finally {
        bus.off(AdoptionApproved.eventName, sincrono);
        rota.mockRestore();
      }
    });

    it('una cuenta desactivada no recibe notificaciones ni correos', async () => {
      const Ad = await adoptanteConSesion(e);
      const usuarioAd = await usuarioIdDe(e, Ad.email);
      const m = await mascotaPublicada(e, F1, razaId, 'Inactiva');
      const s = await solicitar(Ad, m);
      await e.ds.query('UPDATE usuario SET activo = false WHERE id = $1', [usuarioAd]);
      await aprobar(s).expect(200);
      // Otro destinatario del mismo tipo de evento sirve de marca de que ya se procesó.
      const Ad4 = await adoptanteConSesion(e);
      const m2 = await mascotaPublicada(e, F1, razaId, 'Marca');
      const s2 = await solicitar(Ad4, m2);
      await aprobar(s2).expect(200);
      await esperarNotificacion(e, await usuarioIdDe(e, Ad4.email), `adoption.approved:${s2}`);
      expect(await notificacionesDe(e, usuarioAd)).toEqual([]);
      expect(await correosConAsunto(Ad.email, 'Tu solicitud fue aprobada')).toEqual([]);
    });

    function decidir(solicitudId: number, cuerpo: object) {
      return con(e.patch(`/solicitudes/${solicitudId}/decision`), F1.access).send(cuerpo);
    }
    function aprobar(solicitudId: number) {
      return decidir(solicitudId, { decision: 'aprobar', fechaEntrega: fechaBogota(0) });
    }
    function solicitar(ad: AdoptantePrueba, mascotaId: number): Promise<number> {
      return ENVIAR_FORMULARIO(e, ad, mascotaId, PDF)
        .expect(201)
        .then((r) => r.body.id as number);
    }
  });

  // ───────────────────────── API de notificaciones (B-35) ─────────────────────────
  describe('API de notificaciones', () => {
    let Ad7: AdoptantePrueba;
    let Ad8: AdoptantePrueba;
    let usuario7: number;
    let usuario8: number;
    const idsDe7: number[] = [];

    const crear = (usuarioId: number, i: number) =>
      e.app.get(NotificacionesService).crear({
        usuarioId,
        tipo: i % 2 ? 'solicitud' : 'seguimiento',
        titulo: `Aviso ${i}`,
        mensaje: `Mensaje ${i}`,
        referencia: { tipo: i % 2 ? 'solicitud' : 'seguimiento', id: i + 1 },
        clave: `prueba.v14:${usuarioId}:${i}`,
      });
    const lista = (access: string, consulta = '', ip?: string) =>
      con(e.get(`/notificaciones${consulta}`, ip), access);
    const noLeidas = async (access: string): Promise<number> =>
      (await con(e.get('/notificaciones/no-leidas/count'), access).expect(200)).body.noLeidas;

    beforeAll(async () => {
      [Ad7, Ad8] = [await adoptanteConSesion(e), await adoptanteConSesion(e)];
      [usuario7, usuario8] = [await usuarioIdDe(e, Ad7.email), await usuarioIdDe(e, Ad8.email)];
      for (let i = 0; i < 25; i++) await crear(usuario7, i);
      for (let i = 0; i < 5; i++) await crear(usuario8, i);
      idsDe7.push(...(await notificacionesDe(e, usuario7)).map((n) => n.id));
    });

    it('lista solo las propias, paginadas, de la más reciente a la más antigua y con orden estable', async () => {
      const oraculo: { id: number }[] = await e.ds.query(
        'SELECT id FROM notificacion WHERE usuario_id = $1 ORDER BY fecha_creacion DESC, id DESC',
        [usuario7],
      );
      const vistos: number[] = [];
      for (let page = 1; page <= 3; page++) {
        const res = await lista(Ad7.access, `?page=${page}&limit=10`).expect(200);
        respuestas.push(res.body);
        expect(res.body).toMatchObject({ total: 25, page, limit: 10 });
        vistos.push(...res.body.data.map((n: { id: number }) => n.id));
      }
      expect(vistos).toEqual(oraculo.map((o) => o.id));
      expect(new Set(vistos).size).toBe(25);
      const primera = (await lista(Ad7.access, '?limit=1').expect(200)).body.data[0];
      expect(Object.keys(primera).sort()).toEqual([
        'fechaCreacion',
        'id',
        'leida',
        'mensaje',
        'referencia',
        'tipo',
        'titulo',
      ]);
      expect(primera.referencia).toEqual({ tipo: expect.any(String), id: expect.any(Number) });
      expect(violacionesDeClaves(respuestas, '$', PROHIBIDAS_V14)).toEqual([]);
      expect(JSON.stringify(respuestas)).not.toMatch(/prueba\.v14/);
    });

    it('filtra por leídas y no leídas y rechaza valores inválidos', async () => {
      expect((await lista(Ad7.access, '?leida=false&limit=100').expect(200)).body.total).toBe(25);
      expect((await lista(Ad7.access, '?leida=true&limit=100').expect(200)).body.total).toBe(0);
      await lista(Ad7.access, '?leida=quizas').expect(400);
      await lista(Ad7.access, '?limit=101').expect(400);
    });

    it('marcar una como leída es idempotente y el contador lo refleja de inmediato', async () => {
      expect(await noLeidas(Ad7.access)).toBe(25);
      const id = idsDe7[3];
      const primera = await con(e.patch(`/notificaciones/${id}/leida`), Ad7.access).expect(200);
      expect(primera.body).toMatchObject({ id, leida: true });
      expect(primera.body).not.toHaveProperty('usuarioId');
      expect(await noLeidas(Ad7.access)).toBe(24);
      const segunda = await con(e.patch(`/notificaciones/${id}/leida`), Ad7.access).expect(200);
      expect(segunda.body.leida).toBe(true);
      expect(await noLeidas(Ad7.access)).toBe(24);
      expect((await lista(Ad7.access, '?leida=true').expect(200)).body.total).toBe(1);
      expect((await lista(Ad7.access, '?leida=false&limit=100').expect(200)).body.total).toBe(24);
    });

    it('una notificación ajena responde el mismo 404 que una inexistente y no cambia', async () => {
      const ajena = await con(e.patch(`/notificaciones/${idsDe7[5]}/leida`), Ad8.access).expect(
        404,
      );
      const inexistente = await con(e.patch('/notificaciones/99999999/leida'), Ad8.access).expect(
        404,
      );
      expect(ajena.body.message).toBe('La notificación no existe');
      expect(inexistente.body.message).toBe(ajena.body.message);
      const [{ leida }]: { leida: boolean }[] = await e.ds.query(
        'SELECT leida FROM notificacion WHERE id = $1',
        [idsDe7[5]],
      );
      expect(leida).toBe(false);
      await con(e.patch('/notificaciones/0/leida'), Ad8.access).expect(400);
      await con(e.patch('/notificaciones/abc/leida'), Ad8.access).expect(400);
    });

    it('leer-todas solo toca las propias y es atómico bajo 5 llamadas simultáneas', async () => {
      const resultados = await Promise.all(
        Array.from({ length: 5 }, () => con(e.patch('/notificaciones/leer-todas'), Ad7.access)),
      );
      for (const r of resultados) expect(r.status).toBe(200);
      const cambiadas = resultados.map((r) => r.body.actualizadas as number);
      // Las 24 no leídas se marcan exactamente una vez entre todas las llamadas.
      expect(cambiadas.reduce((a, b) => a + b, 0)).toBe(24);
      expect(await noLeidas(Ad7.access)).toBe(0);
      expect(await noLeidas(Ad8.access)).toBe(5); // las de otro usuario, intactas
      const otra = await con(e.patch('/notificaciones/leer-todas'), Ad7.access).expect(200);
      expect(otra.body).toEqual({ actualizadas: 0 });
    });

    it('un usuario sin notificaciones recibe lista vacía, contador 0 y leer-todas 0', async () => {
      const sin = await adoptanteConSesion(e);
      const res = await lista(sin.access).expect(200);
      expect(res.body).toMatchObject({ data: [], total: 0 });
      expect(await noLeidas(sin.access)).toBe(0);
      expect(
        (await con(e.patch('/notificaciones/leer-todas'), sin.access).expect(200)).body,
      ).toEqual({
        actualizadas: 0,
      });
    });

    it('cualquier rol autenticado accede, también una fundación pendiente; sin sesión 401', async () => {
      const pendiente = await nuevaFundacionPendiente('Pendiente Notificaciones');
      await lista(pendiente.access).expect(200);
      expect(await noLeidas(pendiente.access)).toBeGreaterThanOrEqual(0);
      await lista(admin).expect(200);
      await lista(F1.access).expect(200);
      await e.get('/notificaciones').expect(401);
      await e.get('/notificaciones/no-leidas/count').expect(401);
      await e.patch('/notificaciones/leer-todas').expect(401);
      await e.patch('/notificaciones/1/leida').expect(401);
    });

    it('límites por IP: 120 por minuto al listar y 30 al leer todas', async () => {
      const sin = await adoptanteConSesion(e);
      const ip = e.ipNueva();
      let ultimo = 0;
      for (let i = 0; i < 120; i++) ultimo = (await lista(sin.access, '', ip)).status;
      expect(ultimo).toBe(200);
      expect((await lista(sin.access, '', ip)).status).toBe(429);

      const ip2 = e.ipNueva();
      for (let i = 0; i < 30; i++) {
        expect((await con(e.patch('/notificaciones/leer-todas', ip2), sin.access)).status).toBe(
          200,
        );
      }
      expect((await con(e.patch('/notificaciones/leer-todas', ip2), sin.access)).status).toBe(429);
    });
  });

  it('las contraseñas de las pruebas no aparecen en el log', () => {
    expect(e.textoLogs()).not.toContain(CLAVE);
  });
});
