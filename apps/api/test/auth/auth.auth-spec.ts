import 'reflect-metadata';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { configurarApp } from '../../src/app.setup';
import { hashHmac, hashSha256 } from '../../src/modules/auth/tokens.util';
import { sembrarBase } from '../../src/database/seeds/seed';
import {
  borrarBaseDePrueba,
  conexion,
  crearDataSource,
  NOMBRE_BD_PRUEBA,
  recrearBaseDePrueba,
} from '../db/db-helper';
import { borrarMensajes, esperarMensajes, extraerToken, mensajesPara } from './mailpit';

// V10: requiere Postgres (DATABASE_*) y Mailpit (SMTP_HOST/SMTP_PORT y MAILPIT_UI_PORT).
const SUFIJO = Date.now();
const SECRETO_REFRESH = 'v10-refresh-secret-de-prueba-0123456789abcdef';
const CLAVE = 'Clave1234';
const ADMIN = { email: 'admin@pethogar.local', clave: 'clave-admin-v10-larga' };
const PDF = Buffer.from('%PDF-1.7\ncontenido-pdf-real\n%%EOF');

describe('V10 — autenticación real (Postgres, Mailpit y disco)', () => {
  let app: NestExpressApplication;
  let ds: DataSource;
  let uploads: string;
  const correosCreados: string[] = [];
  let ipContador = 0;

  /** Cada petición sale de una IP distinta (proxy de confianza solo en la prueba) para no agotar el rate limit. */
  const ipNueva = (): string => `10.${Math.floor(ipContador / 250)}.0.${(ipContador++ % 250) + 1}`;
  const post = (ruta: string): request.Test =>
    request(app.getHttpServer()).post(`/api${ruta}`).set('X-Forwarded-For', ipNueva());
  const get = (ruta: string): request.Test =>
    request(app.getHttpServer()).get(`/api${ruta}`).set('X-Forwarded-For', ipNueva());

  const cookieDe = (res: request.Response): string => {
    const cookies = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    const c = cookies.find((x) => x.startsWith('refresh_token='));
    if (!c) throw new Error('La respuesta no trae la cookie refresh_token');
    return c;
  };
  const valorCookie = (res: request.Response): string => cookieDe(res).split(';')[0].split('=')[1];
  const conCookie = (valor: string): string => `refresh_token=${valor}`;

  const cuerpoAdoptante = (email: string, doc: string, extra: object = {}) => ({
    primerNombre: 'Ana',
    primerApellido: 'Pérez',
    tipoDocumento: 'CC',
    numeroDocumento: doc,
    fechaNacimiento: '1995-04-23',
    telefono: '3001234567',
    email,
    direccion: 'Calle 1 # 2-3',
    ciudad: 'Montería',
    contrasena: CLAVE,
    aceptaPoliticaDatos: true,
    ...extra,
  });

  let contador = 0;
  const nuevoCorreo = (): string => `v10-${SUFIJO}-${contador++}@example.com`;
  const nuevoDoc = (): string => `${SUFIJO}${contador++}`.slice(-12);

  async function registrarAdoptante(extra: object = {}): Promise<{ email: string; doc: string }> {
    const email = nuevoCorreo();
    const doc = nuevoDoc();
    await post('/auth/register/adoptante')
      .send(cuerpoAdoptante(email, doc, extra))
      .expect(201);
    return { email, doc };
  }

  async function adoptanteVerificado(): Promise<string> {
    const { email } = await registrarAdoptante();
    await ds.query('UPDATE usuario SET email_verificado = true WHERE email = $1', [email]);
    return email;
  }

  const login = (email: string, contrasena = CLAVE): request.Test =>
    post('/auth/login').send({ email, contrasena });

  const registrarFundacion = (
    campos: Record<string, string>,
    archivo: { contenido: Buffer; nombre: string; tipo: string } | null = {
      contenido: PDF,
      nombre: 'acta.pdf',
      tipo: 'application/pdf',
    },
  ): request.Test => {
    let r = post('/auth/register/fundacion');
    for (const [k, v] of Object.entries(campos)) r = r.field(k, v);
    return archivo
      ? r.attach('documento', archivo.contenido, {
          filename: archivo.nombre,
          contentType: archivo.tipo,
        })
      : r;
  };

  const camposFundacion = (email: string, nit: string): Record<string, string> => ({
    nombre: 'Huellas V10',
    nit,
    direccion: 'Carrera 5 # 6-7',
    ciudad: 'Montería',
    telefono: '3109876543',
    email,
    contrasena: CLAVE,
    aceptaPoliticaDatos: 'true',
  });

  const archivosPrivados = (): string[] => {
    const carpeta = path.join(uploads, 'privado', 'fundaciones');
    return existsSync(carpeta) ? readdirSync(carpeta) : [];
  };

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    uploads = await mkdtemp(path.join(tmpdir(), 'pethogar-auth-'));

    // Base de pruebas dedicada: nunca la de desarrollo.
    await recrearBaseDePrueba();
    const preparacion = await crearDataSource();
    await preparacion.runMigrations();
    await preparacion.transaction((manager) =>
      sembrarBase(manager, {
        adminEmail: ADMIN.email,
        adminPassword: ADMIN.clave,
        adminTelefono: '3000000000',
        demo: false,
        demoPassword: '',
      }),
    );
    await preparacion.destroy();

    Object.assign(process.env, {
      PORT: '3999', // no se escucha: solo forma la URL pública de archivos
      NODE_ENV: 'test',
      DATABASE_HOST: conexion.host,
      DATABASE_PORT: String(conexion.port),
      DATABASE_USER: conexion.user,
      DATABASE_PASSWORD: conexion.password,
      DATABASE_NAME: NOMBRE_BD_PRUEBA,
      JWT_ACCESS_SECRET: 'v10-access-secret-de-prueba-0123456789abcdef',
      JWT_REFRESH_SECRET: SECRETO_REFRESH,
      SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
      SMTP_PORT: process.env.SMTP_PORT ?? '1025',
      SMTP_FROM: 'PetHogar <no-reply@pethogar.local>',
      UPLOADS_DIR: uploads,
      FRONTEND_URL: 'http://localhost:3000',
    });
    // La validación de .env se ejecuta al cargar AppModule: debe importarse después de fijar el entorno.
    const { AppModule } = await import('../../src/app.module');
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication<NestExpressApplication>();
    configurarApp(app);
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    await app.init();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    const ids = (await Promise.all(correosCreados.map(mensajesPara))).flat().map((m) => m.id);
    await borrarMensajes(ids);
    await app?.close();
    jest.restoreAllMocks();
    await rm(uploads, { recursive: true, force: true });
    await borrarBaseDePrueba();
  });

  describe('adoptante: registro, verificación y correo', () => {
    it('registra, guarda solo hashes y envía el enlace de verificación por correo real', async () => {
      const email = nuevoCorreo();
      correosCreados.push(email);
      const res = await post('/auth/register/adoptante')
        .send(cuerpoAdoptante(email, nuevoDoc()))
        .expect(201);
      expect(res.body.mensaje).toContain('Revisa tu correo');

      const [fila] = await ds.query(
        `SELECT u.contrasena, u.email_verificado, u.token_verificacion_hash, u.token_verificacion_expira,
                r.nombre AS rol, u.acepta_politica_datos, u.fecha_aceptacion
           FROM usuario u JOIN rol r ON r.id = u.rol_id WHERE u.email = $1`,
        [email],
      );
      expect(fila.rol).toBe('adoptante');
      expect(fila.contrasena).toMatch(/^\$2[aby]\$10\$/);
      expect(fila.contrasena).not.toContain(CLAVE);
      expect(fila.email_verificado).toBe(false);
      expect(fila.acepta_politica_datos).toBe(true);
      expect(fila.fecha_aceptacion).not.toBeNull();
      const horas = (fila.token_verificacion_expira.getTime() - Date.now()) / 3_600_000;
      expect(horas).toBeGreaterThan(23.5);
      expect(horas).toBeLessThanOrEqual(24);
      expect(
        await ds.query(
          'SELECT 1 FROM adoptante a JOIN usuario u ON u.id = a.usuario_id WHERE u.email = $1',
          [email],
        ),
      ).toHaveLength(1);

      const [mensaje] = await esperarMensajes(email, 1);
      expect(mensaje.asunto).toBe('Verifica tu correo en PetHogar');
      const token = extraerToken(mensaje.texto);
      expect(mensaje.texto).toContain('http://localhost:3000/verificar-correo?token=');
      expect(fila.token_verificacion_hash).toBe(hashSha256(token));
      expect(fila.token_verificacion_hash).not.toContain(token);
    });

    it('rechaza correo y documento duplicados, menores y datos inválidos sin crear nada', async () => {
      const { email, doc } = await registrarAdoptante();
      const antes = Number((await ds.query('SELECT count(*) AS n FROM usuario'))[0].n);

      const dupCorreo = await post('/auth/register/adoptante')
        .send(cuerpoAdoptante(email.toUpperCase(), nuevoDoc()))
        .expect(409);
      expect(dupCorreo.body.message).toContain('correo');
      const dupDoc = await post('/auth/register/adoptante')
        .send(cuerpoAdoptante(nuevoCorreo(), doc))
        .expect(409);
      expect(dupDoc.body.message).toContain('número de documento');
      const menor = await post('/auth/register/adoptante')
        .send(cuerpoAdoptante(nuevoCorreo(), nuevoDoc(), { fechaNacimiento: '2015-01-01' }))
        .expect(400);
      expect(menor.body.message).toContain('mayor de 18');
      await post('/auth/register/adoptante')
        .send(cuerpoAdoptante(nuevoCorreo(), nuevoDoc(), { aceptaPoliticaDatos: false }))
        .expect(400);
      await post('/auth/register/adoptante')
        .send(cuerpoAdoptante(nuevoCorreo(), nuevoDoc(), { contrasena: 'debil' }))
        .expect(400);

      expect(Number((await ds.query('SELECT count(*) AS n FROM usuario'))[0].n)).toBe(antes);
    });

    it('un registro simultáneo con el mismo correo deja un solo usuario (409 por la restricción única)', async () => {
      const email = nuevoCorreo();
      const resultados = await Promise.all([
        post('/auth/register/adoptante').send(cuerpoAdoptante(email, nuevoDoc())),
        post('/auth/register/adoptante').send(cuerpoAdoptante(email, nuevoDoc())),
      ]);
      expect(resultados.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await ds.query('SELECT 1 FROM usuario WHERE email = $1', [email])).toHaveLength(1);
      // Un registro fallido no deja un adoptante huérfano.
      expect(
        await ds.query(
          'SELECT 1 FROM adoptante a LEFT JOIN usuario u ON u.id = a.usuario_id WHERE u.id IS NULL',
        ),
      ).toHaveLength(0);
    });

    it('sin verificar no inicia sesión; verificar consume el token y luego sí', async () => {
      const email = nuevoCorreo();
      correosCreados.push(email);
      await post('/auth/register/adoptante').send(cuerpoAdoptante(email, nuevoDoc())).expect(201);
      const [mensaje] = await esperarMensajes(email, 1);
      const token = extraerToken(mensaje.texto);

      const sinVerificar = await login(email).expect(403);
      expect(sinVerificar.body.message).toContain('verificar tu correo');

      await get(`/auth/verify-email?token=${encodeURIComponent(token)}`).expect(200);
      const [fila] = await ds.query(
        'SELECT email_verificado, token_verificacion_hash, token_verificacion_expira FROM usuario WHERE email = $1',
        [email],
      );
      expect(fila).toEqual({
        email_verificado: true,
        token_verificacion_hash: null,
        token_verificacion_expira: null,
      });
      const reuso = await get(`/auth/verify-email?token=${encodeURIComponent(token)}`).expect(400);
      expect(reuso.body.message).toContain('no es válido o ya venció');
      await login(email).expect(200);
    });

    it('un token vencido o inventado responde 400', async () => {
      const email = nuevoCorreo();
      correosCreados.push(email);
      await post('/auth/register/adoptante').send(cuerpoAdoptante(email, nuevoDoc())).expect(201);
      const [mensaje] = await esperarMensajes(email, 1);
      const token = extraerToken(mensaje.texto);
      await ds.query(
        "UPDATE usuario SET token_verificacion_expira = now() - interval '1 second' WHERE email = $1",
        [email],
      );
      await get(`/auth/verify-email?token=${encodeURIComponent(token)}`).expect(400);
      await get('/auth/verify-email?token=inventado').expect(400);
      expect(
        (await ds.query('SELECT email_verificado FROM usuario WHERE email = $1', [email]))[0]
          .email_verificado,
      ).toBe(false);
    });

    it('reenvío: misma respuesta siempre, respeta el enfriamiento y el token nuevo invalida el anterior', async () => {
      const email = nuevoCorreo();
      correosCreados.push(email);
      await post('/auth/register/adoptante').send(cuerpoAdoptante(email, nuevoDoc())).expect(201);
      const [primero] = await esperarMensajes(email, 1);

      const inexistente = await post('/auth/verify-email/resend')
        .send({ email: `nadie-${SUFIJO}@example.com` })
        .expect(200);
      const enfriando = await post('/auth/verify-email/resend').send({ email }).expect(200);
      expect(enfriando.body).toEqual(inexistente.body);
      await new Promise((r) => setTimeout(r, 1000));
      expect(await mensajesPara(email)).toHaveLength(1);

      // Simula que el último envío fue hace 5 minutos.
      await ds.query(
        "UPDATE usuario SET token_verificacion_expira = now() + interval '24 hours' - interval '5 minutes' WHERE email = $1",
        [email],
      );
      const conEnvio = await post('/auth/verify-email/resend').send({ email }).expect(200);
      expect(conEnvio.body).toEqual(inexistente.body);
      const mensajes = await esperarMensajes(email, 2);
      expect(mensajes).toHaveLength(2);

      const viejo = extraerToken(primero.texto);
      const nuevo = extraerToken(mensajes.find((m) => m.id !== primero.id)!.texto);
      await get(`/auth/verify-email?token=${encodeURIComponent(viejo)}`).expect(400);
      await get(`/auth/verify-email?token=${encodeURIComponent(nuevo)}`).expect(200);
    });
  });

  describe('sesión: login, refresh, logout', () => {
    it('login correcto: access de 15 min, refresh en cookie httpOnly y solo su HMAC en la BD', async () => {
      const email = await adoptanteVerificado();
      const res = await login(email).expect(200);

      expect(res.body.expiresIn).toBe(900);
      const payload = JSON.parse(
        Buffer.from(res.body.accessToken.split('.')[1], 'base64url').toString(),
      );
      expect(payload.exp - payload.iat).toBe(900);
      expect(payload.rol).toBe('adoptante');
      const cuerpo = JSON.stringify(res.body);
      expect(cuerpo).not.toContain('contrasena');
      expect(cuerpo).not.toContain('$2');
      expect(cuerpo).not.toContain(valorCookie(res));
      expect(res.body.usuario).toMatchObject({ email, rol: 'adoptante', fundacion: null });

      const cookie = cookieDe(res);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/api/auth');
      expect(cookie).toContain('Max-Age=604800');

      const filas = await ds.query(
        `SELECT t.token_hash, t.expira_en, t.revocado FROM refresh_token t
           JOIN usuario u ON u.id = t.usuario_id WHERE u.email = $1`,
        [email],
      );
      expect(filas).toHaveLength(1);
      expect(filas[0].token_hash).toBe(hashHmac(SECRETO_REFRESH, valorCookie(res)));
      expect(filas[0].revocado).toBe(false);
      const dias = (filas[0].expira_en.getTime() - Date.now()) / 86_400_000;
      expect(dias).toBeGreaterThan(6.99);
      expect(dias).toBeLessThanOrEqual(7);

      const me = await get('/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
      expect(me.body.email).toBe(email);
      await get('/auth/me').expect(401);
      await get('/auth/me').set('Authorization', 'Bearer inventado').expect(401);
    });

    it('credenciales malas: mismo 401 genérico para correo inexistente y contraseña errónea', async () => {
      const email = await adoptanteVerificado();
      const mala = await login(email, 'Equivocada9').expect(401);
      const inexistente = await login(`nadie-${SUFIJO}@example.com`).expect(401);
      expect(mala.body.message).toBe(inexistente.body.message);
      expect(mala.headers['set-cookie']).toBeUndefined();
    });

    it('cuenta inactiva: 403 con mensaje específico y no abre sesión', async () => {
      const email = await adoptanteVerificado();
      await ds.query('UPDATE usuario SET activo = false WHERE email = $1', [email]);
      const res = await login(email).expect(403);
      expect(res.body.message).toContain('desactivada');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('refresh rota el token; reutilizar el viejo da 401 y revoca todas las sesiones del usuario', async () => {
      const email = await adoptanteVerificado();
      const l1 = await login(email).expect(200);
      const l2 = await login(email).expect(200);
      const viejo = valorCookie(l1);

      const r = await post('/auth/refresh').set('Cookie', conCookie(viejo)).expect(200);
      const nuevo = valorCookie(r);
      expect(nuevo).not.toBe(viejo);
      expect(r.body.accessToken).toEqual(expect.any(String));
      const estado = await ds.query(
        'SELECT token_hash, revocado FROM refresh_token WHERE token_hash = ANY($1)',
        [[hashHmac(SECRETO_REFRESH, viejo), hashHmac(SECRETO_REFRESH, nuevo)]],
      );
      expect(
        Object.fromEntries(
          estado.map((f: { token_hash: string; revocado: boolean }) => [f.token_hash, f.revocado]),
        ),
      ).toEqual({
        [hashHmac(SECRETO_REFRESH, viejo)]: true,
        [hashHmac(SECRETO_REFRESH, nuevo)]: false,
      });

      const reuso = await post('/auth/refresh').set('Cookie', conCookie(viejo)).expect(401);
      expect(reuso.headers['set-cookie']?.[0]).toMatch(/refresh_token=;/);
      const activos = await ds.query(
        `SELECT count(*) AS n FROM refresh_token t JOIN usuario u ON u.id = t.usuario_id
          WHERE u.email = $1 AND t.revocado = false`,
        [email],
      );
      expect(Number(activos[0].n)).toBe(0);
      await post('/auth/refresh').set('Cookie', conCookie(nuevo)).expect(401);
      await post('/auth/refresh')
        .set('Cookie', conCookie(valorCookie(l2)))
        .expect(401);
    });

    it('refresh sin cookie, desconocido o vencido responde 401; con usuario inactivo también', async () => {
      await post('/auth/refresh').expect(401);
      await post('/auth/refresh').set('Cookie', conCookie('desconocido')).expect(401);

      const email = await adoptanteVerificado();
      const vencido = valorCookie(await login(email).expect(200));
      await ds.query(
        "UPDATE refresh_token SET expira_en = now() - interval '1 second' WHERE token_hash = $1",
        [hashHmac(SECRETO_REFRESH, vencido)],
      );
      await post('/auth/refresh').set('Cookie', conCookie(vencido)).expect(401);

      const activo = valorCookie(await login(email).expect(200));
      await ds.query('UPDATE usuario SET activo = false WHERE email = $1', [email]);
      await post('/auth/refresh').set('Cookie', conCookie(activo)).expect(401);
    });

    it('dos refresh simultáneos con el mismo token: solo uno gana', async () => {
      const email = await adoptanteVerificado();
      const cookie = conCookie(valorCookie(await login(email).expect(200)));
      const resultados = await Promise.all([
        post('/auth/refresh').set('Cookie', cookie),
        post('/auth/refresh').set('Cookie', cookie),
      ]);
      expect(resultados.map((r) => r.status).sort()).toEqual([200, 401]);
      // El perdedor trata el token como reutilizado y revoca la sesión completa.
      const activos = await ds.query(
        `SELECT count(*) AS n FROM refresh_token t JOIN usuario u ON u.id = t.usuario_id
          WHERE u.email = $1 AND t.revocado = false`,
        [email],
      );
      expect(Number(activos[0].n)).toBe(0);
    });

    it('logout: 204, borra la cookie, revoca el token y el refresh posterior falla; sin access token', async () => {
      const email = await adoptanteVerificado();
      const valor = valorCookie(await login(email).expect(200));
      const res = await post('/auth/logout').set('Cookie', conCookie(valor)).expect(204);
      expect(res.headers['set-cookie'][0]).toMatch(/refresh_token=;.*Path=\/api\/auth/);
      const [fila] = await ds.query('SELECT revocado FROM refresh_token WHERE token_hash = $1', [
        hashHmac(SECRETO_REFRESH, valor),
      ]);
      expect(fila.revocado).toBe(true);
      await post('/auth/refresh').set('Cookie', conCookie(valor)).expect(401);
      await post('/auth/logout').expect(204);
    });

    it('el administrador del seed inicia sesión con su rol', async () => {
      const res = await login(ADMIN.email, ADMIN.clave).expect(200);
      expect(res.body.usuario.rol).toBe('administrador');
    });
  });

  describe('bloqueo por intentos fallidos', () => {
    it('bloquea 15 min tras 5 fallos, rechaza incluso la clave correcta y se levanta por tiempo', async () => {
      const email = await adoptanteVerificado();
      for (let i = 0; i < 5; i++) await login(email, 'Equivocada9').expect(401);

      const [bloqueada] = await ds.query(
        'SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE email = $1',
        [email],
      );
      expect(bloqueada.intentos_fallidos).toBe(5);
      const minutos = (bloqueada.bloqueado_hasta.getTime() - Date.now()) / 60_000;
      expect(minutos).toBeGreaterThan(14);
      expect(minutos).toBeLessThanOrEqual(15);

      const res = await login(email).expect(403);
      expect(res.body.message).toContain('bloqueada temporalmente');
      const [igual] = await ds.query(
        'SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE email = $1',
        [email],
      );
      expect(igual.intentos_fallidos).toBe(5);
      expect(igual.bloqueado_hasta).toEqual(bloqueada.bloqueado_hasta);

      await ds.query(
        "UPDATE usuario SET bloqueado_hasta = now() - interval '1 second' WHERE email = $1",
        [email],
      );
      await login(email).expect(200);
      const [limpia] = await ds.query(
        'SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE email = $1',
        [email],
      );
      expect(limpia).toEqual({ intentos_fallidos: 0, bloqueado_hasta: null });
    });

    it('tras vencer el bloqueo un fallo reinicia el contador en 1 (no vuelve a bloquear al instante)', async () => {
      const email = await adoptanteVerificado();
      for (let i = 0; i < 5; i++) await login(email, 'Equivocada9').expect(401);
      await ds.query(
        "UPDATE usuario SET bloqueado_hasta = now() - interval '1 second' WHERE email = $1",
        [email],
      );
      await login(email, 'Equivocada9').expect(401);
      const [fila] = await ds.query(
        'SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE email = $1',
        [email],
      );
      expect(fila).toEqual({ intentos_fallidos: 1, bloqueado_hasta: null });
    });

    it('intentos paralelos no amplían el bloqueo ni lo evaden', async () => {
      const email = await adoptanteVerificado();
      await Promise.all(Array.from({ length: 8 }, () => login(email, 'Equivocada9')));
      const [fila] = await ds.query(
        'SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE email = $1',
        [email],
      );
      expect(fila.intentos_fallidos).toBeGreaterThanOrEqual(5);
      expect(fila.bloqueado_hasta).not.toBeNull();
      expect(fila.bloqueado_hasta.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60_000);
      await login(email).expect(403);
    });
  });

  describe('fundación', () => {
    it('registra con documento en carpeta privada, estado pendiente y correo de recepción', async () => {
      const email = nuevoCorreo();
      correosCreados.push(email);
      const antes = archivosPrivados().length;
      const res = await registrarFundacion(
        camposFundacion(email, `900${SUFIJO}-1`.slice(0, 20)),
      ).expect(201);
      expect(res.body.estadoValidacion).toBe('pendiente');
      expect(res.body.mensaje).toContain('revisará');

      const [fila] = await ds.query(
        `SELECT f.estado_validacion, f.documento_url, f.nit, u.email_verificado, r.nombre AS rol
           FROM fundacion f JOIN usuario u ON u.id = f.usuario_id JOIN rol r ON r.id = u.rol_id
          WHERE u.email = $1`,
        [email],
      );
      expect(fila).toMatchObject({
        estado_validacion: 'pendiente',
        rol: 'fundacion',
        email_verificado: true,
      });
      expect(fila.documento_url).toMatch(/^privado\/fundaciones\/[0-9a-f-]{36}\.pdf$/);
      expect(existsSync(path.join(uploads, fila.documento_url))).toBe(true);
      expect(archivosPrivados()).toHaveLength(antes + 1);

      const nombre = fila.documento_url.split('/').slice(1).join('/');
      const sirve = await request(app.getHttpServer()).get(`/uploads/${nombre}`);
      expect(sirve.status).toBe(404);

      const [mensaje] = await esperarMensajes(email, 1);
      expect(mensaje.asunto).toBe('Recibimos el registro de tu fundación');
    });

    it('login y /auth/me informan el estado; la observación solo aparece si fue rechazada', async () => {
      const email = nuevoCorreo();
      await registrarFundacion(camposFundacion(email, `901${SUFIJO}`.slice(0, 20))).expect(201);

      const pendiente = await login(email).expect(200);
      expect(pendiente.body.usuario.rol).toBe('fundacion');
      expect(pendiente.body.usuario.fundacion).toMatchObject({
        estadoValidacion: 'pendiente',
        observacionValidacion: null,
      });
      expect(JSON.stringify(pendiente.body)).not.toContain('privado/');

      await ds.query(
        `UPDATE fundacion SET estado_validacion = 'rechazada', observacion_validacion = 'Documento ilegible'
          WHERE usuario_id = (SELECT id FROM usuario WHERE email = $1)`,
        [email],
      );
      const me = await get('/auth/me')
        .set('Authorization', `Bearer ${pendiente.body.accessToken}`)
        .expect(200);
      expect(me.body.fundacion).toMatchObject({
        estadoValidacion: 'rechazada',
        observacionValidacion: 'Documento ilegible',
      });
    });

    it('rechaza NIT o correo duplicados, tipo inválido y falta de documento sin dejar datos ni archivos', async () => {
      const email = nuevoCorreo();
      const nit = `902${SUFIJO}`.slice(0, 20);
      await registrarFundacion(camposFundacion(email, nit)).expect(201);
      const archivos = archivosPrivados().length;
      const usuarios = Number((await ds.query('SELECT count(*) AS n FROM usuario'))[0].n);

      const dupNit = await registrarFundacion(camposFundacion(nuevoCorreo(), nit)).expect(409);
      expect(dupNit.body.message).toContain('NIT');
      await registrarFundacion(camposFundacion(email, `903${SUFIJO}`.slice(0, 20))).expect(409);
      const texto = await registrarFundacion(
        camposFundacion(nuevoCorreo(), `904${SUFIJO}`.slice(0, 20)),
        {
          contenido: Buffer.from('esto no es un documento'),
          nombre: 'x.pdf',
          tipo: 'application/pdf',
        },
      ).expect(400);
      expect(texto.body.message).toContain('JPG, PNG o PDF');
      const sinDoc = await registrarFundacion(
        camposFundacion(nuevoCorreo(), `905${SUFIJO}`.slice(0, 20)),
        null,
      ).expect(400);
      expect(sinDoc.body.message).toContain('documento legal');
      await registrarFundacion({
        ...camposFundacion(nuevoCorreo(), `906${SUFIJO}`.slice(0, 20)),
        aceptaPoliticaDatos: 'false',
      }).expect(400);

      expect(archivosPrivados()).toHaveLength(archivos);
      expect(Number((await ds.query('SELECT count(*) AS n FROM usuario'))[0].n)).toBe(usuarios);
    });

    it('dos registros simultáneos con el mismo NIT: uno gana y no queda ningún archivo huérfano', async () => {
      const nit = `907${SUFIJO}`.slice(0, 20);
      const antes = archivosPrivados().length;
      const resultados = await Promise.all([
        registrarFundacion(camposFundacion(nuevoCorreo(), nit)),
        registrarFundacion(camposFundacion(nuevoCorreo(), nit)),
      ]);
      expect(resultados.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(archivosPrivados()).toHaveLength(antes + 1);
      expect(await ds.query('SELECT 1 FROM fundacion WHERE nit = $1', [nit])).toHaveLength(1);
    });
  });

  describe('rate limit real', () => {
    it('la petición 6 de login desde la misma IP en un minuto recibe 429', async () => {
      const ip = '192.0.2.77';
      const enviar = (): request.Test =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ email: `nadie-${SUFIJO}@example.com`, contrasena: CLAVE });
      for (let i = 0; i < 5; i++) await enviar().expect(401);
      const res = await enviar().expect(429);
      expect(res.body.message).toContain('Demasiadas solicitudes');
    });
  });
});
