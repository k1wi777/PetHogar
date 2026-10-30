import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { enviarReporte } from '@/features/adopciones/api/adopciones';
import {
  listarAdopciones,
  obtenerSeguimiento,
  programarSeguimiento,
  registrarResultado,
} from '@/features/adopciones-gestion/api/adopciones';
import { campoDelMensaje as campoSeguimiento } from '@/features/adopciones-gestion/lib/errores';
import type { AdopcionFundacion } from '@/features/adopciones-gestion/types';
import {
  listarDonaciones,
  registrarDonacionManual,
} from '@/features/donaciones-gestion/api/donaciones';
import { MENSAJE_PERIODO_INVERTIDO } from '@/features/donaciones-gestion/schemas/periodo';
import { esquemaDonacionManual } from '@/features/donaciones-gestion/schemas/donacion-manual';
import { registrarAdoptante, verificarCorreo } from '@/features/autenticacion/api/autenticacion';
import { esquemaAdoptante } from '@/features/autenticacion/schemas/adoptante';
import { listarEspecies, listarRazas } from '@/features/mascotas-gestion/api/catalogos';
import { crearMascota, darDeBaja } from '@/features/mascotas-gestion/api/mascotas';
import { crearSolicitud } from '@/features/solicitudes/api/solicitudes';
import {
  decidirSolicitud,
  descargarFormulario,
  listarSolicitudesRecibidas,
  obtenerSolicitudRecibida,
} from '@/features/solicitudes-gestion/api/solicitudes';
import { campoDelMensaje as campoDecision } from '@/features/solicitudes-gestion/lib/errores';
import { crearClienteHttp, type ClienteHttp } from '@/shared/api/cliente';
import { esErrorApi } from '@/shared/api/errores';
import type { RespuestaSesion } from '@/shared/api/tipos';
import { hoyEnBogota, restarDias, sumarDias } from '@/shared/lib/fechas';
import { rutaDeEnlace } from '@/shared/lib/enlaces';
import { traducirError } from '@/shared/lib/errores-formulario';
import { crearFetchConCookies } from './cookies';
import { conLimite } from './limite';
import { esperarCorreo, tokenDeVerificacion } from './mailpit';

const API = process.env.TEST_API_URL;
const ORIGEN = process.env.TEST_WEB_ORIGIN ?? 'http://localhost:3000';
const EMAIL_FUNDACION = process.env.TEST_DEMO_EMAIL ?? 'fundacion.demo@pethogar.local';
const CLAVE_FUNDACION = process.env.TEST_DEMO_PASSWORD;

const EJECUCION = Date.now().toString(36);
const CLAVE = 'ClaveSegura1';
// PNG de 1x1 píxel: firma binaria real, que es lo que valida el backend.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const png = (nombre = 'f.png') => new File([PNG_1X1], nombre, { type: 'image/png' });

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

/** Registra un adoptante, verifica su correo con Mailpit e inicia sesión. */
async function adoptanteVerificado(c: ClienteHttp, alias: string): Promise<void> {
  const email = `v17-${alias}-${EJECUCION}@pethogar.test`;
  const desde = Date.now();
  const datos = esquemaAdoptante.parse({
    primerNombre: alias === 'ana' ? 'Ana' : 'Beto',
    primerApellido: 'Gestion',
    tipoDocumento: 'CC',
    numeroDocumento: `G${alias[0]}${EJECUCION}${Math.floor(Math.random() * 1e6)}`.slice(0, 20),
    fechaNacimiento: '1990-05-10',
    telefono: '3001234567',
    email,
    direccion: 'Calle 1 # 2-3',
    ciudad: 'Montería',
    contrasena: CLAVE,
    aceptaPoliticaDatos: true,
  });
  await conLimite(() => registrarAdoptante(datos, c));
  const token = tokenDeVerificacion(await esperarCorreo(email, /Verifica tu correo/, desde));
  await conLimite(() => verificarCorreo(token, c));
  c.tokens.guardar((await iniciar(c, email, CLAVE)).accessToken);
}

