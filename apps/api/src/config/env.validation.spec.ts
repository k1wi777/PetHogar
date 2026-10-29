import { esVerdadero, validate } from './env.validation';

const ENV_VALIDO = {
  PORT: '3001',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'pethogar',
  DATABASE_PASSWORD: 'pethogar',
  DATABASE_NAME: 'pethogar',
  JWT_ACCESS_SECRET: 'a',
  JWT_REFRESH_SECRET: 'b',
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

  it('trata como opcionales las variables de correo, URL pública y endpoints de prueba', () => {
    const env = validate(ENV_VALIDO);
    expect(env.SMTP_USER).toBeUndefined();
    expect(esVerdadero(env.HABILITAR_ENDPOINTS_PRUEBA)).toBe(false);
  });

  it("valida los booleanos como 'true' o 'false' sin convertir la cadena 'false' en true", () => {
    const env = validate({
      ...ENV_VALIDO,
      HABILITAR_ENDPOINTS_PRUEBA: 'false',
      SMTP_SECURE: 'true',
    });
    expect(esVerdadero(env.HABILITAR_ENDPOINTS_PRUEBA)).toBe(false);
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
});
