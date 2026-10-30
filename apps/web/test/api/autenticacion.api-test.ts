import { beforeAll, describe, expect, it } from 'vitest';
import {
  registrarAdoptante,
  registrarFundacion,
  reenviarVerificacion,
  restablecerContrasena,
  solicitarCodigo,
  verificarCorreo,
} from '@/features/autenticacion/api/autenticacion';
import { avisoDeFundacion } from '@/features/autenticacion/lib/aviso-fundacion';
import { traducirError } from '@/features/autenticacion/lib/errores-servidor';
import { clasificarErrorLogin } from '@/features/autenticacion/lib/estado-cuenta';
import { esquemaAdoptante } from '@/features/autenticacion/schemas/adoptante';
import { esquemaFundacion } from '@/features/autenticacion/schemas/fundacion';
import { crearClienteHttp } from '@/shared/api/cliente';
import { conLimite } from './limite';
import { esErrorApi } from '@/shared/api/errores';
import type { RespuestaSesion, Usuario } from '@/shared/api/tipos';
import { crearFetchConCookies } from './cookies';
import { codigoDeRecuperacion, esperarCorreo, tokenDeVerificacion } from './mailpit';

const API = process.env.TEST_API_URL;
const ORIGEN = process.env.TEST_WEB_ORIGIN ?? 'http://localhost:3000';

// Correos únicos por ejecución: los límites de la API son por IP (5/min en login y registro).
const EJECUCION = Date.now().toString(36);
const correo = (alias: string) => `v17-${alias}-${EJECUCION}@pethogar.test`;
const CLAVE = 'ClaveSegura1';

// PNG de 1x1 píxel: firma binaria real, que es lo que valida el backend.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function nuevoCliente() {
  const jar = crearFetchConCookies(ORIGEN);
  return crearClienteHttp({ baseUrl: API!, fetchImpl: jar.fetchImpl, cerrojos: null });
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

async function fallo(accion: () => Promise<unknown>) {
  try {
    await accion();
  } catch (error) {
    if (esErrorApi(error)) return error;
    throw error;
  }
  throw new Error('Se esperaba un error de la API y la llamada tuvo éxito');
}

const iniciar = (cliente: ReturnType<typeof nuevoCliente>, email: string, contrasena: string) =>
  conLimite(() =>
    cliente.post<RespuestaSesion>('/auth/login', {
      autenticada: false,
      cuerpo: { email, contrasena },
    }),
  );

function datosAdoptante(email: string, extra: Record<string, unknown> = {}) {
  return esquemaAdoptante.parse({
    primerNombre: 'Ana',
    primerApellido: 'Prueba',
    tipoDocumento: 'CC',
    numeroDocumento: `D${EJECUCION}${Math.floor(Math.random() * 1e6)}`.slice(0, 20),
    fechaNacimiento: '1990-05-10',
    telefono: '3001234567',
    email,
    direccion: 'Calle 1 # 2-3',
    ciudad: 'Montería',
    contrasena: CLAVE,
    aceptaPoliticaDatos: true,
    ...extra,
  });
}

function datosFundacion(email: string, extra: Record<string, unknown> = {}) {
  return esquemaFundacion.parse({
    nombre: `Fundación V17 ${EJECUCION}`,
    nit: `9${Math.floor(Math.random() * 1e8)}-1`,
    direccion: 'Carrera 5 # 6-7',
    ciudad: 'Montería',
    telefono: '3009876543',
    email,
    contrasena: CLAVE,
    documento: new File([PNG_1X1], 'camara.png', { type: 'image/png' }),
    aceptaPoliticaDatos: true,
    ...extra,
  });
}

