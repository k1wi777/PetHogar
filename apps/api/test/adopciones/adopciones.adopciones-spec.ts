import 'reflect-metadata';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import {
  AdoptionApproved,
  AdoptionRejected,
  AdoptionRequestCreated,
} from '../../src/common/events';
import { AdopcionesService } from '../../src/modules/adopciones/adopciones.service';
import { MascotasService } from '../../src/modules/mascotas/mascotas.service';
import { SolicitudesService } from '../../src/modules/solicitudes/solicitudes.service';
import { ADMIN, arrancarEntorno, type Entorno } from '../auth/helpers';
import {
  type AdoptantePrueba,
  adoptanteConSesion,
  archivosPrivados,
  CLAVE_PROHIBIDA_ADOPTANTE,
  con,
  EJECUTABLE,
  fechaBogota,
  fundacionAprobada,
  type FundacionPrueba,
  jpeg,
  mascotaPublicada,
  PDF,
  png,
  SVG,
  violacionesDeClaves,
} from './helpers';

// V12: solicitudes, decisión atómica y adopciones sobre la AppModule real (Postgres, Mailpit y disco).
// Requiere Postgres (DATABASE_*) y Mailpit (SMTP_HOST/SMTP_PORT y MAILPIT_UI_PORT).
const OBSERVACION_AUTOMATICA = 'La mascota ya fue adoptada: la fundación aprobó otra solicitud.';

interface Capturado {
  nombre: string;
  payload: Record<string, unknown>;
  /** Estado visto desde OTRA conexión justo al emitir: prueba que el commit ya ocurrió. */
  vista: Promise<{ estado: string; adopciones: number }>;
}

