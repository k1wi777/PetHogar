import 'reflect-metadata';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { configurarApp } from '../../src/app.setup';
import { sembrarBase } from '../../src/database/seeds/seed';
import {
  borrarBaseDePrueba,
  conexion,
  crearDataSource,
  NOMBRE_BD_PRUEBA,
  recrearBaseDePrueba,
} from '../db/db-helper';
import { borrarMensajes, mensajesPara } from './mailpit';

// V10 ampliado (recuperación y administración): misma infraestructura que auth.auth-spec.ts.
export const SECRETO_REFRESH = 'v10-refresh-secret-de-prueba-0123456789abcdef';
export const CLAVE = 'Clave1234';
export const ADMIN = { email: 'admin@pethogar.local', clave: 'clave-admin-v10-larga' };
export const PDF = Buffer.from('%PDF-1.7\ncontenido-pdf-real\n%%EOF');

export interface Entorno {
  app: NestExpressApplication;
  ds: DataSource;
  uploads: string;
  sufijo: number;
  /** Cada petición sale de una IP distinta (proxy de confianza solo en la prueba). */
  ipNueva: () => string;
  post: (ruta: string, ip?: string) => request.Test;
  get: (ruta: string, ip?: string) => request.Test;
  patch: (ruta: string, ip?: string) => request.Test;
  del: (ruta: string, ip?: string) => request.Test;
  login: (email: string, contrasena?: string) => request.Test;
  /** Inicia sesión y devuelve el access token y el valor de la cookie de refresh. */
  sesion: (email: string, contrasena?: string) => Promise<{ access: string; refresh: string }>;
  nuevoCorreo: () => string;
  nuevoDoc: () => string;
  registrarAdoptante: (extra?: object) => Promise<{ email: string; doc: string }>;
  adoptanteVerificado: (extra?: object) => Promise<string>;
  registrarFundacion: (email: string, nit: string, nombre?: string) => request.Test;
  /** Correos creados que `cerrar` borrará de Mailpit. */
  correosCreados: string[];
  /** Registra todo lo que escribe el Logger para comprobar que no contiene secretos. */
  textoLogs: () => string;
  cerrar: () => Promise<void>;
}

export const valorCookie = (res: request.Response): string => {
  const cookies = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const c = cookies.find((x) => x.startsWith('refresh_token='));
  if (!c) throw new Error('La respuesta no trae la cookie refresh_token');
  return c.split(';')[0].split('=')[1];
};
export const conCookie = (valor: string): string => `refresh_token=${valor}`;
export const bearer = (access: string): string => `Bearer ${access}`;

export async function arrancarEntorno(): Promise<Entorno> {
  const sufijo = Date.now();
  const lineas: string[] = [];
  for (const metodo of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
    jest.spyOn(Logger.prototype, metodo).mockImplementation((...args: unknown[]) => {
      lineas.push(args.map(String).join(' '));
    });
  }
  const uploads = await mkdtemp(path.join(tmpdir(), 'pethogar-admin-'));

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
    PORT: '3999',
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
  // La validación del entorno se ejecuta al cargar AppModule: se importa tras fijarlo.
  const { AppModule } = await import('../../src/app.module');
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app);
  app.getHttpAdapter().getInstance().set('trust proxy', true);
  // Las pruebas lanzan ráfagas de peticiones paralelas contra el mismo servidor.
  app.getHttpServer().setMaxListeners(100);
  await app.init();
  const ds = app.get(DataSource);

  let ipContador = 0;
  const ipNueva = (): string => `10.${Math.floor(ipContador / 250)}.1.${(ipContador++ % 250) + 1}`;
  const http = (
    metodo: 'post' | 'get' | 'patch' | 'delete',
    ruta: string,
    ip?: string,
  ): request.Test =>
    request(app.getHttpServer())
      [metodo](`/api${ruta}`)
      .set('X-Forwarded-For', ip ?? ipNueva());
  const post = (ruta: string, ip?: string): request.Test => http('post', ruta, ip);
  const get = (ruta: string, ip?: string): request.Test => http('get', ruta, ip);
  const patch = (ruta: string, ip?: string): request.Test => http('patch', ruta, ip);
  const del = (ruta: string, ip?: string): request.Test => http('delete', ruta, ip);

  let contador = 0;
  const nuevoCorreo = (): string => `v10b-${sufijo}-${contador++}@example.com`;
  const nuevoDoc = (): string => `${sufijo}${contador++}`.slice(-12);
  const correosCreados: string[] = [];

  const registrarAdoptante = async (extra: object = {}) => {
    const email = nuevoCorreo();
    const doc = nuevoDoc();
    correosCreados.push(email);
    await post('/auth/register/adoptante')
      .send({
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
      })
      .expect(201);
    return { email, doc };
  };
  const adoptanteVerificado = async (extra: object = {}): Promise<string> => {
    const { email } = await registrarAdoptante(extra);
    await ds.query('UPDATE usuario SET email_verificado = true WHERE email = $1', [email]);
    return email;
  };
  const login = (email: string, contrasena = CLAVE): request.Test =>
    post('/auth/login').send({ email, contrasena });

  return {
    app,
    ds,
    uploads,
    sufijo,
    ipNueva,
    post,
    get,
    patch,
    del,
    login,
    sesion: async (email, contrasena = CLAVE) => {
      const res = await login(email, contrasena).expect(200);
      return { access: res.body.accessToken as string, refresh: valorCookie(res) };
    },
    nuevoCorreo,
    nuevoDoc,
    registrarAdoptante,
    adoptanteVerificado,
    registrarFundacion: (email, nit, nombre = 'Huellas V10') => {
      correosCreados.push(email);
      return post('/auth/register/fundacion')
        .field('nombre', nombre)
        .field('nit', nit)
        .field('direccion', 'Carrera 5 # 6-7')
        .field('ciudad', 'Montería')
        .field('telefono', '3109876543')
        .field('email', email)
        .field('contrasena', CLAVE)
        .field('aceptaPoliticaDatos', 'true')
        .attach('documento', PDF, { filename: 'acta.pdf', contentType: 'application/pdf' });
    },
    correosCreados,
    textoLogs: () => lineas.join('\n'),
    cerrar: async () => {
      const ids = (await Promise.all(correosCreados.map(mensajesPara))).flat().map((m) => m.id);
      await borrarMensajes(ids);
      await app.close();
      jest.restoreAllMocks();
      await rm(uploads, { recursive: true, force: true });
      await borrarBaseDePrueba();
    },
  };
}