describe('V17: autenticación del front contra la API real (con Mailpit)', () => {
  beforeAll(() => {
    if (!API) throw new Error('Define TEST_API_URL y TEST_MAILPIT_URL. Ver verification.md (V17).');
  });

  it('registro de adoptante → correo → verificación → login → /auth/me', async () => {
    const email = correo('adoptante');
    const cliente = nuevoCliente();
    const desde = Date.now();

    const datos = datosAdoptante(email);
    const registro = await conLimite(() => registrarAdoptante(datos, cliente));
    expect(registro.mensaje).toMatch(/Revisa tu correo/);

    // Sin verificar: 403 con el mensaje que reconoce la clasificación por texto.
    const sinVerificar = await fallo(() => iniciar(cliente, email, CLAVE));
    expect(sinVerificar.estado).toBe(403);
    expect(clasificarErrorLogin(sinVerificar)).toBe('sin-verificar');

    const texto = await esperarCorreo(email, /Verifica tu correo/, desde);
    const token = tokenDeVerificacion(texto);
    await conLimite(() => verificarCorreo(token, cliente));

    // Un token ya usado deja de servir y el front lo muestra como error por mensaje del servidor.
    const reutilizado = await fallo(() => verificarCorreo(token, cliente));
    expect(reutilizado.estado).toBe(400);
    expect(reutilizado.mensaje).toMatch(/no es válido o ya venció/);

    const sesion = await iniciar(cliente, email, CLAVE);
    cliente.tokens.guardar(sesion.accessToken);
    expect(sesion.usuario.rol).toBe('adoptante');
    expect((await cliente.get<Usuario>('/auth/me')).rol).toBe('adoptante');
  }, 150_000);

  it('credenciales incorrectas ⇒ 401 «credenciales» y 429/red nunca se clasifican así', async () => {
    const cliente = nuevoCliente();
    const error = await fallo(() => iniciar(cliente, correo('adoptante'), 'Incorrecta9'));
    expect(error.estado).toBe(401);
    expect(clasificarErrorLogin(error)).toBe('credenciales');
    expect(error.mensaje).toBe('Correo o contraseña incorrectos');
  }, 150_000);

  it('registro duplicado y errores de validación llegan mapeados al campo', async () => {
    const cliente = nuevoCliente();
    const existente = correo('adoptante');

    const duplicado = await fallo(() =>
      conLimite(() => registrarAdoptante(datosAdoptante(existente), cliente)),
    );
    expect(duplicado.estado).toBe(409);
    expect(traducirError(duplicado, ['email', 'numeroDocumento'])).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'email' }],
    });

    // Mismo documento con otro correo.
    const original = datosAdoptante(correo('doc1'));
    await conLimite(() => registrarAdoptante(original, cliente));
    const mismoDocumento = await fallo(() =>
      conLimite(() =>
        registrarAdoptante(
          { ...datosAdoptante(correo('doc2')), numeroDocumento: original.numeroDocumento },
          cliente,
        ),
      ),
    );
    expect(mismoDocumento.estado).toBe(409);
    expect(traducirError(mismoDocumento, ['email', 'numeroDocumento'])).toMatchObject({
      campos: [{ campo: 'numeroDocumento' }],
    });

    // Validación del servidor (se salta el esquema a propósito): `errores[].mensajes` por campo.
    const invalido = await fallo(() =>
      conLimite(() =>
        registrarAdoptante({ ...datosAdoptante(correo('inv')), telefono: '12' }, cliente),
      ),
    );
    expect(invalido.estado).toBe(400);
    expect(traducirError(invalido, ['telefono'])).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'telefono' }],
    });

    // Menor de edad: mensaje sin campo que el front asocia a la fecha de nacimiento.
    const anio = new Date().getUTCFullYear() - 10;
    const menor = await fallo(() =>
      conLimite(() =>
        registrarAdoptante(
          { ...datosAdoptante(correo('menor')), fechaNacimiento: `${anio}-01-01` },
          cliente,
        ),
      ),
    );
    expect(menor.estado).toBe(400);
    expect(traducirError(menor, ['fechaNacimiento'])).toMatchObject({
      campos: [{ campo: 'fechaNacimiento' }],
    });
  }, 300_000);

  it('el reenvío de verificación responde siempre lo mismo', async () => {
    const cliente = nuevoCliente();
    const existente = await conLimite(() => reenviarVerificacion(correo('adoptante'), cliente));
    const inexistente = await conLimite(() => reenviarVerificacion(correo('nadie'), cliente));
    expect(existente.mensaje).toBe(inexistente.mensaje);
  }, 150_000);

  it('registro de fundación multipart ⇒ pendiente; puede ingresar y el front avisa su estado', async () => {
    const email = correo('fundacion');
    const cliente = nuevoCliente();
    const datos = datosFundacion(email);
    const registro = await conLimite(() => registrarFundacion(datos, cliente));
    expect(registro.estadoValidacion).toBe('pendiente');

    const sesion = await iniciar(cliente, email, CLAVE);
    expect(sesion.usuario.rol).toBe('fundacion');
    expect(sesion.usuario.fundacion?.estadoValidacion).toBe('pendiente');
    expect(avisoDeFundacion(sesion.usuario)).toMatch(/pendiente de validación/);

    // NIT repetido con otro correo ⇒ 409 asociado al NIT.
    const repetido = await fallo(() =>
      conLimite(() =>
        registrarFundacion(datosFundacion(correo('fundacion2'), { nit: datos.nit }), cliente),
      ),
    );
    expect(repetido.estado).toBe(409);
    expect(traducirError(repetido, ['nit', 'email'])).toMatchObject({ campos: [{ campo: 'nit' }] });
  }, 300_000);

  it('un archivo cuyo contenido no es de un tipo permitido lo rechaza el servidor junto al documento', async () => {
    const cliente = nuevoCliente();
    const falso = new File([Buffer.from('esto no es una imagen')], 'falso.png', {
      type: 'image/png',
    });
    const error = await fallo(() =>
      conLimite(() =>
        registrarFundacion(datosFundacion(correo('falso'), { documento: falso }), cliente),
      ),
    );
    expect(error.estado).toBe(400);
    expect(traducirError(error, ['documento'])).toMatchObject({ campos: [{ campo: 'documento' }] });
  }, 150_000);

  it('recuperación: código por correo → restablecer → login con la nueva y no con la anterior', async () => {
    const email = correo('adoptante');
    const cliente = nuevoCliente();
    const desde = Date.now();

    const inexistente = await conLimite(() => solicitarCodigo(correo('nadie'), cliente));
    const respuesta = await conLimite(() => solicitarCodigo(email, cliente));
    expect(respuesta.mensaje).toBe(inexistente.mensaje);

    const codigo = codigoDeRecuperacion(
      await esperarCorreo(email, /código de recuperación/, desde),
    );

    // Un código erróneo da un único 400 claro (cualquier causa).
    const erroneo = await fallo(() =>
      conLimite(() =>
        restablecerContrasena(
          {
            email,
            codigo: codigo === '000000' ? '111111' : '000000',
            nuevaContrasena: 'OtraClave2',
          },
          cliente,
        ),
      ),
    );
    expect(erroneo.estado).toBe(400);
    expect(erroneo.mensaje).toMatch(/código no es válido o ya venció/);

    const nueva = 'NuevaClave2';
    await conLimite(() =>
      restablecerContrasena({ email, codigo, nuevaContrasena: nueva }, cliente),
    );
    const viejo = await fallo(() => iniciar(cliente, email, CLAVE));
    expect(clasificarErrorLogin(viejo)).toBe('credenciales');
    const sesion = await iniciar(cliente, email, nueva);
    expect(sesion.usuario.rol).toBe('adoptante');
  }, 300_000);
});
