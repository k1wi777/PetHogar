import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type request from 'supertest';
import { hashHmac } from '../../src/modules/auth/tokens.util';
import { mensajesPara } from './mailpit';
import {
  ADMIN,
  arrancarEntorno,
  bearer,
  CLAVE,
  conCookie,
  Entorno,
  PDF,
  SECRETO_REFRESH,
} from './helpers';

// V10 ampliado: recuperación de contraseña y administración sobre la AppModule real.
// Requiere Postgres (DATABASE_*) y Mailpit (SMTP_HOST/SMTP_PORT y MAILPIT_UI_PORT).
const NUEVA = 'NuevaClave99';
const MENSAJE_GENERICO_FORGOT =
  'Si el correo está registrado, te enviaremos un código de recuperación.';
const MENSAJE_CODIGO_INVALIDO = 'El código no es válido o ya venció';
const PROHIBIDAS =
  /contrasena|password|hash|token|reset|secret|bloqueado|intentos|documento_url|documentoUrl/i;

const pausa = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function clavesProhibidas(valor: unknown, ruta = ''): string[] {
  if (Array.isArray(valor)) return valor.flatMap((v) => clavesProhibidas(v, ruta));
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => [
      ...(PROHIBIDAS.test(k) ? [`${ruta}${k}`] : []),
      ...clavesProhibidas(v, `${ruta}${k}.`),
    ]);
  }
  return [];
}

