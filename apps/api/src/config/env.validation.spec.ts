import { cookieSegura, esVerdadero, validate } from './env.validation';

const ENV_VALIDO = {
  PORT: '3001',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'pethogar',
  DATABASE_PASSWORD: 'pethogar',
  DATABASE_NAME: 'pethogar',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_FROM: 'PetHogar <no-reply@pethogar.local>',
  UPLOADS_DIR: './uploads',
  FRONTEND_URL: 'http://localhost:3000',
};

describe('validate (.env)', () => {
  it('acepta una configuración completa y convierte los números', () => {
    const env = validate(ENV_VALIDO);
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_PORT).toBe(5432);
  });

  it('indica en español las variables ausentes o inválidas', () => {
    const incompleto: Record<string, string> = { ...ENV_VALIDO };
    delete incompleto.DATABASE_HOST;
    const entrada = { ...incompleto, PORT: 'abc', FRONTEND_URL: 'no-url' };
    expect(() => validate(entrada)).toThrow('Variables de entorno inválidas o ausentes');
    expect(() => validate(entrada)).toThrow('DATABASE_HOST: es obligatoria');
    expect(() => validate(entrada)).toThrow('PORT: debe ser un número de puerto');
    expect(() => validate(entrada)).toThrow('FRONTEND_URL: debe ser una URL válida');
  });

  it('trata como opcionales las variables de correo y URL pública', () => {
    const env = validate(ENV_VALIDO);
    expect(env.SMTP_USER).toBeUndefined();
    expect(env.API_PUBLIC_URL).toBeUndefined();
  });

  it("valida los booleanos como 'true' o 'false' sin convertir la cadena 'false' en true", () => {
    const env = validate({
      ...ENV_VALIDO,
      COOKIE_SECURE: 'false',
      SMTP_SECURE: 'true',
    });
    expect(esVerdadero(env.COOKIE_SECURE)).toBe(false);
    expect(esVerdadero(env.SMTP_SECURE)).toBe(true);
    expect(() => validate({ ...ENV_VALIDO, SMTP_SECURE: 'si' })).toThrow(
      "SMTP_SECURE: debe ser 'true'",
    );
  });

  it('rechaza una API_PUBLIC_URL inválida', () => {
    expect(() => validate({ ...ENV_VALIDO, API_PUBLIC_URL: 'localhost' })).toThrow(
      'API_PUBLIC_URL: debe ser una URL válida',
    );
  });

  describe('autenticación', () => {
    it('aplica los valores por defecto de sesión, bloqueo y verificación', () => {
      const env = validate(ENV_VALIDO);
      expect(env).toMatchObject({
        JWT_ACCESS_EXPIRES_MIN: 15,
        JWT_REFRESH_EXPIRES_DAYS: 7,
        LOGIN_MAX_INTENTOS: 5,
        LOGIN_BLOQUEO_MIN: 15,
        VERIFICACION_EXPIRA_HORAS: 24,
      });
    });

    it('convierte los valores configurados y rechaza los no positivos', () => {
      expect(validate({ ...ENV_VALIDO, LOGIN_MAX_INTENTOS: '3' }).LOGIN_MAX_INTENTOS).toBe(3);
      expect(() => validate({ ...ENV_VALIDO, LOGIN_BLOQUEO_MIN: '0' })).toThrow(
        'LOGIN_BLOQUEO_MIN: debe ser un número entero',
      );
    });

    it('exige secretos de al menos 32 caracteres y no tiene valores por defecto', () => {
      expect(() => validate({ ...ENV_VALIDO, JWT_ACCESS_SECRET: 'corto' })).toThrow(
        'JWT_ACCESS_SECRET: debe tener al menos 32 caracteres',
      );
      const sinSecreto: Record<string, string> = { ...ENV_VALIDO };
      delete sinSecreto.JWT_REFRESH_SECRET;
      expect(() => validate(sinSecreto)).toThrow('JWT_REFRESH_SECRET: es obligatoria');
    });

    it('exige secretos distintos', () => {
      expect(() =>
        validate({ ...ENV_VALIDO, JWT_REFRESH_SECRET: ENV_VALIDO.JWT_ACCESS_SECRET }),
      ).toThrow('debe ser distinto de JWT_ACCESS_SECRET');
    });

    it('en producción rechaza los secretos de ejemplo, pero no en desarrollo', () => {
      const ejemplo = 'dev-access-secret-cambiar-en-produccion';
      const conEjemplo = { ...ENV_VALIDO, JWT_ACCESS_SECRET: ejemplo };
      expect(() => validate({ ...conEjemplo, NODE_ENV: 'production' })).toThrow(
        'JWT_ACCESS_SECRET: en producción no puede conservar el valor de ejemplo',
      );
      expect(() => validate({ ...conEjemplo, NODE_ENV: 'development' })).not.toThrow();
    });

    it('la cookie es segura por defecto solo en producción', () => {
      expect(cookieSegura(validate(ENV_VALIDO))).toBe(false);
      expect(cookieSegura(validate({ ...ENV_VALIDO, NODE_ENV: 'production' }))).toBe(true);
      expect(
        cookieSegura(validate({ ...ENV_VALIDO, NODE_ENV: 'production', COOKIE_SECURE: 'false' })),
      ).toBe(false);
      expect(cookieSegura(validate({ ...ENV_VALIDO, COOKIE_SECURE: 'true' }))).toBe(true);
    });
  });
});
