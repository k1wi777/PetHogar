import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listarMisAdopciones } from '@/features/adopciones/api/adopciones';
import {
  cerrarAdopcion,
  listarAdopciones,
  programarSeguimiento,
  subirActa,
} from '@/features/adopciones-gestion/api/adopciones';
import {
  campoDelMensajeCierre,
  esAdopcionCerrada,
} from '@/features/adopciones-gestion/lib/errores';
import type { AdopcionFundacion } from '@/features/adopciones-gestion/types';
import { registrarAdoptante, verificarCorreo } from '@/features/autenticacion/api/autenticacion';
import { esquemaAdoptante } from '@/features/autenticacion/schemas/adoptante';
import { obtenerFicha } from '@/features/catalogo/api/mascotas';
import { listarEspecies, listarRazas } from '@/features/mascotas-gestion/api/catalogos';
import {
  crearMascota,
  darDeBaja,
  obtenerMascotaGestion,
} from '@/features/mascotas-gestion/api/mascotas';
import { contarNoLeidas } from '@/features/notificaciones/api/contar';
import {
  leerTodas,
  listarNotificaciones,
  marcarLeida,
} from '@/features/notificaciones/api/notificaciones';
import { destinoDe } from '@/features/notificaciones/lib/destino';
import type { Notificacion } from '@/features/notificaciones/types';
import { crearSolicitud } from '@/features/solicitudes/api/solicitudes';
import { decidirSolicitud } from '@/features/solicitudes-gestion/api/solicitudes';
import { crearClienteHttp, type ClienteHttp } from '@/shared/api/cliente';
import { esErrorApi } from '@/shared/api/errores';
import type { RespuestaSesion } from '@/shared/api/tipos';
import { crearClienteServidor } from '@/shared/api/servidor';
import { rutaDeEnlace } from '@/shared/lib/enlaces';
import { traducirError } from '@/shared/lib/errores-formulario';
import { hoyEnBogota, sumarDias } from '@/shared/lib/fechas';
import { crearFetchConCookies } from './cookies';
import { conLimite } from './limite';
import { esperarCorreo, tokenDeVerificacion } from './mailpit';

const API = process.env.TEST_API_URL;
const ORIGEN = process.env.TEST_WEB_ORIGIN ?? 'http://localhost:3000';
const EMAIL_FUNDACION = process.env.TEST_DEMO_EMAIL ?? 'fundacion.demo@pethogar.local';
const CLAVE_FUNDACION = process.env.TEST_DEMO_PASSWORD;
const EJECUCION = Date.now().toString(36);
const CLAVE = 'ClaveSegura1';
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const png = (n = 'f.png') => new File([PNG_1X1], n, { type: 'image/png' });
const esPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const CAMPOS_CIERRE = ['estado', 'motivo', 'mascotaDestino'];

async function fallo(accion: () => Promise<unknown>) {
  try {
    await accion();
  } catch (error) {
    if (esErrorApi(error)) return error;
    throw error;
  }
  throw new Error('Se esperaba un error de la API y la llamada tuvo éxito');
}

function cliente(): ClienteHttp {
  const jar = crearFetchConCookies(ORIGEN);
  return crearClienteHttp({ baseUrl: API!, fetchImpl: jar.fetchImpl, cerrojos: null });
}
const iniciar = (c: ClienteHttp, email: string, contrasena: string) =>
  conLimite(() =>
    c.post<RespuestaSesion>('/auth/login', { autenticada: false, cuerpo: { email, contrasena } }),
  );

