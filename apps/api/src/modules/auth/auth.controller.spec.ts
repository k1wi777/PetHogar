import 'reflect-metadata';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AllExceptionsFilter } from '../../common/filters/http-exception.filter';
import { crearValidationPipe } from '../../common/pipes/validation.pipe';
import { AuthController } from './auth.controller';
import { LoginService } from './login.service';
import { PerfilService } from './perfil.service';
import { RecuperacionService } from './recuperacion.service';
import { RegistroService } from './registro.service';
import { SesionService } from './sesion.service';
import { VerificacionService } from './verificacion.service';

const SECRETO = 'secreto-de-prueba-con-mas-de-32-caracteres';
const PERFIL = {
  id: 5,
  email: 'ana@example.com',
  telefono: '3001234567',
  rol: 'adoptante',
  adoptante: null,
  fundacion: null,
};
const SESION = {
  respuesta: { accessToken: 'jwt', expiresIn: 900, usuario: PERFIL },
  refreshToken: 'refresh-en-claro',
  refreshVigenciaMs: 7 * 86_400_000,
};

const ADOPTANTE = {
  primerNombre: 'Ana',
  primerApellido: 'Pérez',
  tipoDocumento: 'CC',
  numeroDocumento: '123456789',
  fechaNacimiento: '1995-04-23',
  telefono: '3001234567',
  email: '  ANA@Example.com ',
  direccion: 'Calle 1',
  ciudad: 'Montería',
  contrasena: 'Clave1234',
  aceptaPoliticaDatos: true,
};

const FUNDACION = {
  nombre: 'Huellas',
  nit: '900123456-7',
  direccion: 'Carrera 5',
  ciudad: 'Montería',
  telefono: '3109876543',
  email: 'huellas@example.com',
  contrasena: 'Clave1234',
  aceptaPoliticaDatos: 'true',
};