describe('V12 — solicitudes y adopciones (Postgres, Mailpit y disco)', () => {
  let e: Entorno;
  let F1: FundacionPrueba;
  let F2: FundacionPrueba;
  let pendienteAccess: string;
  let admin: string;
  let Ad1: AdoptantePrueba;
  let Ad2: AdoptantePrueba;
  let Ad3: AdoptantePrueba;
  let Ad4: AdoptantePrueba;
  let razaId: number;
  let emisor: EventEmitter2;
  // Solicitudes del flujo principal (mascota M1 con tres pendientes), compartidas entre bloques.
  let M1: number;
  let sol1: number;
  let sol2: number;
  let sol3: number;
  const capturados: Capturado[] = [];
  const respuestasAdoptante: { ruta: string; cuerpo: unknown }[] = [];
  const respuestasFundacion: { ruta: string; cuerpo: unknown }[] = [];

  // ───────────────────────── utilidades ─────────────────────────
  const solicitar = (
    a: AdoptantePrueba,
    mascotaId: number | string,
    opciones: {
      archivo?: Buffer | null;
      nombre?: string;
      tipo?: string;
      campos?: Record<string, string>;
      ip?: string;
    } = {},
  ): request.Test => {
    const r = con(e.post('/solicitudes', opciones.ip), a.access)
      .field('mascotaId', String(mascotaId))
      .field('motivo', 'Quiero darle un hogar lleno de cariño')
      .field('tipoVivienda', 'casa')
      .field('tieneOtrasMascotas', 'false');
    for (const [k, v] of Object.entries(opciones.campos ?? {})) r.field(k, v);
    if (opciones.archivo !== null) {
      r.attach('formulario', opciones.archivo ?? PDF, {
        filename: opciones.nombre ?? 'formulario.pdf',
        contentType: opciones.tipo ?? 'application/pdf',
      });
    }
    return r;
  };
  const crearSolicitud = async (a: AdoptantePrueba, mascotaId: number): Promise<number> => {
    const res = await solicitar(a, mascotaId).expect(201);
    respuestasAdoptante.push({ ruta: 'POST /solicitudes', cuerpo: res.body });
    return res.body.id as number;
  };
  const decidir = (f: FundacionPrueba, id: number, cuerpo: object): request.Test =>
    con(e.patch(`/solicitudes/${id}/decision`), f.access).send(cuerpo);
  const aprobar = (f: FundacionPrueba, id: number, extra: object = {}): request.Test =>
    decidir(f, id, { decision: 'aprobar', fechaEntrega: fechaBogota(3), ...extra });
  const rechazar = (f: FundacionPrueba, id: number, observacion = 'No cumple los requisitos') =>
    decidir(f, id, { decision: 'rechazar', observacion });

  const solicitud = async (id: number) =>
    (
      (await e.ds.query(
        `SELECT s.id, s.estado, s.observacion, s.fecha_respuesta, s.formulario_url, s.mascota_id
           FROM solicitud_adopcion s WHERE s.id = $1`,
        [id],
      )) as {
        id: number;
        estado: string;
        observacion: string | null;
        fecha_respuesta: Date | null;
        formulario_url: string;
        mascota_id: number;
      }[]
    )[0];
  const estadoMascota = async (id: number): Promise<string> =>
    (
      (await e.ds.query('SELECT estado FROM mascota WHERE id = $1', [id])) as { estado: string }[]
    )[0].estado;
  const adopcionesDeMascota = async (mascotaId: number) =>
    (await e.ds.query(
      `SELECT a.id, a.solicitud_id, a.estado, a.acta_url, to_char(a.fecha_entrega,'YYYY-MM-DD') AS fecha_entrega
         FROM adopcion a JOIN solicitud_adopcion s ON s.id = a.solicitud_id
        WHERE s.mascota_id = $1 ORDER BY a.id`,
      [mascotaId],
    )) as {
      id: number;
      solicitud_id: number;
      estado: string;
      acta_url: string | null;
      fecha_entrega: string;
    }[];
  const estadosDe = async (ids: number[]): Promise<string[]> =>
    Promise.all(ids.map(async (id) => (await solicitud(id)).estado));
  const filasSolicitud = async (): Promise<number> =>
    Number(
      ((await e.ds.query('SELECT count(*) AS n FROM solicitud_adopcion')) as { n: string }[])[0].n,
    );
  const enDisco = (clave: string): boolean => existsSync(path.join(e.uploads, clave));

  const vaciarEventos = (): void => {
    capturados.length = 0;
  };
  const eventos = async () =>
    Promise.all(
      capturados.map(async (c) => ({ nombre: c.nombre, payload: c.payload, vista: await c.vista })),
    );

  beforeAll(async () => {
    e = await arrancarEntorno();
    admin = (await e.sesion(ADMIN.email, ADMIN.clave)).access;
    F1 = await fundacionAprobada(e, 'Cali', 'api', admin);
    F2 = await fundacionAprobada(e, 'Bogotá');
    const emailP = e.nuevoCorreo();
    await e.registrarFundacion(emailP, `97${e.sufijo}`.slice(0, 20)).expect(201);
    await e.ds.query('UPDATE usuario SET email_verificado = true WHERE email = $1', [emailP]);
    pendienteAccess = (await e.sesion(emailP)).access;
    [Ad1, Ad2, Ad3, Ad4] = [
      await adoptanteConSesion(e),
      await adoptanteConSesion(e),
      await adoptanteConSesion(e),
      await adoptanteConSesion(e),
    ];
    [{ id: razaId }] = await e.ds.query('SELECT id FROM raza ORDER BY id LIMIT 1');

    emisor = e.app.get(EventEmitter2);
    for (const nombre of [
      AdoptionRequestCreated.eventName,
      AdoptionApproved.eventName,
      AdoptionRejected.eventName,
    ]) {
      emisor.on(nombre, (payload: Record<string, unknown>) => {
        capturados.push({
          nombre,
          payload,
          vista: e.ds
            .query(
              `SELECT s.estado, (SELECT count(*)::int FROM adopcion a WHERE a.solicitud_id = s.id) AS adopciones
                 FROM solicitud_adopcion s WHERE s.id = $1`,
              [payload.solicitudId],
            )
            .then((filas: { estado: string; adopciones: number }[]) => filas[0]),
        });
      });
    }
  });
  afterAll(() => e?.cerrar());

  // ───────────────────────── crear (R1–R5) ─────────────────────────
  describe('crear solicitud', () => {
    beforeAll(async () => {
      M1 = await mascotaPublicada(e, F1, razaId, 'Firulais');
    });

    it('solo el rol adoptante: anónimo 401, fundación y administrador 403', async () => {
      const intento = (access?: string) => {
        const r = e.post('/solicitudes').field('mascotaId', String(M1));
        return access ? con(r, access) : r;
      };
      await intento().expect(401);
      await intento(F1.access).expect(403);
      await intento(admin).expect(403);
      expect(await filasSolicitud()).toBe(0);
    });

    it('un formulario PDF real crea la solicitud pendiente, privada y sin cambiar la mascota', async () => {
      vaciarEventos();
      const res = await solicitar(Ad1, M1).expect(201);
      respuestasAdoptante.push({ ruta: 'POST /solicitudes', cuerpo: res.body });
      sol1 = res.body.id;
      expect(res.body).toMatchObject({
        estado: 'pendiente',
        motivo: 'Quiero darle un hogar lleno de cariño',
        tipoVivienda: 'casa',
        tieneOtrasMascotas: false,
        observacion: null,
        fechaRespuesta: null,
        mascota: { id: M1, nombre: 'Firulais' },
        formulario: { url: `/api/mis-solicitudes/${sol1}/formulario` },
      });
      const fila = await solicitud(sol1);
      expect(fila.formulario_url).toMatch(/^privado\/solicitudes\/[0-9a-f-]+\.pdf$/);
      expect(enDisco(fila.formulario_url)).toBe(true);
      // Carpeta privada: no se sirve bajo /uploads con ninguna ruta posible.
      const nombre = path.basename(fila.formulario_url);
      for (const ruta of [
        `/uploads/${fila.formulario_url}`,
        `/uploads/solicitudes/${nombre}`,
        `/uploads/privado/solicitudes/${nombre}`,
      ]) {
        await request(e.app.getHttpServer()).get(ruta).expect(404);
      }
      expect(await estadoMascota(M1)).toBe('disponible');
      const recibidos = await eventos();
      expect(recibidos).toHaveLength(1);
      expect(recibidos[0].nombre).toBe(AdoptionRequestCreated.eventName);
      expect(recibidos[0].payload).toEqual(new AdoptionRequestCreated(sol1, M1, F1.id, Ad1.id));
      expect(recibidos[0].vista.estado).toBe('pendiente'); // ya confirmada al emitir
    });

    it('otras personas pueden solicitar la misma mascota (sigue disponible); acepta PNG y JPG reales', async () => {
      sol2 = (
        await solicitar(Ad2, M1, {
          archivo: await png(),
          nombre: 'f.png',
          tipo: 'image/png',
        }).expect(201)
      ).body.id;
      sol3 = (
        await solicitar(Ad3, M1, {
          archivo: await jpeg(),
          nombre: 'f.jpg',
          tipo: 'image/jpeg',
        }).expect(201)
      ).body.id;
      expect(await estadoMascota(M1)).toBe('disponible');
      expect((await solicitud(sol2)).formulario_url).toMatch(/\.png$/);
      expect((await solicitud(sol3)).formulario_url).toMatch(/\.jpg$/);
    });

    it('un listener que lanza no rompe la creación', async () => {
      const roto = (): never => {
        throw new Error('listener roto');
      };
      emisor.on(AdoptionRequestCreated.eventName, roto);
      try {
        const M = await mascotaPublicada(e, F1, razaId, 'Listener');
        await solicitar(Ad1, M).expect(201);
      } finally {
        emisor.off(AdoptionRequestCreated.eventName, roto);
      }
    });

    it('archivos inválidos, vacíos, grandes o ausentes: 400/413 sin solicitud ni archivo', async () => {
      const filas = await filasSolicitud();
      const archivos = archivosPrivados(e.uploads);
      await solicitar(Ad4, M1, { archivo: SVG, nombre: 'a.svg', tipo: 'image/svg+xml' }).expect(
        400,
      );
      await solicitar(Ad4, M1, {
        archivo: EJECUTABLE,
        nombre: 'a.pdf',
        tipo: 'application/pdf',
      }).expect(400);
      await solicitar(Ad4, M1, { archivo: Buffer.alloc(0), nombre: 'v.pdf' }).expect(400);
      await solicitar(Ad4, M1, { archivo: null }).expect(400);
      const grande = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);
      const res = await solicitar(Ad4, M1, { archivo: grande }).expect(413);
      expect(res.body.message).toContain('5 MB');
      expect(await filasSolicitud()).toBe(filas);
      expect(archivosPrivados(e.uploads)).toEqual(archivos);
    });

    it('datos inválidos: 400 con mensajes por campo, sin rastro', async () => {
      const filas = await filasSolicitud();
      const archivos = archivosPrivados(e.uploads);
      const res = await solicitar(Ad4, 'abc', {
        campos: { motivo: '', tipoVivienda: 'castillo', tieneOtrasMascotas: 'quizá' },
      }).expect(400);
      expect(res.body.errores.map((x: { campo: string }) => x.campo).sort()).toEqual([
        'mascotaId',
        'motivo',
        'tieneOtrasMascotas',
        'tipoVivienda',
      ]);
      await solicitar(Ad4, M1, { campos: { motivo: 'x'.repeat(501) } }).expect(400);
      expect(await filasSolicitud()).toBe(filas);
      expect(archivosPrivados(e.uploads)).toEqual(archivos);
    });

    it('mascota inexistente 404; no disponible (baja o adoptada) 409, sin rastro', async () => {
      const filas = await filasSolicitud();
      const archivos = archivosPrivados(e.uploads);
      await solicitar(Ad4, 999999).expect(404);
      const baja = await mascotaPublicada(e, F1, razaId, 'Baja');
      await con(e.patch(`/mascotas/${baja}/baja`), F1.access).expect(200);
      const res = await solicitar(Ad4, baja).expect(409);
      expect(res.body.message).toBe('La mascota ya no está disponible para adopción');
      expect(await filasSolicitud()).toBe(filas);
      expect(archivosPrivados(e.uploads)).toEqual(archivos);
    });

    it('duplicada activa: 409 claro (secuencial) y sin archivo nuevo', async () => {
      const archivos = archivosPrivados(e.uploads);
      const res = await solicitar(Ad1, M1).expect(409);
      expect(res.body.message).toBe('Ya tienes una solicitud activa para esta mascota');
      expect(archivosPrivados(e.uploads)).toEqual(archivos);
    });

    it('6 envíos simultáneos del mismo adoptante: una sola solicitud, 5 conflictos y 1 archivo', async () => {
      const M = await mascotaPublicada(e, F1, razaId, 'Carrera');
      const archivos = archivosPrivados(e.uploads).length;
      const respuestas = await Promise.all(Array.from({ length: 6 }, () => solicitar(Ad4, M)));
      expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409]);
      const [{ n }] = await e.ds.query(
        'SELECT count(*)::int AS n FROM solicitud_adopcion WHERE mascota_id = $1',
        [M],
      );
      expect(n).toBe(1);
      expect(archivosPrivados(e.uploads)).toHaveLength(archivos + 1); // ningún huérfano
    });

    it('tras cancelar o ser rechazada SÍ puede volver a solicitar', async () => {
      const M = await mascotaPublicada(e, F1, razaId, 'Otra vez');
      const id = await crearSolicitud(Ad2, M);
      await con(e.patch(`/solicitudes/${id}/cancelar`), Ad2.access).expect(200);
      const segunda = await crearSolicitud(Ad2, M);
      await rechazar(F1, segunda).expect(200);
      await crearSolicitud(Ad2, M);
    });

    it('rate limit de POST /solicitudes: 10 por minuto por IP', async () => {
      const ip = '10.250.250.250';
      const estados: number[] = [];
      for (let i = 0; i < 11; i++) {
        estados.push((await con(e.post('/solicitudes', ip), Ad4.access).send({})).status);
      }
      expect(estados.slice(0, 10).every((s) => s === 400)).toBe(true);
      expect(estados[10]).toBe(429);
    });
  });

  // ───────────────────────── mis solicitudes, formulario y cancelar (R6–R8, R12) ─────────────────────────
  describe('mis solicitudes, descargas y cancelación', () => {
    it('lista solo las propias, con filtro por estado', async () => {
      const res = await con(e.get('/mis-solicitudes'), Ad1.access).expect(200);
      respuestasAdoptante.push({ ruta: 'GET /mis-solicitudes', cuerpo: res.body });
      const propias = (await e.ds.query(
        'SELECT id FROM solicitud_adopcion WHERE adoptante_id = $1',
        [Ad1.id],
      )) as {
        id: number;
      }[];
      expect(res.body.total).toBe(propias.length);
      expect(res.body.data.map((s: { id: number }) => s.id).sort()).toEqual(
        propias.map((p) => p.id).sort(),
      );
      expect(res.body.data.some((s: { id: number }) => s.id === sol2)).toBe(false);
      expect(Object.keys(res.body.data[0]).sort()).toEqual([
        'estado',
        'fechaSolicitud',
        'fundacion',
        'id',
        'mascota',
      ]);
      const filtrada = await con(e.get('/mis-solicitudes?estado=aprobada'), Ad1.access).expect(200);
      expect(filtrada.body).toMatchObject({ total: 0, data: [] });
      await con(e.get('/mis-solicitudes?estado=otro'), Ad1.access).expect(400);
      expect(sol1).toBeGreaterThan(0);
    });

    it('el detalle propio incluye el enlace; una ajena e inexistente dan el mismo 404', async () => {
      const ok = await con(e.get(`/mis-solicitudes/${sol1}`), Ad1.access).expect(200);
      respuestasAdoptante.push({ ruta: 'GET /mis-solicitudes/:id', cuerpo: ok.body });
      expect(ok.body.formulario.url).toBe(`/api/mis-solicitudes/${sol1}/formulario`);
      const ajena = await con(e.get(`/mis-solicitudes/${sol1}`), Ad2.access).expect(404);
      const inexistente = await con(e.get('/mis-solicitudes/999999'), Ad2.access).expect(404);
      expect(ajena.body.message).toBe(inexistente.body.message);
      await con(e.get('/mis-solicitudes/0'), Ad1.access).expect(400);
    });

    it('descarga del formulario: autora y fundación dueña sí (tipo real y cabeceras); ajena y anónimo no', async () => {
      const comprobar = (res: request.Response, tipo: string, id: number, ext: string) => {
        expect(res.headers['content-type']).toBe(tipo);
        expect(res.headers['content-disposition']).toBe(
          `inline; filename="formulario-solicitud-${id}.${ext}"`,
        );
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['cache-control']).toBe('private, no-store');
        expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
        expect(JSON.stringify(res.headers)).not.toMatch(/privado\//);
      };
      const autora = await con(e.get(`/mis-solicitudes/${sol1}/formulario`), Ad1.access).expect(
        200,
      );
      comprobar(autora, 'application/pdf', sol1, 'pdf');
      expect(Buffer.compare(autora.body, PDF)).toBe(0);
      const dueña = await con(e.get(`/fundacion/solicitudes/${sol1}/formulario`), F1.access).expect(
        200,
      );
      comprobar(dueña, 'application/pdf', sol1, 'pdf');
      const imagen = await con(
        e.get(`/fundacion/solicitudes/${sol2}/formulario`),
        F1.access,
      ).expect(200);
      comprobar(imagen, 'image/png', sol2, 'png');

      await con(e.get(`/mis-solicitudes/${sol1}/formulario`), Ad2.access).expect(404);
      await con(e.get(`/fundacion/solicitudes/${sol1}/formulario`), F2.access).expect(404);
      await con(e.get(`/mis-solicitudes/${sol1}/formulario`), F1.access).expect(403);
      await con(e.get(`/fundacion/solicitudes/${sol1}/formulario`), Ad1.access).expect(403);
      await e.get(`/mis-solicitudes/${sol1}/formulario`).expect(401);
      await e.get(`/fundacion/solicitudes/${sol1}/formulario`).expect(401);
    });

    it('cancelar: pendiente propia sí (y no toca la mascota); repetir, ajena, rechazada y aprobada no', async () => {
      const M = await mascotaPublicada(e, F1, razaId, 'Cancelada');
      const id = await crearSolicitud(Ad1, M);
      await con(e.patch(`/solicitudes/${id}/cancelar`), Ad2.access).expect(404);
      expect((await solicitud(id)).estado).toBe('pendiente');
      const ok = await con(e.patch(`/solicitudes/${id}/cancelar`), Ad1.access).expect(200);
      expect(ok.body.estado).toBe('cancelada');
      expect(await estadoMascota(M)).toBe('disponible');
      const otra = await con(e.patch(`/solicitudes/${id}/cancelar`), Ad1.access).expect(409);
      expect(otra.body.message).toBe('La solicitud ya está cancelada');

      const idR = await crearSolicitud(Ad1, M);
      await rechazar(F1, idR).expect(200);
      const r = await con(e.patch(`/solicitudes/${idR}/cancelar`), Ad1.access).expect(409);
      expect(r.body.message).toBe('La solicitud ya está rechazada');

      const idA = await crearSolicitud(Ad1, M);
      await aprobar(F1, idA).expect(200);
      const a = await con(e.patch(`/solicitudes/${idA}/cancelar`), Ad1.access).expect(409);
      expect(a.body.message).toBe(
        'Una solicitud aprobada no se puede cancelar; contacta a la fundación',
      );
      expect((await solicitud(idA)).estado).toBe('aprobada');
      await con(e.patch('/solicitudes/999999/cancelar'), Ad1.access).expect(404);
      await con(e.patch('/solicitudes/abc/cancelar'), Ad1.access).expect(400);
    });
  });

  // ───────────────────────── solicitudes de la fundación (R9–R11, R19) ─────────────────────────
  describe('solicitudes recibidas por la fundación', () => {
    it('lista solo las de sus mascotas, con filtros y sin datos sensibles; la ajena no ve nada', async () => {
      const res = await con(e.get('/fundacion/solicitudes?limit=100'), F1.access).expect(200);
      respuestasFundacion.push({ ruta: 'GET /fundacion/solicitudes', cuerpo: res.body });
      const ids = res.body.data.map((s: { id: number }) => s.id);
      expect(ids).toEqual(expect.arrayContaining([sol1, sol2, sol3]));
      expect(res.body.data[0].adoptante).toEqual({ nombreCompleto: expect.any(String) });
      const porMascota = await con(
        e.get(`/fundacion/solicitudes?mascotaId=${M1}`),
        F1.access,
      ).expect(200);
      expect(porMascota.body.total).toBe(3);
      const porEstado = await con(
        e.get('/fundacion/solicitudes?estado=aprobada&limit=100'),
        F1.access,
      ).expect(200);
      expect(porEstado.body.data.every((s: { estado: string }) => s.estado === 'aprobada')).toBe(
        true,
      );
      const ajena = await con(e.get('/fundacion/solicitudes'), F2.access).expect(200);
      expect(ajena.body).toMatchObject({ total: 0, data: [] });
      const ajenaPorMascota = await con(
        e.get(`/fundacion/solicitudes?mascotaId=${M1}`),
        F2.access,
      ).expect(200);
      expect(ajenaPorMascota.body.total).toBe(0);
      await con(e.get('/fundacion/solicitudes?mascotaId=abc'), F1.access).expect(400);
      await con(e.get('/fundacion/solicitudes?limit=101'), F1.access).expect(400);
    });

    it('el detalle muestra solo nombre, correo, teléfono y ciudad del adoptante', async () => {
      const res = await con(e.get(`/fundacion/solicitudes/${sol1}`), F1.access).expect(200);
      respuestasFundacion.push({ ruta: 'GET /fundacion/solicitudes/:id', cuerpo: res.body });
      expect(res.body.adoptante).toEqual({
        nombreCompleto: 'Ana Pérez',
        email: Ad1.email,
        telefono: '3001234567',
        ciudad: 'Montería',
      });
      expect(res.body.formulario.url).toBe(`/api/fundacion/solicitudes/${sol1}/formulario`);
      expect(JSON.stringify(res.body)).not.toMatch(/Calle 1|1995-04-23|"numeroDocumento"|CC/);
    });

    it('mascota ajena = inexistente: mismo 404 al ver, descargar y decidir, sin efecto alguno', async () => {
      const ver = await con(e.get(`/fundacion/solicitudes/${sol1}`), F2.access).expect(404);
      const inexistente = await con(e.get('/fundacion/solicitudes/999999'), F2.access).expect(404);
      expect(ver.body.message).toBe(inexistente.body.message);
      const antes = await estadosDe([sol1]);
      const rech = await rechazar(F2, sol1).expect(404);
      const apro = await aprobar(F2, sol1).expect(404);
      expect(rech.body.message).toBe(inexistente.body.message);
      expect(apro.body.message).toBe(inexistente.body.message);
      expect(await estadosDe([sol1])).toEqual(antes);
      expect((await solicitud(sol1)).estado).toBe('pendiente');
      expect(await estadoMascota(M1)).toBe('disponible');
      expect(await adopcionesDeMascota(M1)).toHaveLength(0);
    });

    it('roles y estado de la fundación: adoptante 403, anónimo 401, fundación pendiente 403', async () => {
      for (const ruta of ['/fundacion/solicitudes', '/fundacion/adopciones']) {
        await e.get(ruta).expect(401);
        await con(e.get(ruta), Ad1.access).expect(403);
        await con(e.get(ruta), admin).expect(403);
        await con(e.get(ruta), pendienteAccess).expect(403);
      }
      await con(e.patch('/solicitudes/1/decision'), pendienteAccess)
        .send({ decision: 'rechazar', observacion: 'x' })
        .expect(403);
      await con(e.patch('/solicitudes/1/decision'), Ad1.access)
        .send({ decision: 'rechazar', observacion: 'x' })
        .expect(403);
      await e
        .patch('/solicitudes/1/decision')
        .send({ decision: 'rechazar', observacion: 'x' })
        .expect(401);
    });
  });

  // ───────────────────────── decisión (R13–R16) ─────────────────────────
  describe('decisión', () => {
    it('rechazar: observación obligatoria; guarda observación y fecha; emite el evento; no se repite', async () => {
      const M = await mascotaPublicada(e, F1, razaId, 'Rechazo');
      const id = await crearSolicitud(Ad1, M);
      await decidir(F1, id, { decision: 'rechazar' }).expect(400);
      await decidir(F1, id, { decision: 'rechazar', observacion: '   ' }).expect(400);
      await decidir(F1, id, { decision: 'quizá' }).expect(400);
      expect((await solicitud(id)).estado).toBe('pendiente');

      vaciarEventos();
      const res = await rechazar(F1, id, 'No hay espacio suficiente').expect(200);
      respuestasFundacion.push({ ruta: 'PATCH decision rechazar', cuerpo: res.body });
      expect(res.body).toMatchObject({
        estado: 'rechazada',
        observacion: 'No hay espacio suficiente',
        adopcion: null,
      });
      expect(res.body.fechaRespuesta).toEqual(expect.any(String));
      const fila = await solicitud(id);
      expect(fila.estado).toBe('rechazada');
      expect(fila.fecha_respuesta).not.toBeNull();
      const recibidos = await eventos();
      expect(recibidos).toHaveLength(1);
      expect(recibidos[0].payload).toEqual(
        new AdoptionRejected(id, M, F1.id, Ad1.id, 'No hay espacio suficiente', false),
      );
      expect(recibidos[0].vista.estado).toBe('rechazada');
      expect(await estadoMascota(M)).toBe('disponible');

      const repetir = await rechazar(F1, id).expect(409);
      expect(repetir.body.message).toBe('La solicitud ya está rechazada');
      await aprobar(F1, id).expect(409);
      // El adoptante ve la observación de la fundación en su detalle.
      const detalle = await con(e.get(`/mis-solicitudes/${id}`), Ad1.access).expect(200);
      expect(detalle.body).toMatchObject({
        estado: 'rechazada',
        observacion: 'No hay espacio suficiente',
      });
    });

    it('aprobar exige una fecha de entrega real, de hoy o futura', async () => {
      const M = await mascotaPublicada(e, F1, razaId, 'Validación');
      const id = await crearSolicitud(Ad1, M);
      await decidir(F1, id, { decision: 'aprobar' }).expect(400);
      await decidir(F1, id, { decision: 'aprobar', fechaEntrega: '2020-01-01' }).expect(400);
      await decidir(F1, id, { decision: 'aprobar', fechaEntrega: fechaBogota(-1) }).expect(400);
      await decidir(F1, id, { decision: 'aprobar', fechaEntrega: '2099-02-30' }).expect(400);
      await decidir(F1, id, { decision: 'aprobar', fechaEntrega: 'mañana' }).expect(400);
      expect((await solicitud(id)).estado).toBe('pendiente');
      expect(await adopcionesDeMascota(M)).toHaveLength(0);
      // Hoy es válido.
      await aprobar(F1, id, { fechaEntrega: fechaBogota(0) }).expect(200);
    });

    it('aprobar: solicitud aprobada, adopción activa, mascota adoptada y las demás rechazadas, con eventos tras el commit', async () => {
      const M = await mascotaPublicada(e, F1, razaId, 'Aprobada');
      const s1 = await crearSolicitud(Ad1, M);
      const s2 = await crearSolicitud(Ad2, M);
      const s3 = await crearSolicitud(Ad3, M);
      const entrega = fechaBogota(5);

      vaciarEventos();
      const res = await aprobar(F1, s2, {
        fechaEntrega: entrega,
        observacion: ' Bienvenida ',
      }).expect(200);
      respuestasFundacion.push({ ruta: 'PATCH decision aprobar', cuerpo: res.body });
      const adopciones = await adopcionesDeMascota(M);
      expect(adopciones).toHaveLength(1);
      expect(adopciones[0]).toMatchObject({
        solicitud_id: s2,
        estado: 'activa',
        fecha_entrega: entrega,
        acta_url: null,
      });
      expect(res.body).toMatchObject({
        estado: 'aprobada',
        observacion: 'Bienvenida',
        adopcion: { id: adopciones[0].id, fechaEntrega: entrega, estado: 'activa' },
      });
      expect(await estadoMascota(M)).toBe('adoptada');
      expect(await estadosDe([s1, s2, s3])).toEqual(['rechazada', 'aprobada', 'rechazada']);
      expect((await solicitud(s1)).observacion).toBe(OBSERVACION_AUTOMATICA);
      expect((await solicitud(s3)).observacion).toBe(OBSERVACION_AUTOMATICA);
      expect((await solicitud(s1)).fecha_respuesta).not.toBeNull();

      // Sale del catálogo público.
      await e.get(`/mascotas/${M}`).expect(404);
      const catalogo = (await e.get('/mascotas?limit=100').expect(200)).body;
      expect(catalogo.data.some((m: { id: number }) => m.id === M)).toBe(false);

      // Eventos: AdoptionApproved una vez y un rechazo automático por solicitud, ya con el commit hecho.
      const recibidos = await eventos();
      expect(recibidos.map((r) => r.nombre)).toEqual([
        AdoptionApproved.eventName,
        AdoptionRejected.eventName,
        AdoptionRejected.eventName,
      ]);
      expect(recibidos[0].payload).toEqual(
        new AdoptionApproved(s2, adopciones[0].id, M, F1.id, Ad2.id),
      );
      expect(recibidos[0].vista).toEqual({ estado: 'aprobada', adopciones: 1 });
      const rechazos = recibidos.slice(1).map((r) => r.payload as unknown as AdoptionRejected);
      expect(rechazos.map((r) => r.solicitudId).sort()).toEqual([s1, s3].sort());
      expect(rechazos.every((r) => r.automatica && r.observacion === OBSERVACION_AUTOMATICA)).toBe(
        true,
      );
      expect(recibidos.slice(1).every((r) => r.vista.estado === 'rechazada')).toBe(true);

      // Decidir de nuevo, cancelar y volver a solicitar: 409.
      for (const id of [s1, s2, s3]) {
        await aprobar(F1, id).expect(409);
        await rechazar(F1, id).expect(409);
      }
      await solicitar(Ad4, M).expect(409);
      // La rechazada automáticamente muestra su observación al adoptante.
      const visto = await con(e.get(`/mis-solicitudes/${s1}`), Ad1.access).expect(200);
      expect(visto.body).toMatchObject({
        estado: 'rechazada',
        observacion: OBSERVACION_AUTOMATICA,
      });
    });

    it('mascota dada de baja con solicitudes pendientes: aprobar 409 y sigue pendiente; rechazar 200', async () => {
      const M = await mascotaPublicada(e, F1, razaId, 'Baja pendiente');
      const s = await crearSolicitud(Ad1, M);
      await con(e.patch(`/mascotas/${M}/baja`), F1.access).expect(200);
      const res = await aprobar(F1, s).expect(409);
      expect(res.body.message).toContain('inactiva');
      expect((await solicitud(s)).estado).toBe('pendiente');
      expect(await adopcionesDeMascota(M)).toHaveLength(0);
      await rechazar(F1, s).expect(200);
    });
  });

  // ───────────────────────── concurrencia (R16) ─────────────────────────
  describe('decisiones simultáneas', () => {
    it('dos solicitudes distintas de la misma mascota (3 rondas): una prospera, una sola adopción', async () => {
      for (let ronda = 0; ronda < 3; ronda++) {
        const M = await mascotaPublicada(e, F1, razaId, `Carrera ${ronda}`);
        const [a, b, c] = [
          await crearSolicitud(Ad1, M),
          await crearSolicitud(Ad2, M),
          await crearSolicitud(Ad3, M),
        ];
        vaciarEventos();
        const respuestas = await Promise.all([aprobar(F1, a), aprobar(F1, b)]);
        expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(await adopcionesDeMascota(M)).toHaveLength(1);
        expect(await estadoMascota(M)).toBe('adoptada');
        const estados = await estadosDe([a, b, c]);
        expect(estados.filter((s) => s === 'aprobada')).toHaveLength(1);
        expect(estados.filter((s) => s === 'rechazada')).toHaveLength(2);
        const recibidos = await eventos();
        expect(recibidos.filter((r) => r.nombre === AdoptionApproved.eventName)).toHaveLength(1);
        expect(recibidos.filter((r) => r.nombre === AdoptionRejected.eventName)).toHaveLength(2);
      }
    });

    it('la misma solicitud aprobada 4 veces a la vez: una sola prospera', async () => {
      const M = await mascotaPublicada(e, F1, razaId, 'Misma');
      const s = await crearSolicitud(Ad1, M);
      vaciarEventos();
      const respuestas = await Promise.all(Array.from({ length: 4 }, () => aprobar(F1, s)));
      expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409, 409, 409]);
      expect(await adopcionesDeMascota(M)).toHaveLength(1);
      expect((await eventos()).filter((r) => r.nombre === AdoptionApproved.eventName)).toHaveLength(
        1,
      );
    });

    it('aprobar y rechazar la misma solicitud a la vez: queda un único resultado coherente', async () => {
      const M = await mascotaPublicada(e, F1, razaId, 'Aprobar y rechazar');
      const s = await crearSolicitud(Ad1, M);
      const respuestas = await Promise.all([aprobar(F1, s), rechazar(F1, s)]);
      expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
      const aprobada = respuestas[0].status === 200;
      expect((await solicitud(s)).estado).toBe(aprobada ? 'aprobada' : 'rechazada');
      expect(await adopcionesDeMascota(M)).toHaveLength(aprobada ? 1 : 0);
      expect(await estadoMascota(M)).toBe(aprobada ? 'adoptada' : 'disponible');
    });

    it('aprobar y cancelar a la vez (3 rondas): el estado final es coherente', async () => {
      for (let i = 0; i < 3; i++) {
        const M = await mascotaPublicada(e, F1, razaId, `Cancelar ${i}`);
        const s = await crearSolicitud(Ad1, M);
        const [apro, canc] = await Promise.all([
          aprobar(F1, s),
          con(e.patch(`/solicitudes/${s}/cancelar`), Ad1.access),
        ]);
        expect([apro.status, canc.status].sort()).toEqual([200, 409]);
        const estado = (await solicitud(s)).estado;
        expect(estado).toBe(apro.status === 200 ? 'aprobada' : 'cancelada');
        expect(await adopcionesDeMascota(M)).toHaveLength(apro.status === 200 ? 1 : 0);
        expect(await estadoMascota(M)).toBe(apro.status === 200 ? 'adoptada' : 'disponible');
      }
    });

    it('baja y aprobación a la vez: o adoptada o inactiva, nunca ambas', async () => {
      const M = await mascotaPublicada(e, F1, razaId, 'Baja y aprobar');
      const s = await crearSolicitud(Ad1, M);
      const [apro, baja] = await Promise.all([
        aprobar(F1, s),
        con(e.patch(`/mascotas/${M}/baja`), F1.access),
      ]);
      expect([apro.status, baja.status].sort()).toEqual([200, 409]);
      expect(await estadoMascota(M)).toBe(apro.status === 200 ? 'adoptada' : 'inactiva');
      expect(await adopcionesDeMascota(M)).toHaveLength(apro.status === 200 ? 1 : 0);
    });
  });

  // ───────────────────────── atomicidad con BD real (R15) ─────────────────────────
  describe('atomicidad de la aprobación', () => {
    const instantanea = async (M: number, ids: number[]) => ({
      mascota: await estadoMascota(M),
      solicitudes: await Promise.all(ids.map((id) => solicitud(id))),
      adopciones: await adopcionesDeMascota(M),
      totalAdopciones: Number(
        ((await e.ds.query('SELECT count(*) AS n FROM adopcion')) as { n: string }[])[0].n,
      ),
    });

    it.each([
      ['crear la adopción', () => jest.spyOn(e.app.get(AdopcionesService), 'crear')],
      [
        'rechazar las demás pendientes',
        () => jest.spyOn(e.app.get(SolicitudesService), 'rechazarPendientesDeMascota'),
      ],
      [
        'cambiar el estado de la mascota',
        () => jest.spyOn(e.app.get(MascotasService), 'transicionar'),
      ],
    ])(
      'fallo inyectado al %s (con solicitud y mascota ya escritas): 500, nada a medias y 0 eventos',
      async (_n, espiar) => {
        const M = await mascotaPublicada(e, F1, razaId, 'Atómica');
        const ids = [
          await crearSolicitud(Ad1, M),
          await crearSolicitud(Ad2, M),
          await crearSolicitud(Ad3, M),
        ];
        const antes = await instantanea(M, ids);
        const espia = espiar().mockRejectedValueOnce(new Error('fallo inyectado'));
        vaciarEventos();
        try {
          await aprobar(F1, ids[0]).expect(500);
        } finally {
          espia.mockRestore();
        }
        expect(await instantanea(M, ids)).toEqual(antes);
        expect(await estadosDe(ids)).toEqual(['pendiente', 'pendiente', 'pendiente']);
        expect(await estadoMascota(M)).toBe('disponible');
        expect(await eventos()).toHaveLength(0);
        // Sin bloqueos colgados: la aprobación real posterior funciona y deja todo consistente.
        await aprobar(F1, ids[0]).expect(200);
        expect(await estadoMascota(M)).toBe('adoptada');
        expect(await adopcionesDeMascota(M)).toHaveLength(1);
      },
    );

    it('violación real de uq_adopcion_solicitud: rollback completo y 0 eventos', async () => {
      const M = await mascotaPublicada(e, F1, razaId, 'Unique');
      const ids = [await crearSolicitud(Ad1, M), await crearSolicitud(Ad2, M)];
      // Una adopción previa (inconsistente a propósito) para la solicitud que se va a aprobar.
      await e.ds.query(
        `INSERT INTO adopcion (solicitud_id, fecha_entrega) VALUES ($1, '2030-01-01')`,
        [ids[0]],
      );
      const antes = await instantanea(M, ids);
      vaciarEventos();
      await aprobar(F1, ids[0]).expect(500);
      const despues = await instantanea(M, ids);
      expect(despues).toEqual(antes);
      expect(despues.mascota).toBe('disponible');
      expect(await estadosDe(ids)).toEqual(['pendiente', 'pendiente']);
      expect(await eventos()).toHaveLength(0);
      // Se corrige el dato y la aprobación prospera: la mascota no quedó bloqueada.
      await e.ds.query('DELETE FROM adopcion WHERE solicitud_id = $1', [ids[0]]);
      await aprobar(F1, ids[0]).expect(200);
      expect(await estadosDe(ids)).toEqual(['aprobada', 'rechazada']);
    });
  });

  // ───────────────────────── adopciones y acta (R17–R18) ─────────────────────────
  describe('adopciones y acta', () => {
    let M: number;
    let adopcionId: number;
    let sinActaId: number;
    let adoptanteDeLa: AdoptantePrueba;
    let otroAdoptante: AdoptantePrueba;

    beforeAll(async () => {
      M = await mascotaPublicada(e, F1, razaId, 'Con acta');
      const s = await crearSolicitud(Ad3, M);
      await aprobar(F1, s, { fechaEntrega: fechaBogota(10) }).expect(200);
      [{ id: adopcionId }] = await adopcionesDeMascota(M);
      const M2 = await mascotaPublicada(e, F1, razaId, 'Sin acta');
      const s2 = await crearSolicitud(Ad4, M2);
      await aprobar(F1, s2).expect(200);
      [{ id: sinActaId }] = await adopcionesDeMascota(M2);
      adoptanteDeLa = Ad3;
      otroAdoptante = Ad1;
    });

    it('cada rol ve solo sus adopciones, con mascota, fecha, estado, acta y seguimientos vacíos', async () => {
      const propia = await con(e.get('/mis-adopciones?limit=100'), adoptanteDeLa.access).expect(
        200,
      );
      respuestasAdoptante.push({ ruta: 'GET /mis-adopciones', cuerpo: propia.body });
      const delAdoptante = (await e.ds.query(
        `SELECT a.id FROM adopcion a JOIN solicitud_adopcion s ON s.id = a.solicitud_id WHERE s.adoptante_id = $1`,
        [adoptanteDeLa.id],
      )) as { id: number }[];
      expect(propia.body.data.map((a: { id: number }) => a.id).sort()).toEqual(
        delAdoptante.map((a) => a.id).sort(),
      );
      const item = propia.body.data.find((a: { id: number }) => a.id === adopcionId);
      expect(item).toMatchObject({
        estado: 'activa',
        fechaEntrega: fechaBogota(10),
        mascota: { nombre: 'Con acta' },
        acta: null,
        seguimientos: [],
        fundacion: { nombre: 'Refugio Cali', ciudad: 'Cali' },
      });
      const sinAdopciones = await con(e.get('/mis-adopciones'), Ad2.access).expect(200);
      expect(sinAdopciones.body.data.every((a: { id: number }) => a.id !== adopcionId)).toBe(true);

      const f1 = await con(e.get('/fundacion/adopciones?limit=100'), F1.access).expect(200);
      respuestasFundacion.push({ ruta: 'GET /fundacion/adopciones', cuerpo: f1.body });
      const deF1 = (await e.ds.query(
        `SELECT a.id FROM adopcion a JOIN solicitud_adopcion s ON s.id = a.solicitud_id
           JOIN mascota m ON m.id = s.mascota_id WHERE m.fundacion_id = $1`,
        [F1.id],
      )) as { id: number }[];
      expect(f1.body.total).toBe(deF1.length);
      const vista = f1.body.data.find((a: { id: number }) => a.id === adopcionId);
      expect(vista.adoptante).toEqual({
        nombreCompleto: 'Ana Pérez',
        email: adoptanteDeLa.email,
        telefono: '3001234567',
        ciudad: 'Montería',
      });
      const f2 = await con(e.get('/fundacion/adopciones'), F2.access).expect(200);
      expect(f2.body).toMatchObject({ total: 0, data: [] });
      const activas = await con(
        e.get('/fundacion/adopciones?estado=activa&limit=100'),
        F1.access,
      ).expect(200);
      expect(activas.body.total).toBe(deF1.length);
      const finalizadas = await con(
        e.get('/fundacion/adopciones?estado=finalizada'),
        F1.access,
      ).expect(200);
      expect(finalizadas.body.total).toBe(0);
      await con(e.get('/fundacion/adopciones?estado=x'), F1.access).expect(400);
      await con(e.get('/mis-adopciones?limit=101'), adoptanteDeLa.access).expect(400);
    });

    it('subir acta: ajena 404, adoptante 403, anónimo 401, inválidos 400, sin rastro', async () => {
      const archivos = archivosPrivados(e.uploads);
      const subir = (acceso: string | null, id: number, archivo: Buffer | null, campo = 'acta') => {
        const r = e.post(`/fundacion/adopciones/${id}/acta`);
        const q = acceso ? con(r, acceso) : r;
        if (archivo)
          q.attach(campo, archivo, { filename: 'acta.pdf', contentType: 'application/pdf' });
        return q;
      };
      await subir(F2.access, adopcionId, PDF).expect(404);
      await subir(adoptanteDeLa.access, adopcionId, PDF).expect(403);
      await subir(null, adopcionId, PDF).expect(401);
      await subir(F1.access, adopcionId, SVG).expect(400);
      await subir(F1.access, adopcionId, EJECUTABLE).expect(400);
      await subir(F1.access, adopcionId, Buffer.alloc(0)).expect(400);
      await subir(F1.access, adopcionId, null).expect(400);
      await subir(F1.access, adopcionId, PDF, 'otro').expect(400);
      await subir(F1.access, 999999, PDF).expect(404);
      await subir(F1.access, 0, PDF).expect(400);
      const grande = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);
      await subir(F1.access, adopcionId, grande).expect(413);
      expect(archivosPrivados(e.uploads)).toEqual(archivos);
      expect((await adopcionesDeMascota(M))[0].acta_url).toBeNull();
    });

    it('sin acta: la descarga es 404 con mensaje claro', async () => {
      const res = await con(e.get(`/fundacion/adopciones/${sinActaId}/acta`), F1.access).expect(
        404,
      );
      expect(res.body.message).toBe('La adopción todavía no tiene acta');
    });

    it('la fundación dueña sube el acta; ambos la descargan con cabeceras seguras; terceros no', async () => {
      const res = await con(e.post(`/fundacion/adopciones/${adopcionId}/acta`), F1.access)
        .attach('acta', PDF, { filename: 'acta.pdf', contentType: 'application/pdf' })
        .expect(201);
      respuestasFundacion.push({ ruta: 'POST acta', cuerpo: res.body });
      expect(res.body.acta).toEqual({ url: `/api/fundacion/adopciones/${adopcionId}/acta` });
      const clave = (await adopcionesDeMascota(M))[0].acta_url!;
      expect(clave).toMatch(/^privado\/solicitudes\/[0-9a-f-]+\.pdf$/);
      expect(enDisco(clave)).toBe(true);
      await request(e.app.getHttpServer()).get(`/uploads/${clave}`).expect(404);

      for (const [ruta, acceso] of [
        [`/fundacion/adopciones/${adopcionId}/acta`, F1.access],
        [`/mis-adopciones/${adopcionId}/acta`, adoptanteDeLa.access],
      ] as const) {
        const d = await con(e.get(ruta), acceso).expect(200);
        expect(d.headers['content-type']).toBe('application/pdf');
        expect(d.headers['content-disposition']).toBe(
          `inline; filename="acta-adopcion-${adopcionId}.pdf"`,
        );
        expect(d.headers['x-content-type-options']).toBe('nosniff');
        expect(d.headers['cache-control']).toBe('private, no-store');
        expect(d.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
        expect(Buffer.compare(d.body, PDF)).toBe(0);
      }
      // El adoptante ve el enlace en su lista.
      const lista = await con(e.get('/mis-adopciones'), adoptanteDeLa.access).expect(200);
      expect(lista.body.data.find((a: { id: number }) => a.id === adopcionId).acta).toEqual({
        url: `/api/mis-adopciones/${adopcionId}/acta`,
      });
      await con(e.get(`/fundacion/adopciones/${adopcionId}/acta`), F2.access).expect(404);
      await con(e.get(`/mis-adopciones/${adopcionId}/acta`), otroAdoptante.access).expect(404);
      await e.get(`/mis-adopciones/${adopcionId}/acta`).expect(401);
      await con(e.get(`/mis-adopciones/${adopcionId}/acta`), F1.access).expect(403);
    });

    it('sobreescribir el acta borra el archivo anterior y deja uno solo', async () => {
      const anterior = (await adopcionesDeMascota(M))[0].acta_url!;
      const antes = archivosPrivados(e.uploads).length;
      await con(e.post(`/fundacion/adopciones/${adopcionId}/acta`), F1.access)
        .attach('acta', await png(), { filename: 'acta.png', contentType: 'image/png' })
        .expect(201);
      const nueva = (await adopcionesDeMascota(M))[0].acta_url!;
      expect(nueva).not.toBe(anterior);
      expect(nueva).toMatch(/\.png$/);
      expect(enDisco(anterior)).toBe(false);
      expect(enDisco(nueva)).toBe(true);
      expect(archivosPrivados(e.uploads)).toHaveLength(antes);
      const d = await con(e.get(`/mis-adopciones/${adopcionId}/acta`), adoptanteDeLa.access).expect(
        200,
      );
      expect(d.headers['content-type']).toBe('image/png');
    });

    it('un acta inválida no cambia nada: ni la fila ni el archivo vigente', async () => {
      const vigente = (await adopcionesDeMascota(M))[0].acta_url!;
      const archivos = archivosPrivados(e.uploads);
      await con(e.post(`/fundacion/adopciones/${adopcionId}/acta`), F1.access)
        .attach('acta', SVG, { filename: 'acta.svg', contentType: 'image/svg+xml' })
        .expect(400);
      expect((await adopcionesDeMascota(M))[0].acta_url).toBe(vigente);
      expect(enDisco(vigente)).toBe(true);
      expect(archivosPrivados(e.uploads)).toEqual(archivos);
    });

    it('subidas simultáneas: una sola acta vigente y ningún archivo huérfano', async () => {
      const antes = archivosPrivados(e.uploads).length;
      const respuestas = await Promise.all(
        Array.from({ length: 4 }, () =>
          con(e.post(`/fundacion/adopciones/${adopcionId}/acta`), F1.access).attach('acta', PDF, {
            filename: 'acta.pdf',
            contentType: 'application/pdf',
          }),
        ),
      );
      expect(respuestas.every((r) => r.status === 201)).toBe(true);
      const vigente = (await adopcionesDeMascota(M))[0].acta_url!;
      expect(enDisco(vigente)).toBe(true);
      expect(archivosPrivados(e.uploads)).toHaveLength(antes);
    });

    it('una adopción cerrada no admite acta nueva (409) y no deja archivos', async () => {
      await e.ds.query(`UPDATE adopcion SET estado = 'finalizada' WHERE id = $1`, [sinActaId]);
      const archivos = archivosPrivados(e.uploads);
      await con(e.post(`/fundacion/adopciones/${sinActaId}/acta`), F1.access)
        .attach('acta', PDF, { filename: 'acta.pdf', contentType: 'application/pdf' })
        .expect(409);
      expect(archivosPrivados(e.uploads)).toEqual(archivos);
      await e.ds.query(`UPDATE adopcion SET estado = 'activa' WHERE id = $1`, [sinActaId]);
    });
  });

  // ───────────────────────── paginación, barrido y huérfanos ─────────────────────────
  describe('paginación, claves prohibidas y archivos huérfanos', () => {
    it('la paginación es estable con fechas empatadas (oráculo SQL) y respeta el tope', async () => {
      await e.ds.query(`UPDATE solicitud_adopcion SET fecha_solicitud = '2026-01-01T00:00:00Z'`);
      const oraculo = async (sql: string, params: unknown[]) =>
        ((await e.ds.query(sql, params)) as { id: number }[]).map((r) => r.id);
      const recorrer = async (ruta: string, acceso: string, limite: number): Promise<number[]> => {
        const ids: number[] = [];
        for (let page = 1; ; page++) {
          const res = await con(e.get(`${ruta}?page=${page}&limit=${limite}`), acceso).expect(200);
          ids.push(...res.body.data.map((s: { id: number }) => s.id));
          if (res.body.data.length < limite) break;
        }
        return ids;
      };
      expect(await recorrer('/mis-solicitudes', Ad1.access, 2)).toEqual(
        await oraculo(
          'SELECT id FROM solicitud_adopcion WHERE adoptante_id = $1 ORDER BY fecha_solicitud DESC, id DESC',
          [Ad1.id],
        ),
      );
      expect(await recorrer('/fundacion/solicitudes', F1.access, 3)).toEqual(
        await oraculo(
          `SELECT s.id FROM solicitud_adopcion s JOIN mascota m ON m.id = s.mascota_id
            WHERE m.fundacion_id = $1 ORDER BY s.fecha_solicitud DESC, s.id DESC`,
          [F1.id],
        ),
      );
      await e.ds.query(`UPDATE adopcion SET fecha_entrega = '2030-01-01'`);
      expect(await recorrer('/fundacion/adopciones', F1.access, 2)).toEqual(
        await oraculo(
          `SELECT a.id FROM adopcion a JOIN solicitud_adopcion s ON s.id = a.solicitud_id
             JOIN mascota m ON m.id = s.mascota_id WHERE m.fundacion_id = $1
            ORDER BY a.fecha_entrega DESC, a.id DESC`,
          [F1.id],
        ),
      );
      const tope = await con(e.get('/mis-solicitudes?limit=100'), Ad1.access).expect(200);
      expect(tope.body.limit).toBe(100);
      await con(e.get('/mis-solicitudes?limit=101'), Ad1.access).expect(400);
      await con(e.get('/mis-solicitudes?page=0'), Ad1.access).expect(400);
    });

    it('ninguna respuesta real trae claves de almacenamiento ni datos sensibles', () => {
      expect(respuestasAdoptante.length).toBeGreaterThan(5);
      expect(respuestasFundacion.length).toBeGreaterThan(5);
      for (const { ruta, cuerpo } of respuestasAdoptante) {
        expect([ruta, violacionesDeClaves(cuerpo, '$', CLAVE_PROHIBIDA_ADOPTANTE)]).toEqual([
          ruta,
          [],
        ]);
      }
      for (const { ruta, cuerpo } of respuestasFundacion) {
        expect([ruta, violacionesDeClaves(cuerpo)]).toEqual([ruta, []]);
      }
    });

    it('al final no hay archivos huérfanos: cada archivo privado está referenciado y viceversa', async () => {
      const referenciadas = (
        (await e.ds.query(
          `SELECT formulario_url AS clave FROM solicitud_adopcion
           UNION ALL SELECT acta_url FROM adopcion WHERE acta_url IS NOT NULL`,
        )) as { clave: string }[]
      )
        .map((r) => path.basename(r.clave))
        .sort();
      expect(archivosPrivados(e.uploads)).toEqual(referenciadas);
    });
  });
});