/** Espera (con tope de tiempo, nunca un sleep fijo) a que se cumpla una condición. */
async function esperarHasta<T>(
  leer: () => Promise<T>,
  cumple: (v: T) => boolean,
  descripcion: string,
  topeMs = 25_000,
): Promise<T> {
  const limite = Date.now() + topeMs;
  for (;;) {
    const v = await leer();
    if (cumple(v)) return v;
    if (Date.now() > limite) throw new Error(`Tiempo agotado esperando: ${descripcion}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function bytesDe(c: ClienteHttp, url: string): Promise<Uint8Array> {
  const { blob } = await c.descargar(rutaDeEnlace(url));
  return new Uint8Array(await blob.arrayBuffer());
}

// Presupuesto: solicitudes POST 3 (10/min), actas 3 (10/min), descargas ≤ 3 por rol (30/min),
// sondeos cada 1,5 s (120/min); login y registro con `conLimite`.
describe('V17: notificaciones y cierre de adopciones contra la API real (capa de datos del front)', () => {
  const adoptante = cliente();
  const fundacion = cliente();
  const hoy = hoyEnBogota();
  const mascotas: Record<'A' | 'B' | 'C', number> = { A: 0, B: 0, C: 0 };
  const solicitudes: Record<'A' | 'B' | 'C', number> = { A: 0, B: 0, C: 0 };
  const adopciones: Record<'A' | 'B' | 'C', number> = { A: 0, B: 0, C: 0 };
  let primera: Notificacion;

  const noLeidas = async () => (await contarNoLeidas(adoptante)).noLeidas;
  const lista = (filtro: 'todas' | 'no-leidas' | 'leidas') =>
    listarNotificaciones({ pagina: 1, filtro }, 100, adoptante);

  async function buscarAdopcion(id: number): Promise<AdopcionFundacion> {
    for (let pagina = 1; pagina <= 50; pagina++) {
      const p = await listarAdopciones({ pagina }, fundacion);
      const hallada = p.data.find((a) => a.id === id);
      if (hallada) return hallada;
      if (pagina * p.limit >= p.total) break;
    }
    throw new Error(`La adopción ${id} no aparece en la lista`);
  }

  beforeAll(async () => {
    if (!API || !CLAVE_FUNDACION) {
      throw new Error(
        'Define TEST_API_URL, TEST_MAILPIT_URL y TEST_DEMO_PASSWORD. Ver verification.md (V17).',
      );
    }
    const email = `v17-noti-${EJECUCION}@pethogar.test`;
    const desde = Date.now();
    const datos = esquemaAdoptante.parse({
      primerNombre: 'Noti',
      primerApellido: 'Cierre',
      tipoDocumento: 'CC',
      numeroDocumento: `N${EJECUCION}${Math.floor(Math.random() * 1e6)}`.slice(0, 20),
      fechaNacimiento: '1990-05-10',
      telefono: '3001234567',
      email,
      direccion: 'Calle 1 # 2-3',
      ciudad: 'Montería',
      contrasena: CLAVE,
      aceptaPoliticaDatos: true,
    });
    await conLimite(() => registrarAdoptante(datos, adoptante));
    const token = tokenDeVerificacion(await esperarCorreo(email, /Verifica tu correo/, desde));
    await conLimite(() => verificarCorreo(token, adoptante));
    adoptante.tokens.guardar((await iniciar(adoptante, email, CLAVE)).accessToken);
    fundacion.tokens.guardar(
      (await iniciar(fundacion, EMAIL_FUNDACION, CLAVE_FUNDACION)).accessToken,
    );

    const especies = await listarEspecies(fundacion);
    const razas = await listarRazas(especies[0]!.id, fundacion);
    for (const k of ['A', 'B', 'C'] as const) {
      mascotas[k] = (
        await crearMascota(
          {
            nombre: `V17 notificaciones ${k} ${EJECUCION}`.slice(0, 60),
            razaId: razas[0]!.id,
            sexo: 'macho',
            edadMeses: 12,
            tamano: 'mediano',
            estadoSalud: 'Sano',
            esterilizado: false,
            vacunado: false,
          },
          fundacion,
        )
      ).id;
      solicitudes[k] = (
        await crearSolicitud(
          {
            mascotaId: mascotas[k],
            motivo: 'Tengo patio y tiempo',
            tipoVivienda: 'casa',
            tieneOtrasMascotas: false,
            formulario: png(`${k}.png`),
          },
          adoptante,
        )
      ).id;
    }
  }, 400_000);

  // Ninguna mascota debe quedar disponible: no altera el catálogo del seed ni otras pruebas.
  afterAll(async () => {
    for (const id of Object.values(mascotas)) {
      if (!id) continue;
      try {
        await darDeBaja(id, fundacion);
      } catch (error) {
        if (!(esErrorApi(error) && error.estado === 409)) throw error;
      }
    }
  }, 60_000);

  it('un adoptante nuevo no tiene notificaciones', async () => {
    expect(await noLeidas()).toBe(0);
    expect((await lista('todas')).total).toBe(0);
  });

  it('la fundación recibe el aviso de las solicitudes y su destino es una pantalla de la fundación', async () => {
    const p = await esperarHasta(
      () => listarNotificaciones({ pagina: 1, filtro: 'todas' }, 100, fundacion),
      (r) =>
        r.data.some((n) => n.referencia?.id === solicitudes.A && n.referencia.tipo === 'solicitud'),
      'aviso de nueva solicitud a la fundación',
    );
    const n = p.data.find((x) => x.referencia?.id === solicitudes.A)!;
    expect(destinoDe(n, 'fundacion')).toBe(`/fundacion/solicitudes/${solicitudes.A}`);
  });

  it('aprobar una solicitud hace aparecer la notificación del adoptante y sube el contador', async () => {
    const aprobada = await decidirSolicitud(
      solicitudes.A,
      { decision: 'aprobar', fechaEntrega: hoy },
      fundacion,
    );
    adopciones.A = aprobada.adopcion!.id;
    const p = await esperarHasta(
      lista.bind(null, 'todas'),
      (r) => r.data.some((n) => n.referencia?.id === solicitudes.A),
      'notificación de solicitud aprobada',
    );
    primera = p.data.find((n) => n.referencia?.id === solicitudes.A)!;
    expect(primera).toMatchObject({ tipo: 'solicitud', leida: false });
    expect(primera.referencia).toEqual({ tipo: 'solicitud', id: solicitudes.A });
    expect(await noLeidas()).toBe(1);
    expect(destinoDe(primera, 'adoptante')).toBe(`/adoptante/solicitudes/${solicitudes.A}`);
  });

  it('marcar leída baja el contador y es idempotente', async () => {
    expect((await marcarLeida(primera.id, adoptante)).leida).toBe(true);
    expect(await noLeidas()).toBe(0);
    expect((await marcarLeida(primera.id, adoptante)).leida).toBe(true);
    expect(await noLeidas()).toBe(0);
  });

  it('la ajena y la inexistente responden el mismo 404', async () => {
    const ajena = await fallo(() => marcarLeida(primera.id, fundacion));
    const inexistente = await fallo(() => marcarLeida(999_999_999, adoptante));
    expect(ajena.estado).toBe(404);
    expect(inexistente.estado).toBe(404);
    expect(ajena.mensaje).toBe(inexistente.mensaje);
    expect(await noLeidas()).toBe(0);
  });

  it('leer todas marca solo las propias y los filtros coinciden con el contador', async () => {
    for (const k of ['B', 'C'] as const) {
      const a = await decidirSolicitud(
        solicitudes[k],
        { decision: 'aprobar', fechaEntrega: hoy },
        fundacion,
      );
      adopciones[k] = a.adopcion!.id;
    }
    await esperarHasta(noLeidas, (n) => n === 2, 'dos notificaciones sin leer');
    expect((await lista('no-leidas')).total).toBe(2);
    const fundacionAntes = (await contarNoLeidas(fundacion)).noLeidas;
    expect((await leerTodas(adoptante)).actualizadas).toBe(2);
    expect(await noLeidas()).toBe(0);
    expect((await lista('no-leidas')).total).toBe(0);
    expect((await lista('leidas')).total).toBe(3);
    expect((await lista('todas')).total).toBe(3);
    expect((await contarNoLeidas(fundacion)).noLeidas).toBe(fundacionAntes);
    expect((await leerTodas(adoptante)).actualizadas).toBe(0);
  });

  it('mascota A: acta falsa ⇒ 400, acta real ⇒ guardada y descargable por la fundación y el adoptante', async () => {
    const falsa = new File([Buffer.from('no soy un png')], 'a.png', { type: 'image/png' });
    expect((await fallo(() => subirActa(adopciones.A, falsa, fundacion))).estado).toBe(400);
    const subida = await subirActa(adopciones.A, png('acta.png'), fundacion);
    expect(subida.acta).not.toBeNull();
    expect(esPng(await bytesDe(fundacion, subida.acta!.url))).toBe(true);
    const mias = await listarMisAdopciones(1, adoptante);
    const propia = mias.data.find((a) => a.id === adopciones.A)!;
    expect(propia.acta?.url).toContain(`/mis-adopciones/${adopciones.A}/acta`);
    expect(esPng(await bytesDe(adoptante, propia.acta!.url))).toBe(true);
    expect(
      (await fallo(() => fundacion.descargar('/fundacion/adopciones/999999999/acta'))).estado,
    ).toBe(404);
    expect((await fallo(() => adoptante.descargar('/mis-adopciones/999999999/acta'))).estado).toBe(
      404,
    );
  }, 60_000);

  it('mascota A: finalizar sin motivo ⇒ 400 en «motivo»; con motivo queda finalizada y la mascota sigue adoptada', async () => {
    const sinMotivo = await fallo(() =>
      cerrarAdopcion(adopciones.A, { estado: 'finalizada', motivo: '' }, fundacion),
    );
    expect(sinMotivo.estado).toBe(400);
    expect(traducirError(sinMotivo, CAMPOS_CIERRE, campoDelMensajeCierre)).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'motivo' }],
    });
    const cerrada = await cerrarAdopcion(
      adopciones.A,
      { estado: 'finalizada', motivo: 'Todo salió bien' },
      fundacion,
    );
    expect(cerrada).toMatchObject({ estado: 'finalizada', motivoCierre: 'Todo salió bien' });
    expect(cerrada.fechaCierre).not.toBeNull();
    expect((await obtenerMascotaGestion(mascotas.A, fundacion)).estado).toBe('adoptada');
  });

  it('mascota A: ya cerrada ⇒ 409 al subir acta y al cerrar; la descarga sigue funcionando', async () => {
    const acta = await fallo(() => subirActa(adopciones.A, png(), fundacion));
    expect(acta.estado).toBe(409);
    expect(esAdopcionCerrada(acta)).toBe(true);
    const otraVez = await fallo(() =>
      cerrarAdopcion(
        adopciones.A,
        { estado: 'revocada', motivo: 'x', mascotaDestino: 'inactiva' },
        fundacion,
      ),
    );
    expect(otraVez.estado).toBe(409);
    const cerrada = await buscarAdopcion(adopciones.A);
    expect(esPng(await bytesDe(fundacion, cerrada.acta!.url))).toBe(true);
    const mias = (await listarMisAdopciones(1, adoptante)).data.find((a) => a.id === adopciones.A)!;
    expect(mias.estado).toBe('finalizada');
    expect(esPng(await bytesDe(adoptante, mias.acta!.url))).toBe(true);
  });

  it('mascota B: revocar a disponible cancela seguimientos y la deja en el catálogo (se da de baja de inmediato)', async () => {
    await programarSeguimiento(
      adopciones.B,
      { tipo: 'visita', fechaProgramada: sumarDias(hoy, 7) },
      fundacion,
    );
    const cerrada = await cerrarAdopcion(
      adopciones.B,
      { estado: 'revocada', motivo: 'No la cuidaba', mascotaDestino: 'disponible' },
      fundacion,
    );
    expect(cerrada.estado).toBe('revocada');
    expect(cerrada.seguimientos.every((s) => s.estado === 'cancelado')).toBe(true);
    expect(cerrada.seguimientos).toHaveLength(1);
    expect((await obtenerMascotaGestion(mascotas.B, fundacion)).estado).toBe('disponible');
    const servidor = crearClienteServidor({ baseUrl: API! });
    expect(await obtenerFicha(String(mascotas.B), servidor)).not.toBeNull();
    await darDeBaja(mascotas.B, fundacion);
    expect(await obtenerFicha(String(mascotas.B), servidor)).toBeNull();
  }, 60_000);

  it('mascota C: revocar sin destino ⇒ 400 en «mascotaDestino»; a inactiva la deja fuera del catálogo', async () => {
    const sinDestino = await fallo(() =>
      cerrarAdopcion(
        adopciones.C,
        { estado: 'revocada', motivo: 'x' } as unknown as Parameters<typeof cerrarAdopcion>[1],
        fundacion,
      ),
    );
    expect(sinDestino.estado).toBe(400);
    expect(traducirError(sinDestino, CAMPOS_CIERRE, campoDelMensajeCierre)).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'mascotaDestino' }],
    });
    const cerrada = await cerrarAdopcion(
      adopciones.C,
      { estado: 'revocada', motivo: 'Se mudó', mascotaDestino: 'inactiva' },
      fundacion,
    );
    expect(cerrada.estado).toBe('revocada');
    expect((await obtenerMascotaGestion(mascotas.C, fundacion)).estado).toBe('inactiva');
    expect(
      await obtenerFicha(String(mascotas.C), crearClienteServidor({ baseUrl: API! })),
    ).toBeNull();
  });

  it('los cierres avisan al adoptante y su destino es «Mis adopciones»', async () => {
    const p = await esperarHasta(
      lista.bind(null, 'no-leidas'),
      (r) => r.data.filter((n) => n.referencia?.tipo === 'adopcion').length >= 3,
      'tres avisos de cierre',
    );
    const cierres = p.data.filter((n) => n.referencia?.tipo === 'adopcion');
    expect(cierres.every((n) => destinoDe(n, 'adoptante') === '/adoptante/adopciones')).toBe(true);
    expect(await noLeidas()).toBe(p.total);
  });
});