describe('AuthController (HTTP, servicios simulados)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const registro = {
    registrarAdoptante: jest.fn(),
    registrarFundacion: jest.fn(),
  };
  const verificacion = { verificar: jest.fn(), reenviar: jest.fn() };
  const login = { iniciarSesion: jest.fn() };
  const sesion = { renovar: jest.fn(), revocar: jest.fn() };
  const perfil = { obtener: jest.fn() };
  const recuperacion = { solicitar: jest.fn(), restablecer: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [() => ({ NODE_ENV: 'test' })],
        }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        JwtModule.register({
          secret: SECRETO,
          signOptions: { algorithm: 'HS256', expiresIn: 900 },
        }),
      ],
      controllers: [AuthController],
      // Sin ThrottlerGuard: los límites se prueban aparte (describe final).
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: RegistroService, useValue: registro },
        { provide: VerificacionService, useValue: verificacion },
        { provide: LoginService, useValue: login },
        { provide: SesionService, useValue: sesion },
        { provide: PerfilService, useValue: perfil },
        { provide: RecuperacionService, useValue: recuperacion },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(crearValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    jwt = modulo.get(JwtService);
  });

  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  const http = (): ReturnType<typeof request> => request(app.getHttpServer());

  describe('registro de adoptante', () => {
    it('normaliza el correo, valida y delega en el servicio (201)', async () => {
      registro.registrarAdoptante.mockResolvedValue({ mensaje: 'ok' });
      await http().post('/auth/register/adoptante').send(ADOPTANTE).expect(201, { mensaje: 'ok' });
      expect(registro.registrarAdoptante.mock.calls[0][0]).toMatchObject({
        email: 'ana@example.com',
        aceptaPoliticaDatos: true,
      });
    });

    it('rechaza con mensajes en español por campo: contraseña débil, política, documento y fecha', async () => {
      const res = await http()
        .post('/auth/register/adoptante')
        .send({
          ...ADOPTANTE,
          contrasena: 'corta',
          aceptaPoliticaDatos: false,
          tipoDocumento: 'XX',
          fechaNacimiento: '23/04/1995',
        })
        .expect(400);
      const campos = (res.body.errores as { campo: string; mensajes: string[] }[]).map(
        (e) => e.campo,
      );
      expect(campos).toEqual(
        expect.arrayContaining([
          'contrasena',
          'aceptaPoliticaDatos',
          'tipoDocumento',
          'fechaNacimiento',
        ]),
      );
      expect(JSON.stringify(res.body)).toContain('Debes aceptar la política');
      expect(registro.registrarAdoptante).not.toHaveBeenCalled();
    });

    it.each([
      ['sinmayuscula1', 'mayúscula'],
      ['SINMINUSCULA1', 'minúscula'],
      ['SinNumeroAqui', 'número'],
    ])('exige la política de contraseña (%s)', async (contrasena, texto) => {
      const res = await http()
        .post('/auth/register/adoptante')
        .send({ ...ADOPTANTE, contrasena })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain(texto);
    });

    it('ignora campos no declarados (whitelist)', async () => {
      registro.registrarAdoptante.mockResolvedValue({ mensaje: 'ok' });
      await http()
        .post('/auth/register/adoptante')
        .send({ ...ADOPTANTE, rol: 'administrador', activo: true })
        .expect(201);
      expect(registro.registrarAdoptante.mock.calls[0][0]).not.toHaveProperty('rol');
    });
  });

  describe('registro de fundación (multipart)', () => {
    const enviar = (campos: Record<string, string>, adjuntar = true): request.Test => {
      let r = http().post('/auth/register/fundacion');
      for (const [k, v] of Object.entries(campos)) r = r.field(k, v);
      return adjuntar
        ? r.attach('documento', Buffer.from('%PDF-1.7 x'), {
            filename: 'a.pdf',
            contentType: 'application/pdf',
          })
        : r;
    };

    it('recibe los campos y el archivo y delega en el servicio', async () => {
      registro.registrarFundacion.mockResolvedValue({
        mensaje: 'ok',
        estadoValidacion: 'pendiente',
      });
      await enviar(FUNDACION).expect(201, { mensaje: 'ok', estadoValidacion: 'pendiente' });
      const [dto, archivo] = registro.registrarFundacion.mock.calls[0];
      expect(dto).toMatchObject({ nit: '900123456-7', aceptaPoliticaDatos: true });
      expect(archivo.buffer.toString()).toBe('%PDF-1.7 x');
    });

    it('la cadena "false" del formulario NO cuenta como aceptación', async () => {
      await enviar({ ...FUNDACION, aceptaPoliticaDatos: 'false' }).expect(400);
      expect(registro.registrarFundacion).not.toHaveBeenCalled();
    });

    it('sin archivo la validez la decide el servicio (recibe undefined)', async () => {
      registro.registrarFundacion.mockResolvedValue({
        mensaje: 'ok',
        estadoValidacion: 'pendiente',
      });
      await enviar(FUNDACION, false).expect(201);
      expect(registro.registrarFundacion.mock.calls[0][1]).toBeUndefined();
    });

    it('valida el NIT y el teléfono', async () => {
      const res = await enviar({ ...FUNDACION, nit: 'abc', telefono: '12' }).expect(400);
      expect(JSON.stringify(res.body)).toContain('NIT');
      expect(JSON.stringify(res.body)).toContain('teléfono');
    });
  });

  describe('verificación de correo', () => {
    it('GET verify-email delega el token; sin token es 400', async () => {
      verificacion.verificar.mockResolvedValue({ mensaje: 'verificado' });
      await http().get('/auth/verify-email?token=abc').expect(200, { mensaje: 'verificado' });
      expect(verificacion.verificar).toHaveBeenCalledWith('abc');
      await http().get('/auth/verify-email').expect(400);
    });

    it('reenvío responde 200 con el mensaje del servicio y normaliza el correo', async () => {
      verificacion.reenviar.mockResolvedValue({ mensaje: 'igual' });
      await http()
        .post('/auth/verify-email/resend')
        .send({ email: ' A@B.co ' })
        .expect(200, { mensaje: 'igual' });
      expect(verificacion.reenviar).toHaveBeenCalledWith('a@b.co');
      await http().post('/auth/verify-email/resend').send({ email: 'no' }).expect(400);
    });
  });

  describe('recuperación de contraseña', () => {
    const RESET = { email: ' ANA@Example.com ', codigo: '012345', nuevaContrasena: 'NuevaClave1' };

    it('forgot-password responde 200 con el mensaje del servicio y normaliza el correo', async () => {
      recuperacion.solicitar.mockResolvedValue({ mensaje: 'ok' });
      await http()
        .post('/auth/forgot-password')
        .send({ email: ' ANA@Example.com ' })
        .expect(200, { mensaje: 'ok' });
      expect(recuperacion.solicitar).toHaveBeenCalledWith('ana@example.com');
      await http().post('/auth/forgot-password').send({ email: 'no-es-correo' }).expect(400);
    });

    it('reset-password delega con el correo normalizado y el código como texto', async () => {
      recuperacion.restablecer.mockResolvedValue({ mensaje: 'listo' });
      await http().post('/auth/reset-password').send(RESET).expect(200, { mensaje: 'listo' });
      expect(recuperacion.restablecer.mock.calls[0][0]).toEqual({
        email: 'ana@example.com',
        codigo: '012345',
        nuevaContrasena: 'NuevaClave1',
      });
    });

    it.each([
      ['código corto', { codigo: '12345' }],
      ['código con letras', { codigo: '12345a' }],
      ['código de 7 dígitos', { codigo: '1234567' }],
      ['código con espacios', { codigo: '123 456' }],
      ['contraseña corta', { nuevaContrasena: 'Ab1' }],
      ['contraseña sin mayúscula', { nuevaContrasena: 'sinmayuscula1' }],
      ['contraseña sin número', { nuevaContrasena: 'SinNumeroAqui' }],
    ])('reset-password rechaza %s con 400 sin llegar al servicio', async (_nombre, cambio) => {
      await http()
        .post('/auth/reset-password')
        .send({ ...RESET, ...cambio })
        .expect(400);
      expect(recuperacion.restablecer).not.toHaveBeenCalled();
    });
  });

  describe('login, refresh y logout', () => {
    it('login: access token en el cuerpo y refresh solo en la cookie httpOnly', async () => {
      login.iniciarSesion.mockResolvedValue(SESION);
      const res = await http()
        .post('/auth/login')
        .send({ email: 'ana@example.com', contrasena: 'Clave1234' })
        .expect(200);
      expect(res.body).toEqual(SESION.respuesta);
      expect(JSON.stringify(res.body)).not.toContain('refresh-en-claro');
      expect(JSON.stringify(res.body).toLowerCase()).not.toContain('contrasena');

      const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
      expect(cookie).toContain('refresh_token=refresh-en-claro');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/api/auth');
      expect(cookie).toMatch(/Max-Age=604800/);
      expect(cookie).not.toContain('Secure');
    });

    it('login con cuerpo inválido es 400 y no llega al servicio', async () => {
      await http().post('/auth/login').send({ email: 'x' }).expect(400);
      expect(login.iniciarSesion).not.toHaveBeenCalled();
    });

    it('refresh: lee la cookie, rota y entrega la nueva', async () => {
      sesion.renovar.mockResolvedValue({ ...SESION, refreshToken: 'nuevo' });
      const res = await http()
        .post('/auth/refresh')
        .set('Cookie', 'otra=1; refresh_token=viejo')
        .expect(200);
      expect(sesion.renovar).toHaveBeenCalledWith('viejo');
      expect((res.headers['set-cookie'] as unknown as string[])[0]).toContain(
        'refresh_token=nuevo',
      );
      expect(res.body.accessToken).toBe('jwt');
    });

    it('refresh sin cookie es 401 y no consulta el servicio', async () => {
      await http().post('/auth/refresh').expect(401);
      expect(sesion.renovar).not.toHaveBeenCalled();
    });

    it('refresh rechazado es 401 y borra la cookie', async () => {
      sesion.renovar.mockRejectedValue(new UnauthorizedException('Sesión no válida'));
      const res = await http()
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=malo')
        .expect(401);
      expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(
        /refresh_token=;.*Expires=/,
      );
    });

    it('logout: 204, revoca el token de la cookie y la borra, incluso sin access token', async () => {
      sesion.revocar.mockResolvedValue(undefined);
      const res = await http().post('/auth/logout').set('Cookie', 'refresh_token=tok').expect(204);
      expect(sesion.revocar).toHaveBeenCalledWith('tok');
      expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/refresh_token=;/);
    });

    it('logout sin cookie también responde 204', async () => {
      await http().post('/auth/logout').expect(204);
      expect(sesion.revocar).not.toHaveBeenCalled();
    });
  });

  describe('GET /auth/me', () => {
    it('exige access token (401) y devuelve el perfil del usuario autenticado', async () => {
      await http().get('/auth/me').expect(401);
      perfil.obtener.mockResolvedValue(PERFIL);
      const token = jwt.sign({ sub: 5, rol: 'adoptante' });
      await http().get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200, PERFIL);
      expect(perfil.obtener).toHaveBeenCalledWith(5);
    });
  });
});