async function bytesDe(c: ClienteHttp, url: string): Promise<Uint8Array> {
  const { blob } = await c.descargar(rutaDeEnlace(url));
  return new Uint8Array(await blob.arrayBuffer());
}
const esPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

/** Suma exacta de dos montos con 2 decimales, en centavos con BigInt (nunca `Number`). */
function sumarMontos(a: string, b: string): string {
  const centavos = (m: string) => {
    const [e, d = ''] = m.split('.');
    return BigInt(e!) * 100n + BigInt(d.padEnd(2, '0').slice(0, 2));
  };
  const total = centavos(a) + centavos(b);
  return `${total / 100n}.${(total % 100n).toString().padStart(2, '0')}`;
}

const CAMPOS_DECISION = ['decision', 'fechaEntrega', 'observacion'];

// Peticiones con límite propio: solicitudes POST 3 (10/min), resultados 3 (10/min), programar 4,
// donaciones POST 4 (10/min), descargas 5 (30/min); login y registro con `conLimite`.
describe('V17: solicitudes, adopciones y donaciones de la fundación contra la API real (capa de datos de las tres features)', () => {
  const ana = cliente();
  const beto = cliente();
  const fundacion = cliente();
  const hoy = hoyEnBogota();
  const ayer = restarDias(hoy, 1);
  let mascotaX: number;
  let mascotaY: number;
  let solicitudAX: number;
  let solicitudBX: number;
  let solicitudAY: number;
  let adopcionId: number;
  let visitaId: number;
  let reporteId: number;
  let reporteSinEnviarId: number;

  beforeAll(async () => {
    if (!API || !CLAVE_FUNDACION) {
      throw new Error(
        'Define TEST_API_URL, TEST_MAILPIT_URL y TEST_DEMO_PASSWORD. Ver verification.md (V17).',
      );
    }
    await adoptanteVerificado(ana, 'ana');
    await adoptanteVerificado(beto, 'beto');
    fundacion.tokens.guardar(
      (await iniciar(fundacion, EMAIL_FUNDACION, CLAVE_FUNDACION)).accessToken,
    );
    const especies = await listarEspecies(fundacion);
    const razas = await listarRazas(especies[0]!.id, fundacion);
    const nueva = async (sufijo: string) =>
      (
        await crearMascota(
          {
            nombre: `V17 gestión adopciones ${sufijo} ${EJECUCION}`.slice(0, 60),
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
    mascotaX = await nueva('X');
    mascotaY = await nueva('Y');
  }, 400_000);

  // Ninguna mascota de esta prueba debe quedar disponible: no altera el catálogo del seed.
  afterAll(async () => {
    for (const id of [mascotaX, mascotaY]) {
      if (!id) continue;
      try {
        await darDeBaja(id, fundacion);
      } catch (error) {
        // Una adoptada (o ya dada de baja) responde 409: es el estado esperado.
        if (!(esErrorApi(error) && error.estado === 409)) throw error;
      }
    }
  }, 60_000);

  it('Ana y Beto solicitan la misma mascota y Ana otra; la lista de la fundación filtra por estado y por mascota', async () => {
    const base = {
      motivo: 'Tengo patio y tiempo',
      tipoVivienda: 'casa' as const,
      tieneOtrasMascotas: false,
    };
    solicitudAX = (
      await crearSolicitud({ ...base, mascotaId: mascotaX, formulario: png('a.png') }, ana)
    ).id;
    solicitudBX = (
      await crearSolicitud({ ...base, mascotaId: mascotaX, formulario: png('b.png') }, beto)
    ).id;
    solicitudAY = (
      await crearSolicitud({ ...base, mascotaId: mascotaY, formulario: png('c.png') }, ana)
    ).id;

    const deX = await listarSolicitudesRecibidas(
      { pagina: 1, mascotaId: mascotaX },
      100,
      fundacion,
    );
    expect(deX.data.map((s) => s.id).sort()).toEqual([solicitudAX, solicitudBX].sort());
    expect(deX.data.every((s) => s.estado === 'pendiente' && s.mascota.id === mascotaX)).toBe(true);
    expect(deX.data[0]!.adoptante.nombreCompleto).toEqual(expect.any(String));

    const deY = await listarSolicitudesRecibidas(
      { pagina: 1, mascotaId: mascotaY },
      100,
      fundacion,
    );
    expect(deY.data.map((s) => s.id)).toEqual([solicitudAY]);
    const pendientes = await listarSolicitudesRecibidas(
      { pagina: 1, mascotaId: mascotaX, estado: 'pendiente' },
      100,
      fundacion,
    );
    expect(pendientes.total).toBe(2);
    const aprobadas = await listarSolicitudesRecibidas(
      { pagina: 1, mascotaId: mascotaX, estado: 'aprobada' },
      100,
      fundacion,
    );
    expect(aprobadas.total).toBe(0);
  }, 60_000);

  it('el detalle trae los datos del adoptante (sin documento ni dirección) y el formulario se descarga con la sesión', async () => {
    const detalle = await obtenerSolicitudRecibida(solicitudAX, fundacion);
    expect(detalle).toMatchObject({
      motivo: 'Tengo patio y tiempo',
      tipoVivienda: 'casa',
      tieneOtrasMascotas: false,
      observacion: null,
      adoptante: {
        nombreCompleto: expect.stringContaining('Ana'),
        email: expect.stringContaining('v17-ana-'),
        telefono: '3001234567',
        ciudad: 'Montería',
      },
    });
    expect(Object.keys(detalle.adoptante).sort()).toEqual([
      'ciudad',
      'email',
      'nombreCompleto',
      'telefono',
    ]);
    expect(detalle.formulario.url).toMatch(/^\/api\/fundacion\/solicitudes\/\d+\/formulario$/);
    const { blob, tipo } = await descargarFormulario(detalle.formulario.url, fundacion);
    expect(tipo).toBe('image/png');
    expect(esPng(new Uint8Array(await blob.arrayBuffer()))).toBe(true);
    // Una solicitud inexistente (o ajena) es 404.
    expect((await fallo(() => obtenerSolicitudRecibida(999_999_999, fundacion))).estado).toBe(404);
  });

  it('rechazar sin observación ⇒ 400 en «observacion»; con observación ⇒ rechazada y la fundación la ve', async () => {
    const sinMotivo = await fallo(() =>
      decidirSolicitud(solicitudAY, { decision: 'rechazar', observacion: '' }, fundacion),
    );
    expect(sinMotivo.estado).toBe(400);
    expect(traducirError(sinMotivo, CAMPOS_DECISION, campoDecision)).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'observacion' }],
    });
    const rechazada = await decidirSolicitud(
      solicitudAY,
      { decision: 'rechazar', observacion: 'No cumple los criterios' },
      fundacion,
    );
    expect(rechazada).toMatchObject({
      estado: 'rechazada',
      observacion: 'No cumple los criterios',
    });
    expect(rechazada.fechaRespuesta).not.toBeNull();
    expect(
      (
        await listarSolicitudesRecibidas(
          { pagina: 1, mascotaId: mascotaY, estado: 'rechazada' },
          100,
          fundacion,
        )
      ).total,
    ).toBe(1);
  });

  it('aprobar con fecha pasada ⇒ 400 en «fechaEntrega»; con hoy crea la adopción y la otra solicitud queda rechazada; decidir de nuevo ⇒ 409', async () => {
    const pasada = await fallo(() =>
      decidirSolicitud(solicitudAX, { decision: 'aprobar', fechaEntrega: ayer }, fundacion),
    );
    expect(pasada.estado).toBe(400);
    expect(traducirError(pasada, CAMPOS_DECISION, campoDecision)).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'fechaEntrega' }],
    });

    const aprobada = await decidirSolicitud(
      solicitudAX,
      { decision: 'aprobar', fechaEntrega: hoy, observacion: 'Bienvenidos' },
      fundacion,
    );
    expect(aprobada).toMatchObject({ estado: 'aprobada', observacion: 'Bienvenidos' });
    expect(aprobada.adopcion).toMatchObject({ fechaEntrega: hoy, estado: 'activa' });
    adopcionId = aprobada.adopcion!.id;

    // Cascada: la otra solicitud pendiente de la misma mascota se rechazó automáticamente.
    const deBeto = await obtenerSolicitudRecibida(solicitudBX, fundacion);
    expect(deBeto.estado).toBe('rechazada');

    const otraVez = await fallo(() =>
      decidirSolicitud(solicitudAX, { decision: 'rechazar', observacion: 'x' }, fundacion),
    );
    expect(otraVez.estado).toBe(409);
    const sobreLaRechazada = await fallo(() =>
      decidirSolicitud(solicitudBX, { decision: 'aprobar', fechaEntrega: hoy }, fundacion),
    );
    expect(sobreLaRechazada.estado).toBe(409);
  }, 60_000);

  /** La lista de adopciones es paginada y la fundación demo acumula adopciones de otras pruebas. */
  async function buscarAdopcion(id: number): Promise<AdopcionFundacion> {
    for (let pagina = 1; pagina <= 50; pagina++) {
      const p = await listarAdopciones({ pagina }, fundacion);
      const hallada = p.data.find((a) => a.id === id);
      if (hallada) return hallada;
      if (pagina * p.limit >= p.total) break;
    }
    throw new Error(`La adopción ${id} no aparece en la lista`);
  }

  it('la adopción aparece en la lista con el adoptante; programar visita y reporte, fecha igual a la entrega ⇒ 400 y duplicado ⇒ 409', async () => {
    const adopcion = await buscarAdopcion(adopcionId);
    expect(adopcion).toMatchObject({
      estado: 'activa',
      fechaEntrega: hoy,
      mascota: { id: mascotaX },
      adoptante: { ciudad: 'Montería', telefono: '3001234567' },
      seguimientos: [],
    });

    const igual = await fallo(() =>
      programarSeguimiento(adopcionId, { tipo: 'visita', fechaProgramada: hoy }, fundacion),
    );
    expect(igual.estado).toBe(400);
    expect(igual.mensaje).toContain(hoy);
    expect(traducirError(igual, ['tipo', 'fechaProgramada'], campoSeguimiento)).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'fechaProgramada' }],
    });

    const visita = await programarSeguimiento(
      adopcionId,
      { tipo: 'visita', fechaProgramada: sumarDias(hoy, 7) },
      fundacion,
    );
    const reporte = await programarSeguimiento(
      adopcionId,
      { tipo: 'reporte', fechaProgramada: sumarDias(hoy, 8) },
      fundacion,
    );
    const reporteSinEnviar = await programarSeguimiento(
      adopcionId,
      { tipo: 'reporte', fechaProgramada: sumarDias(hoy, 9) },
      fundacion,
    );
    visitaId = visita.id;
    reporteId = reporte.id;
    reporteSinEnviarId = reporteSinEnviar.id;
    expect(visita).toMatchObject({ tipo: 'visita', estado: 'programado', tieneReporte: false });

    const duplicado = await fallo(() =>
      programarSeguimiento(
        adopcionId,
        { tipo: 'visita', fechaProgramada: sumarDias(hoy, 7) },
        fundacion,
      ),
    );
    expect(duplicado.estado).toBe(409);

    // La línea de tiempo de la lista refleja los tres seguimientos programados.
    const despues = await buscarAdopcion(adopcionId);
    expect(despues.seguimientos.map((s) => s.id).sort()).toEqual(
      [visitaId, reporteId, reporteSinEnviarId].sort(),
    );
    expect(
      despues.seguimientos.every((s) => s.estado === 'programado' && s.vencido === false),
    ).toBe(true);
  }, 60_000);

  it('el adoptante envía su reporte con un PNG: la fundación ve comentarios y foto, y la descarga con la sesión', async () => {
    const antes = await obtenerSeguimiento(reporteId, fundacion);
    expect(antes).toMatchObject({ tieneReporte: false, reporte: null, adopcionId });
    await enviarReporte(
      reporteId,
      { comentarios: 'Está feliz y sano', fotos: [png('luna.png')] },
      ana,
    );

    const detalle = await obtenerSeguimiento(reporteId, fundacion);
    expect(detalle.tieneReporte).toBe(true);
    expect(detalle.reporte).toMatchObject({ comentarios: 'Está feliz y sano' });
    expect(detalle.reporte!.fotos).toHaveLength(1);
    expect(detalle.reporte!.fotos[0]!.url).toMatch(
      /^\/api\/fundacion\/seguimientos\/\d+\/evidencias\/\d+$/,
    );
    expect(esPng(await bytesDe(fundacion, detalle.reporte!.fotos[0]!.url))).toBe(true);
    // Otra fundación o un adoptante no ven este seguimiento por esta ruta.
    expect((await fallo(() => obtenerSeguimiento(reporteId, ana))).estado).toBe(403);
  }, 60_000);

  it('resultado de la visita con una evidencia PNG y bienestar malo; resultado del reporte; un reporte sin enviar ⇒ 409', async () => {
    const visita = await registrarResultado(
      visitaId,
      {
        fechaRealizada: hoy,
        estadoBienestar: 'malo',
        observaciones: 'Se ve flaco y decaído',
        evidencias: [png('evidencia.png')],
      },
      fundacion,
    );
    expect(visita).toMatchObject({
      estado: 'realizado',
      estadoBienestar: 'malo',
      observaciones: 'Se ve flaco y decaído',
      fechaRealizada: hoy,
    });
    expect(visita.evidencias).toHaveLength(1);
    expect(esPng(await bytesDe(fundacion, visita.evidencias[0]!.url))).toBe(true);
    expect((await obtenerSeguimiento(visitaId, fundacion)).estadoBienestar).toBe('malo');

    const reporte = await registrarResultado(
      reporteId,
      {
        fechaRealizada: hoy,
        estadoBienestar: 'regular',
        observaciones: 'Todo en orden',
        evidencias: [],
      },
      fundacion,
    );
    expect(reporte).toMatchObject({ estado: 'realizado', estadoBienestar: 'regular' });
    expect(reporte.reporte).not.toBeNull();

    const sinReporte = await fallo(() =>
      registrarResultado(
        reporteSinEnviarId,
        { fechaRealizada: hoy, estadoBienestar: 'bueno', observaciones: 'x', evidencias: [] },
        fundacion,
      ),
    );
    expect(sinReporte.estado).toBe(409);

    // Repetir el resultado de uno ya realizado ⇒ 409.
    const repetido = await fallo(() =>
      registrarResultado(
        visitaId,
        { fechaRealizada: hoy, estadoBienestar: 'bueno', observaciones: 'x', evidencias: [] },
        fundacion,
      ),
    );
    expect(repetido.estado).toBe(409);

    // El ciclo queda reflejado en la línea de tiempo de la adopción.
    const adopcion = await buscarAdopcion(adopcionId);
    const porId = new Map(adopcion.seguimientos.map((s) => [s.id, s]));
    expect(porId.get(visitaId)).toMatchObject({ estado: 'realizado', fechaRealizada: hoy });
    expect(porId.get(reporteId)).toMatchObject({ estado: 'realizado' });
    expect(porId.get(reporteSinEnviarId)).toMatchObject({ estado: 'programado' });
  }, 60_000);

  it('donaciones: totales por periodo (suma exacta como cadena), registro manual con comprobante y montos inválidos', async () => {
    const periodoHoy = { pagina: 1, desde: hoy, hasta: hoy };
    const periodoAyer = { pagina: 1, desde: ayer, hasta: ayer };
    const antes = await listarDonaciones(periodoHoy, fundacion);
    const antesAyer = await listarDonaciones(periodoAyer, fundacion);

    const economica = await registrarDonacionManual(
      esquemaDonacionManual.parse({
        tipo: 'economica',
        nombreDonante: 'María Gómez',
        monto: '50000,50',
      }),
      fundacion,
    );
    expect(economica).toMatchObject({
      tipo: 'economica',
      monto: '50000.50',
      comprobante: false,
    });
    const especie = await registrarDonacionManual(
      esquemaDonacionManual.parse({
        tipo: 'especie',
        nombreDonante: 'Pedro Ruiz',
        descripcion: '10 bultos de alimento',
        comprobante: png('recibo.png'),
      }),
      fundacion,
    );
    expect(especie).toMatchObject({
      tipo: 'especie',
      descripcionEspecie: '10 bultos de alimento',
      monto: null,
    });
    expect(especie.comprobante).toBe(true);

    const despues = await listarDonaciones(periodoHoy, fundacion);
    expect(despues.totales.economica.cantidad).toBe(antes.totales.economica.cantidad + 1);
    expect(despues.totales.economica.monto).toBe(
      sumarMontos(antes.totales.economica.monto, '50000.50'),
    );
    expect(despues.totales.especie.cantidad).toBe(antes.totales.especie.cantidad + 1);
    expect(typeof despues.totales.economica.monto).toBe('string');
    expect(despues.total).toBe(antes.total + 2);

    // El periodo de ayer no incluye estos aportes: sus totales no cambian.
    const despuesAyer = await listarDonaciones(periodoAyer, fundacion);
    expect(despuesAyer.totales).toEqual(antesAyer.totales);

    // El filtro por tipo no cambia los totales del otro tipo en cantidad coherente con la lista.
    const soloEspecie = await listarDonaciones({ ...periodoHoy, tipo: 'especie' }, fundacion);
    expect(soloEspecie.total).toBe(despues.totales.especie.cantidad);
    const fila = soloEspecie.data.find((d) => d.id === especie.id)!;
    expect(fila).toMatchObject({
      descripcionEspecie: '10 bultos de alimento',
      donante: { origen: 'manual' },
    });
    expect(esPng(await bytesDe(fundacion, fila.comprobante!.url))).toBe(true);
    expect(soloEspecie.data.find((d) => d.id === economica.id)).toBeUndefined();

    // Periodo invertido ⇒ 400 (el front no lo envía).
    const invertido = await fallo(() =>
      listarDonaciones({ pagina: 1, desde: hoy, hasta: ayer }, fundacion),
    );
    expect(invertido.estado).toBe(400);
    expect(invertido.mensaje + JSON.stringify(invertido.errores ?? [])).toContain(
      MENSAJE_PERIODO_INVERTIDO,
    );

    // Montos inválidos (se salta el esquema del front a propósito): 400 mapeado a «monto».
    for (const monto of ['0', '1000000000.01']) {
      const e = await fallo(() =>
        registrarDonacionManual(
          { tipo: 'economica', nombreDonante: 'María Gómez', monto },
          fundacion,
        ),
      );
      expect(e.estado).toBe(400);
      expect(
        traducirError(e, ['nombreDonante', 'tipo', 'monto', 'descripcion', 'comprobante']),
      ).toMatchObject({
        tipo: 'campos',
        campos: [{ campo: 'monto' }],
      });
    }
  }, 90_000);
});