describe('V10 ampliado — recuperación de contraseña y administración (Postgres, Mailpit y disco)', () => {
  let e: Entorno;
  let adminAccess: string;
  const comoAdmin = (r: request.Test): request.Test => r.set('Authorization', bearer(adminAccess));
  const como = (r: request.Test, access: string): request.Test =>
    r.set('Authorization', bearer(access));

  beforeAll(async () => {
    e = await arrancarEntorno();
    adminAccess = (await e.sesion(ADMIN.email, ADMIN.clave)).access;
  });
  afterAll(() => e?.cerrar());

  // ───────────────────────────── B-14 ─────────────────────────────
  describe('recuperación de contraseña', () => {
    const hashDe = (id: number, codigo: string): string =>
      hashHmac(SECRETO_REFRESH, `reset:${id}:${codigo}`);

    const filaReset = async (email: string) =>
      (
        await e.ds.query(
          `SELECT id, contrasena, reset_code_hash, reset_code_expira, reset_code_intentos,
                  intentos_fallidos, bloqueado_hasta FROM usuario WHERE email = $1`,
          [email],
        )
      )[0];

    const ASUNTO_CODIGO = 'Tu código de recuperación de PetHogar';

    /** Espera `cantidad` correos de código y devuelve el cuyo HMAC coincide con el guardado en BD. */
    async function codigoVigente(email: string, cantidad = 1): Promise<string> {
      const limite = Date.now() + 8000;
      let mensajes = (await mensajesPara(email)).filter((m) => m.asunto === ASUNTO_CODIGO);
      while (mensajes.length < cantidad && Date.now() < limite) {
        await pausa(200);
        mensajes = (await mensajesPara(email)).filter((m) => m.asunto === ASUNTO_CODIGO);
      }
      expect(mensajes).toHaveLength(cantidad);
      const fila = await filaReset(email);
      const codigos = mensajes.map((m) => /es: (\d{6})/.exec(m.texto)?.[1] ?? '');
      const vigente = codigos.find((c) => hashDe(fila.id, c) === fila.reset_code_hash);
      expect(vigente).toMatch(/^\d{6}$/);
      return vigente as string;
    }

    const olvide = (email: string, ip?: string): request.Test =>
      e.post('/auth/forgot-password', ip).send({ email });
    const restablecer = (email: string, codigo: string, nueva = NUEVA, ip?: string): request.Test =>
      e.post('/auth/reset-password', ip).send({ email, codigo, nuevaContrasena: nueva });
    const incorrecto = (c: string): string => (c === '000000' ? '000001' : '000000');

    it('flujo completo: código por correo → reset → clave nueva, sesiones previas revocadas y bloqueo levantado', async () => {
      const email = await e.adoptanteVerificado();
      const sesion = await e.sesion(email);
      for (let i = 0; i < 5; i++) await e.login(email, 'Equivocada9').expect(401);
      await e.login(email).expect(403); // bloqueada por intentos

      const res = await olvide(email).expect(200);
      expect(res.body).toEqual({ mensaje: MENSAJE_GENERICO_FORGOT });
      const codigo = await codigoVigente(email);

      const mail = (await mensajesPara(email)).find((m) => m.asunto === ASUNTO_CODIGO);
      expect(mail?.asunto).toBe(ASUNTO_CODIGO);
      expect(mail?.texto).toContain('15 minutos');
      const fila = await filaReset(email);
      expect(fila.reset_code_hash).toBe(hashDe(fila.id, codigo));
      expect(fila.reset_code_hash).not.toContain(codigo);
      const minutos = (fila.reset_code_expira.getTime() - Date.now()) / 60_000;
      expect(minutos).toBeGreaterThan(14);
      expect(minutos).toBeLessThanOrEqual(15);
      expect(fila.reset_code_intentos).toBe(0);

      const ok = await restablecer(email, codigo).expect(200);
      expect(ok.body.mensaje).toContain('contraseña fue actualizada');

      const despues = await filaReset(email);
      expect(despues).toMatchObject({
        reset_code_hash: null,
        reset_code_expira: null,
        reset_code_intentos: 0,
        intentos_fallidos: 0,
        bloqueado_hasta: null,
      });
      expect(despues.contrasena).toMatch(/^\$2[aby]\$10\$/);
      expect(despues.contrasena).not.toContain(NUEVA);

      await e.login(email, CLAVE).expect(401);
      await e.login(email, NUEVA).expect(200);
      await e.post('/auth/refresh').set('Cookie', conCookie(sesion.refresh)).expect(401);
      const [previo] = await e.ds.query(
        'SELECT revocado FROM refresh_token WHERE token_hash = $1',
        [hashHmac(SECRETO_REFRESH, sesion.refresh)],
      );
      expect(previo.revocado).toBe(true);

      // Un solo uso: el mismo código ya no sirve.
      const reuso = await restablecer(email, codigo, 'OtraClave123').expect(400);
      expect(reuso.body.message).toContain(MENSAJE_CODIGO_INVALIDO);
      await e.login(email, 'OtraClave123').expect(401);
    });

    it('el código nunca aparece en los logs de la API', async () => {
      const email = await e.adoptanteVerificado();
      await olvide(email).expect(200);
      const codigo = await codigoVigente(email);
      await restablecer(email, codigo).expect(200);
      expect(e.textoLogs()).not.toContain(codigo);
    });

    it('forgot-password responde igual (estado y cuerpo) con cuenta, sin cuenta, inactiva y sin verificar; solo la válida recibe correo', async () => {
      const valida = await e.adoptanteVerificado();
      const inactiva = await e.adoptanteVerificado();
      await e.ds.query('UPDATE usuario SET activo = false WHERE email = $1', [inactiva]);
      const { email: sinVerificar } = await e.registrarAdoptante();
      const inexistente = `nadie-${e.sufijo}@example.com`;

      const respuestas = await Promise.all(
        [valida, inactiva, sinVerificar, inexistente].map((c) => olvide(c)),
      );
      for (const r of respuestas) {
        expect(r.status).toBe(200);
        expect(r.body).toEqual({ mensaje: MENSAJE_GENERICO_FORGOT });
      }
      await codigoVigente(valida);
      await pausa(1200);
      for (const c of [inactiva, sinVerificar]) {
        expect((await mensajesPara(c)).map((m) => m.asunto)).not.toContain(ASUNTO_CODIGO);
      }
      expect(await mensajesPara(inexistente)).toHaveLength(0);
      for (const c of [inactiva, sinVerificar]) {
        expect((await filaReset(c)).reset_code_hash).toBeNull();
      }
    });

    it('una fundación pendiente también puede recuperar su contraseña', async () => {
      const email = e.nuevoCorreo();
      await e.registrarFundacion(email, `910${e.sufijo}`.slice(0, 20)).expect(201);
      await olvide(email).expect(200);
      const codigo = await codigoVigente(email);
      await restablecer(email, codigo).expect(200);
      await e.login(email, NUEVA).expect(200);
    });

    it('enfriamiento: no emite otro código hasta pasados 5 min; el nuevo invalida al anterior y reinicia intentos', async () => {
      const email = await e.adoptanteVerificado();
      await olvide(email).expect(200);
      const primero = await codigoVigente(email);
      const hash1 = (await filaReset(email)).reset_code_hash;

      await restablecer(email, incorrecto(primero)).expect(400);
      expect((await filaReset(email)).reset_code_intentos).toBe(1);

      await olvide(email).expect(200);
      await pausa(1200);
      expect((await mensajesPara(email)).filter((m) => m.asunto === ASUNTO_CODIGO)).toHaveLength(1);
      expect((await filaReset(email)).reset_code_hash).toBe(hash1);

      // Simula que el último envío fue hace 5 minutos.
      await e.ds.query(
        "UPDATE usuario SET reset_code_expira = now() + interval '15 minutes' - interval '5 minutes' WHERE email = $1",
        [email],
      );
      await olvide(email).expect(200);
      const segundo = await codigoVigente(email, 2);
      expect((await filaReset(email)).reset_code_intentos).toBe(0);
      expect((await filaReset(email)).reset_code_hash).not.toBe(hash1);

      if (segundo !== primero) {
        const viejo = await restablecer(email, primero).expect(400);
        expect(viejo.body.message).toContain(MENSAJE_CODIGO_INVALIDO);
      }
      await restablecer(email, segundo).expect(200);
    });

    it('código vencido: 400 aunque sea el correcto, sin cambiar la contraseña', async () => {
      const email = await e.adoptanteVerificado();
      await olvide(email).expect(200);
      const codigo = await codigoVigente(email);
      await e.ds.query(
        "UPDATE usuario SET reset_code_expira = now() - interval '1 second' WHERE email = $1",
        [email],
      );
      const res = await restablecer(email, codigo).expect(400);
      expect(res.body.message).toContain(MENSAJE_CODIGO_INVALIDO);
      await e.login(email, CLAVE).expect(200);
    });

    it('mismo 400 genérico para código erróneo, cuenta inexistente, inactiva y sin código emitido', async () => {
      const conCodigo = await e.adoptanteVerificado();
      await olvide(conCodigo).expect(200);
      const codigo = await codigoVigente(conCodigo);
      const inactiva = await e.adoptanteVerificado();
      await e.ds.query('UPDATE usuario SET activo = false WHERE email = $1', [inactiva]);
      await e.ds.query(
        `UPDATE usuario SET reset_code_hash = $2, reset_code_expira = now() + interval '10 minutes' WHERE email = $1`,
        [inactiva, 'a'.repeat(64)],
      );
      const sinCodigo = await e.adoptanteVerificado();

      const mensajes = new Set<string>();
      for (const [correo, cod] of [
        [conCodigo, incorrecto(codigo)],
        [`nadie-${e.sufijo}@example.com`, '123456'],
        [inactiva, '123456'],
        [sinCodigo, '123456'],
      ]) {
        const res = await restablecer(correo, cod).expect(400);
        mensajes.add(JSON.stringify([res.body.statusCode, res.body.error, res.body.message]));
      }
      expect(mensajes.size).toBe(1);
    });

    it('contraseña insegura o código mal formado: 400 de validación y no consume un intento', async () => {
      const email = await e.adoptanteVerificado();
      await olvide(email).expect(200);
      const codigo = await codigoVigente(email);
      await restablecer(email, codigo, 'debil').expect(400);
      await restablecer(email, '12345').expect(400);
      expect((await filaReset(email)).reset_code_intentos).toBe(0);
      await restablecer(email, codigo).expect(200);
    });

    it('intentos agotados con peticiones paralelas: nunca se superan y el código correcto deja de servir', async () => {
      const email = await e.adoptanteVerificado();
      await olvide(email).expect(200);
      const codigo = await codigoVigente(email);

      const rondas = await Promise.all(
        Array.from({ length: 12 }, () => restablecer(email, incorrecto(codigo))),
      );
      expect(rondas.every((r) => r.status === 400)).toBe(true);
      expect((await filaReset(email)).reset_code_intentos).toBe(5);

      const res = await restablecer(email, codigo).expect(400);
      expect(res.body.message).toContain(MENSAJE_CODIGO_INVALIDO);
      expect((await filaReset(email)).reset_code_intentos).toBe(5);
      await e.login(email, CLAVE).expect(200);
    });

    it('dos reset simultáneos con el código correcto: solo uno cambia la contraseña', async () => {
      const email = await e.adoptanteVerificado();
      await olvide(email).expect(200);
      const codigo = await codigoVigente(email);
      const [a, b] = await Promise.all([
        restablecer(email, codigo, 'ClaveUno123'),
        restablecer(email, codigo, 'ClaveDos123'),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 400]);
      const ganadora = a.status === 200 ? 'ClaveUno123' : 'ClaveDos123';
      const perdedora = a.status === 200 ? 'ClaveDos123' : 'ClaveUno123';
      await e.login(email, ganadora).expect(200);
      await e.login(email, perdedora).expect(401);
    });

    it('límite por IP: forgot-password 3 por minuto y reset-password 3 por minuto (429)', async () => {
      const ipForgot = '192.0.2.31';
      for (let i = 0; i < 3; i++)
        await olvide(`nadie-${e.sufijo}@example.com`, ipForgot).expect(200);
      const f = await olvide(`nadie-${e.sufijo}@example.com`, ipForgot).expect(429);
      expect(f.body.message).toContain('Demasiadas solicitudes');

      const ipReset = '192.0.2.32';
      for (let i = 0; i < 3; i++) {
        await restablecer(`nadie-${e.sufijo}@example.com`, '123456', NUEVA, ipReset).expect(400);
      }
      await restablecer(`nadie-${e.sufijo}@example.com`, '123456', NUEVA, ipReset).expect(429);
    });
  });

  // ───────────────────────────── B-16 ─────────────────────────────
  describe('validación de fundaciones', () => {
    let n = 0;
    const nit = (): string => `92${e.sufijo}${n++}`.slice(0, 20);

    async function nuevaFundacion(nombre?: string) {
      const email = e.nuevoCorreo();
      const res = await e.registrarFundacion(email, nit(), nombre).expect(201);
      expect(res.body.estadoValidacion).toBe('pendiente');
      const [fila] = await e.ds.query(
        `SELECT f.id, f.documento_url FROM fundacion f JOIN usuario u ON u.id = f.usuario_id WHERE u.email = $1`,
        [email],
      );
      const sesion = await e.sesion(email);
      return { email, id: fila.id as number, clave: fila.documento_url as string, ...sesion };
    }

    const validar = (id: number, cuerpo: object): request.Test =>
      comoAdmin(e.patch(`/admin/fundaciones/${id}/validacion`)).send(cuerpo);
    const estadoBD = async (id: number) =>
      (
        await e.ds.query(
          'SELECT estado_validacion, observacion_validacion, fecha_validacion FROM fundacion WHERE id = $1',
          [id],
        )
      )[0];

    it('solo el administrador accede: 401 sin token y 403 para fundación y adoptante', async () => {
      const f = await nuevaFundacion();
      const adoptante = await e.sesion(await e.adoptanteVerificado());
      for (const ruta of [
        '/admin/fundaciones',
        `/admin/fundaciones/${f.id}`,
        `/admin/fundaciones/${f.id}/documento`,
      ]) {
        await e.get(ruta).expect(401);
        await como(e.get(ruta), f.access).expect(403);
        await como(e.get(ruta), adoptante.access).expect(403);
      }
      await como(e.patch(`/admin/fundaciones/${f.id}/validacion`), f.access)
        .send({ decision: 'aprobada' })
        .expect(403);
      expect((await estadoBD(f.id)).estado_validacion).toBe('pendiente');
    });

    it('lista pendientes por defecto, paginadas en orden estable; filtra por estado; estado inválido 400', async () => {
      const a = await nuevaFundacion();
      const b = await nuevaFundacion();
      const c = await nuevaFundacion();
      await validar(c.id, { decision: 'aprobada' }).expect(200);

      const res = await comoAdmin(e.get('/admin/fundaciones?limit=100')).expect(200);
      const ids = res.body.data.map((x: { id: number }) => x.id);
      expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
      expect(ids).not.toContain(c.id);
      expect(ids).toEqual([...ids].sort((x: number, y: number) => x - y));
      expect(
        res.body.data.every(
          (x: { estadoValidacion: string }) => x.estadoValidacion === 'pendiente',
        ),
      ).toBe(true);
      expect(res.body).toMatchObject({ page: 1, limit: 100 });
      expect(clavesProhibidas(res.body)).toEqual([]);

      const pagina1 = await comoAdmin(e.get('/admin/fundaciones?page=1&limit=1')).expect(200);
      const pagina2 = await comoAdmin(e.get('/admin/fundaciones?page=2&limit=1')).expect(200);
      expect(pagina1.body.data).toHaveLength(1);
      expect(pagina2.body.data[0].id).toBeGreaterThan(pagina1.body.data[0].id);
      expect(pagina1.body.total).toBe(res.body.total);

      const aprobadas = await comoAdmin(
        e.get('/admin/fundaciones?estado=aprobada&limit=100'),
      ).expect(200);
      expect(aprobadas.body.data.map((x: { id: number }) => x.id)).toContain(c.id);
      await comoAdmin(e.get('/admin/fundaciones?estado=otro')).expect(400);
    });

    it('detalle: datos, NIT, contacto y ruta del documento; nunca la clave ni la ruta de almacenamiento', async () => {
      const f = await nuevaFundacion('Patitas V10');
      const res = await comoAdmin(e.get(`/admin/fundaciones/${f.id}`)).expect(200);
      expect(res.body).toMatchObject({
        id: f.id,
        nombre: 'Patitas V10',
        estadoValidacion: 'pendiente',
        direccion: 'Carrera 5 # 6-7',
        contacto: { email: f.email, telefono: '3109876543' },
        documento: { url: `/api/admin/fundaciones/${f.id}/documento` },
        fechaValidacion: null,
      });
      expect(res.body.nit).toBeTruthy();
      expect(JSON.stringify(res.body)).not.toContain('privado');
      expect(JSON.stringify(res.body)).not.toContain(f.clave);
      expect(clavesProhibidas(res.body)).toEqual([]);
      await comoAdmin(e.get('/admin/fundaciones/99999999')).expect(404);
    });

    it('documento: PDF real con tipo detectado y cabeceras seguras, sin revelar la ruta; archivo ausente o alterado, 404', async () => {
      const f = await nuevaFundacion();
      const res = await comoAdmin(e.get(`/admin/fundaciones/${f.id}/documento`))
        .buffer(true)
        .parse((r, cb) => {
          const trozos: Buffer[] = [];
          r.on('data', (t: Buffer) => trozos.push(t));
          r.on('end', () => cb(null, Buffer.concat(trozos)));
        })
        .expect(200);
      expect((res.body as Buffer).equals(PDF)).toBe(true);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toBe(
        `inline; filename="documento-fundacion-${f.id}.pdf"`,
      );
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
      expect(res.headers['content-length']).toBe(String(PDF.length));
      expect(JSON.stringify(res.headers)).not.toContain(f.clave);
      expect(JSON.stringify(res.headers)).not.toContain(e.uploads);

      const archivo = path.join(e.uploads, f.clave);
      await writeFile(archivo, Buffer.from('MZ esto ya no es un documento'));
      const alterado = await comoAdmin(e.get(`/admin/fundaciones/${f.id}/documento`)).expect(404);
      expect(alterado.body.message).toBe('El documento no está disponible');
      await unlink(archivo);
      const ausente = await comoAdmin(e.get(`/admin/fundaciones/${f.id}/documento`)).expect(404);
      expect(JSON.stringify(ausente.body)).not.toContain(e.uploads);
      expect(JSON.stringify(ausente.body)).not.toContain('privado');
      await comoAdmin(e.get('/admin/fundaciones/99999999/documento')).expect(404);
      expect(existsSync(archivo)).toBe(false);
    });

    it('aprobar: guarda estado y fecha, emite un evento y la fundación lo ve con su sesión previa (/auth/me)', async () => {
      const f = await nuevaFundacion();
      const eventos = e.app.get(EventEmitter2);
      const recibidos: unknown[] = [];
      const escucha = (evento: unknown): number => recibidos.push(evento);
      eventos.on('foundation.validated', escucha);
      try {
        const res = await validar(f.id, { decision: 'aprobada' }).expect(200);
        expect(res.body).toMatchObject({
          estadoValidacion: 'aprobada',
          observacionValidacion: null,
        });
        expect(res.body.fechaValidacion).toEqual(expect.any(String));
        const bd = await estadoBD(f.id);
        expect(bd.estado_validacion).toBe('aprobada');
        expect(bd.fecha_validacion).not.toBeNull();
        expect(recibidos).toEqual([
          expect.objectContaining({ fundacionId: f.id, decision: 'aprobada', observacion: null }),
        ]);

        const me = await como(e.get('/auth/me'), f.access).expect(200);
        expect(me.body.fundacion.estadoValidacion).toBe('aprobada');
      } finally {
        eventos.off('foundation.validated', escucha);
      }
    });

    it('rechazar exige motivo (vacío, espacios o >300: 400 sin cambios); con motivo se guarda y se ve en /auth/me', async () => {
      const f = await nuevaFundacion();
      for (const cuerpo of [
        { decision: 'rechazada' },
        { decision: 'rechazada', observacion: '' },
        { decision: 'rechazada', observacion: '     ' },
        { decision: 'rechazada', observacion: 'x'.repeat(301) },
        { decision: 'pendiente' },
      ]) {
        await validar(f.id, cuerpo).expect(400);
      }
      expect(await estadoBD(f.id)).toMatchObject({
        estado_validacion: 'pendiente',
        observacion_validacion: null,
        fecha_validacion: null,
      });

      await validar(f.id, { decision: 'rechazada', observacion: '  Documento ilegible  ' }).expect(
        200,
      );
      expect(await estadoBD(f.id)).toMatchObject({
        estado_validacion: 'rechazada',
        observacion_validacion: 'Documento ilegible',
      });
      const me = await como(e.get('/auth/me'), f.access).expect(200);
      expect(me.body.fundacion).toMatchObject({
        estadoValidacion: 'rechazada',
        observacionValidacion: 'Documento ilegible',
      });
    });

    it('máquina de estados: rechazada→aprobada sí (sobrescribe el motivo); aprobada→rechazada, repetir y 404, no', async () => {
      const f = await nuevaFundacion();
      const eventos = e.app.get(EventEmitter2);
      let emitidos = 0;
      const escucha = (): number => ++emitidos;
      eventos.on('foundation.validated', escucha);
      try {
        await validar(f.id, { decision: 'rechazada', observacion: 'Falta el acta' }).expect(200);
        await validar(f.id, { decision: 'rechazada', observacion: 'otra vez' }).expect(409);
        await validar(f.id, { decision: 'aprobada' }).expect(200);
        expect(await estadoBD(f.id)).toMatchObject({
          estado_validacion: 'aprobada',
          observacion_validacion: null,
        });

        const antes = await estadoBD(f.id);
        await validar(f.id, { decision: 'rechazada', observacion: 'ya no' }).expect(409);
        await validar(f.id, { decision: 'aprobada' }).expect(409);
        expect(await estadoBD(f.id)).toEqual(antes);
        await validar(99999999, { decision: 'aprobada' }).expect(404);
        expect(emitidos).toBe(2); // solo las dos decisiones válidas
      } finally {
        eventos.off('foundation.validated', escucha);
      }
    });

    it('dos aprobaciones simultáneas: una 200, una 409 y un único evento', async () => {
      const f = await nuevaFundacion();
      const eventos = e.app.get(EventEmitter2);
      let emitidos = 0;
      const escucha = (): number => ++emitidos;
      eventos.on('foundation.validated', escucha);
      try {
        const [a, b] = await Promise.all([
          validar(f.id, { decision: 'aprobada' }),
          validar(f.id, { decision: 'aprobada' }),
        ]);
        expect([a.status, b.status].sort()).toEqual([200, 409]);
        expect(emitidos).toBe(1);
      } finally {
        eventos.off('foundation.validated', escucha);
      }
    });

    it('un listener que falla no deshace la decisión ya guardada', async () => {
      const f = await nuevaFundacion();
      const eventos = e.app.get(EventEmitter2);
      const falla = (): never => {
        throw new Error('listener roto');
      };
      eventos.on('foundation.validated', falla);
      try {
        await validar(f.id, { decision: 'aprobada' }).expect(200);
      } finally {
        eventos.off('foundation.validated', falla);
      }
      expect((await estadoBD(f.id)).estado_validacion).toBe('aprobada');
    });
  });

  // ───────────────────────────── B-17 ─────────────────────────────
  describe('gestión de usuarios', () => {
    const estado = (id: number, activo: unknown): request.Test =>
      comoAdmin(e.patch(`/admin/usuarios/${id}/estado`)).send({ activo });
    const idDe = async (email: string): Promise<number> =>
      (await e.ds.query('SELECT id FROM usuario WHERE email = $1', [email]))[0].id;

    it('solo el administrador lista y cambia estados (401/403)', async () => {
      const adoptante = await e.sesion(await e.adoptanteVerificado());
      await e.get('/admin/usuarios').expect(401);
      await como(e.get('/admin/usuarios'), adoptante.access).expect(403);
      await como(e.patch('/admin/usuarios/1/estado'), adoptante.access)
        .send({ activo: false })
        .expect(403);
    });

    it('listado: filtros, ordenación, paginación y %, _ y \\ como caracteres literales; sin campos sensibles', async () => {
      const s = e.sufijo;
      const a = await e.adoptanteVerificado();
      const b = await e.adoptanteVerificado();
      const c = await e.adoptanteVerificado();
      // Correos con guion bajo y nombres con % y \ para comprobar el escape.
      await e.ds.query(`UPDATE usuario SET email = $2 WHERE email = $1`, [
        a,
        `lit_${s}@example.com`,
      ]);
      await e.ds.query(`UPDATE usuario SET email = $2 WHERE email = $1`, [
        b,
        `litXZ${s}@example.com`,
      ]);
      e.correosCreados.push(`lit_${s}@example.com`, `litXZ${s}@example.com`);
      await e.ds.query(`UPDATE adoptante SET primer_nombre = 'Pe%rez${s}' WHERE usuario_id = $1`, [
        await idDe(`lit_${s}@example.com`),
      ]);
      await e.ds.query(`UPDATE adoptante SET primer_nombre = 'PeXrez${s}' WHERE usuario_id = $1`, [
        await idDe(`litXZ${s}@example.com`),
      ]);
      await e.ds.query(`UPDATE adoptante SET primer_nombre = 'Ba\\rra${s}' WHERE usuario_id = $1`, [
        await idDe(c),
      ]);

      const buscar = async (consulta: string) => {
        const res = await comoAdmin(e.get(`/admin/usuarios?${consulta}&limit=100`)).expect(200);
        expect(clavesProhibidas(res.body)).toEqual([]);
        return res.body as {
          data: { email: string; nombre: string | null; rol: string }[];
          total: number;
        };
      };

      // `_` literal: «lit_» solo coincide con el correo que tiene guion bajo.
      const guion = await buscar(`correo=${encodeURIComponent(`lit_${s}`)}`);
      expect(guion.data.map((u) => u.email)).toEqual([`lit_${s}@example.com`]);
      // `%` literal en el nombre.
      const porcentaje = await buscar(`nombre=${encodeURIComponent(`e%rez${s}`)}`);
      expect(porcentaje.data.map((u) => u.email)).toEqual([`lit_${s}@example.com`]);
      // `%` suelto no es comodín.
      expect((await buscar(`correo=%25`)).total).toBe(0);
      // `\` literal.
      const barra = await buscar(`nombre=${encodeURIComponent(`a\\rra${s}`)}`);
      expect(barra.data.map((u) => u.email)).toEqual([c]);
      // Nombre completo del adoptante (une nombres y apellidos) y sin distinguir mayúsculas.
      const completo = await buscar(`nombre=${encodeURIComponent(`pexrez${s} pérez`)}`);
      expect(completo.data.map((u) => u.email)).toEqual([`litXZ${s}@example.com`]);
      // Rol y combinación de filtros.
      const admins = await buscar('rol=administrador');
      expect(admins.data.every((u) => u.rol === 'administrador')).toBe(true);
      expect(admins.data.map((u) => u.email)).toContain(ADMIN.email);
      expect(admins.data.find((u) => u.email === ADMIN.email)?.nombre).toBeNull();
      expect((await buscar(`rol=fundacion&correo=lit_${s}`)).total).toBe(0);
      await comoAdmin(e.get('/admin/usuarios?rol=superadmin')).expect(400);

      // El nombre de una fundación también se busca.
      const emailF = e.nuevoCorreo();
      await e.registrarFundacion(emailF, `93${s}`.slice(0, 20), `Refugio Único ${s}`).expect(201);
      const fundaciones = await buscar(`nombre=${encodeURIComponent(`único ${s}`)}`);
      expect(fundaciones.data).toEqual([
        expect.objectContaining({ email: emailF, rol: 'fundacion', nombre: `Refugio Único ${s}` }),
      ]);

      // Orden: fecha de creación descendente con desempate por id; la paginación no repite ni omite.
      const todos = await buscar('');
      const esperado = await e.ds.query(
        'SELECT email FROM usuario ORDER BY fecha_creacion DESC, id DESC',
      );
      expect(todos.data.map((u) => u.email)).toEqual(
        esperado.map((f: { email: string }) => f.email),
      );
      const paginas: string[] = [];
      for (let p = 1; p <= Math.ceil(todos.total / 3); p++) {
        const r = await comoAdmin(e.get(`/admin/usuarios?page=${p}&limit=3`)).expect(200);
        expect(r.body).toMatchObject({ total: todos.total, page: p, limit: 3 });
        paginas.push(...r.body.data.map((u: { email: string }) => u.email));
      }
      expect(paginas).toEqual(todos.data.map((u) => u.email));
    });

    it('desactivar: login 403, refresh 401, access aún vigente 401 y refresh revocados en la misma operación; reactivar permite entrar', async () => {
      const email = await e.adoptanteVerificado();
      const id = await idDe(email);
      const s1 = await e.sesion(email);
      const s2 = await e.sesion(email);
      await como(e.get('/auth/me'), s1.access).expect(200);

      const res = await estado(id, false).expect(200);
      expect(res.body).toMatchObject({ id, email, activo: false });
      expect(clavesProhibidas(res.body)).toEqual([]);

      const activos = await e.ds.query(
        'SELECT count(*) AS n FROM refresh_token WHERE usuario_id = $1 AND revocado = false',
        [id],
      );
      expect(Number(activos[0].n)).toBe(0);
      const login = await e.login(email).expect(403);
      expect(login.body.message).toContain('desactivada');
      await e.post('/auth/refresh').set('Cookie', conCookie(s1.refresh)).expect(401);
      await e.post('/auth/refresh').set('Cookie', conCookie(s2.refresh)).expect(401);
      const me = await como(e.get('/auth/me'), s1.access).expect(401);
      expect(me.body.message).toBe('Sesión no válida o vencida');

      // Idempotente.
      await estado(id, false).expect(200);

      await estado(id, true).expect(200);
      await e.login(email).expect(200);
      // Reactivar no restaura las sesiones anteriores.
      await e.post('/auth/refresh').set('Cookie', conCookie(s2.refresh)).expect(401);
    });

    it('validación del cuerpo y usuario inexistente', async () => {
      await estado(99999999, false).expect(404);
      for (const cuerpo of [undefined, null, 1, 'quizá']) await estado(1, cuerpo).expect(400);
      await comoAdmin(e.patch('/admin/usuarios/abc/estado')).send({ activo: true }).expect(400);
    });

    it('un administrador no puede desactivarse a sí mismo (400) ni quedan sesiones afectadas', async () => {
      const idAdmin = await idDe(ADMIN.email);
      const res = await estado(idAdmin, false).expect(400);
      expect(res.body.message).toBe('No puedes desactivar tu propia cuenta');
      expect(
        (await e.ds.query('SELECT activo FROM usuario WHERE id = $1', [idAdmin]))[0].activo,
      ).toBe(true);
      await estado(idAdmin, true).expect(200); // activarse es un no-op válido
    });

    it('dos administradores que se desactivan a la vez: uno lo logra y el otro recibe 409 (nunca sin administradores)', async () => {
      const emailA = `admin-a-${e.sufijo}@example.com`;
      const emailB = `admin-b-${e.sufijo}@example.com`;
      for (const email of [emailA, emailB]) {
        await e.ds.query(
          `INSERT INTO usuario (rol_id, email, contrasena, telefono, email_verificado, acepta_politica_datos)
           SELECT rol_id, $1, contrasena, '3000000001', true, true FROM usuario WHERE email = $2`,
          [email, ADMIN.email],
        );
      }
      const a = await e.sesion(emailA, ADMIN.clave);
      const b = await e.sesion(emailB, ADMIN.clave);
      const idA = await idDe(emailA);
      const idB = await idDe(emailB);
      const idSeed = await idDe(ADMIN.email);
      // Solo A y B deben estar activos para que cada uno sea el «último» del otro.
      await e.ds.query('UPDATE usuario SET activo = false WHERE id = $1', [idSeed]);

      // Un tercero retiene el bloqueo asesor para que ambas peticiones pasen el guard y se solapen.
      const retenedor = e.ds.createQueryRunner();
      await retenedor.connect();
      await retenedor.startTransaction();
      await retenedor.query("SELECT pg_advisory_xact_lock(hashtext('usuarios:administradores'))");
      try {
        const peticiones = Promise.all([
          como(e.patch(`/admin/usuarios/${idB}/estado`), a.access).send({ activo: false }),
          como(e.patch(`/admin/usuarios/${idA}/estado`), b.access).send({ activo: false }),
        ]);
        await pausa(800);
        await retenedor.commitTransaction();
        const [r1, r2] = await peticiones;
        expect([r1.status, r2.status].sort()).toEqual([200, 409]);
        const perdedora = r1.status === 409 ? r1 : r2;
        expect(perdedora.body.message).toBe('Debe haber al menos un administrador activo');
      } finally {
        if (retenedor.isTransactionActive) await retenedor.rollbackTransaction();
        await retenedor.release();
        await e.ds.query('UPDATE usuario SET activo = true WHERE id = $1', [idSeed]);
      }
      const activos = await e.ds.query(
        'SELECT count(*) AS n FROM usuario WHERE id = ANY($1) AND activo = true',
        [[idA, idB]],
      );
      expect(Number(activos[0].n)).toBe(1);
    });
  });
});