describe('Rate limit de los endpoints sensibles', () => {
  let app: INestApplication;
  const login = { iniciarSesion: jest.fn() };

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        JwtModule.register({ secret: SECRETO }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: RegistroService, useValue: {} },
        {
          provide: VerificacionService,
          useValue: { reenviar: jest.fn().mockResolvedValue({ mensaje: 'x' }) },
        },
        { provide: LoginService, useValue: login },
        { provide: SesionService, useValue: {} },
        { provide: PerfilService, useValue: {} },
        {
          provide: RecuperacionService,
          useValue: {
            solicitar: jest.fn().mockResolvedValue({ mensaje: 'x' }),
            restablecer: jest.fn().mockResolvedValue({ mensaje: 'x' }),
          },
        },
      ],
    }).compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(crearValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });
  afterAll(() => app.close());

  it('login: la petición 11 en un minuto recibe 429 en español', async () => {
    login.iniciarSesion.mockRejectedValue(
      new UnauthorizedException('Correo o contraseña incorrectos'),
    );
    const enviar = (): request.Test =>
      request(app.getHttpServer()).post('/auth/login').send({ email: 'a@b.co', contrasena: 'x' });
    for (let i = 0; i < 10; i++) await enviar().expect(401);
    const res = await enviar().expect(429);
    expect(res.body.message).toContain('Demasiadas solicitudes');
  });

  it('reenvío: límite de 3 por minuto', async () => {
    const enviar = (): request.Test =>
      request(app.getHttpServer()).post('/auth/verify-email/resend').send({ email: 'a@b.co' });
    for (let i = 0; i < 3; i++) await enviar().expect(200);
    await enviar().expect(429);
  });

  it('forgot-password: límite de 3 por minuto', async () => {
    const enviar = (): request.Test =>
      request(app.getHttpServer()).post('/auth/forgot-password').send({ email: 'a@b.co' });
    for (let i = 0; i < 3; i++) await enviar().expect(200);
    await enviar().expect(429);
  });

  it('reset-password: límite de 5 por minuto', async () => {
    const enviar = (): request.Test =>
      request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ email: 'a@b.co', codigo: '123456', nuevaContrasena: 'NuevaClave1' });
    for (let i = 0; i < 5; i++) await enviar().expect(200);
    await enviar().expect(429);
  });
});
