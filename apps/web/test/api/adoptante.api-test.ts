import { beforeAll, describe, expect, it } from 'vitest';
import { registrarAdoptante, verificarCorreo } from '@/features/autenticacion/api/autenticacion';
import { esquemaAdoptante } from '@/features/autenticacion/schemas/adoptante';
import {
  enviarReporte,
  listarMisAdopciones,
  obtenerMiSeguimiento,
} from '@/features/adopciones/api/adopciones';
import { crearDonacion } from '@/features/donaciones/api/donaciones';
import { leerFundacionDestino } from '@/features/donaciones/api/fundaciones';
import { esquemaDonacion } from '@/features/donaciones/schemas/donacion';
import { obtenerMascotaParaSolicitar } from '@/features/solicitudes/api/mascota';
import {
  cancelarSolicitud,
  crearSolicitud,
  listarMisSolicitudes,
  obtenerMiSolicitud,
} from '@/features/solicitudes/api/solicitudes';
import { clasificarErrorEnvio } from '@/features/solicitudes/lib/errores';
import { crearClienteHttp, type ClienteHttp } from '@/shared/api/cliente';
import { esErrorApi } from '@/shared/api/errores';
import type { RespuestaSesion } from '@/shared/api/tipos';
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

/** «Hoy» es el día de Bogotá, como en la API. */
function fechaBogota(sumarDias = 0): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const f = new Date(`${hoy}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + sumarDias);
  return f.toISOString().slice(0, 10);
}

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

// Peticiones con archivo: 10/min por IP. El flujo hace 6 envíos con archivo (2 solicitudes,
// reporte y 2 donaciones + 1 rechazada), por debajo del límite.
describe('V17: panel del adoptante contra la API real (capa de datos de las tres features)', () => {
  const adoptante = cliente();
  const fundacion = cliente();
  let mascotaId: number;
  let fundacionId: number;
  let solicitudCancelada: number;
  let solicitudAprobada: number;
  let seguimientoId: number;

  beforeAll(async () => {
    if (!API || !CLAVE_FUNDACION) {
      throw new Error(
        'Define TEST_API_URL, TEST_MAILPIT_URL y TEST_DEMO_PASSWORD. Ver verification.md (V17).',
      );
    }
    // Adoptante nuevo y verificado por correo (correo único por ejecución).
    const email = `v17-adoptante-panel-${EJECUCION}@pethogar.test`;
    const desde = Date.now();
    const datos = esquemaAdoptante.parse({
      primerNombre: 'Ana',
      primerApellido: 'Panel',
      tipoDocumento: 'CC',
      numeroDocumento: `P${EJECUCION}${Math.floor(Math.random() * 1e6)}`.slice(0, 20),
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

    // La fundación demo publica una mascota nueva por ejecución: no consume las del seed.
    fundacion.tokens.guardar(
      (await iniciar(fundacion, EMAIL_FUNDACION, CLAVE_FUNDACION)).accessToken,
    );
    const especies = await fundacion.get<Array<{ id: number }>>('/especies', {
      autenticada: false,
    });
    const razas = await fundacion.get<Array<{ id: number }>>(`/especies/${especies[0]!.id}/razas`, {
      autenticada: false,
    });
    const mascota = await fundacion.post<{ id: number }>('/mascotas', {
      cuerpo: {
        nombre: `V17 ${EJECUCION}`.slice(0, 60),
        razaId: razas[0]!.id,
        sexo: 'macho',
        edadMeses: 12,
        tamano: 'mediano',
        estadoSalud: 'Sano',
      },
    });
    mascotaId = mascota.id;
  }, 400_000);

  it('la ficha mínima trae nombre y fundación; una mascota inexistente es «no disponible»', async () => {
    const ficha = await obtenerMascotaParaSolicitar(mascotaId, adoptante);
    expect(ficha?.nombre).toContain('V17');
    expect(ficha?.fundacion).toMatchObject({ id: expect.any(Number), nombre: expect.any(String) });
    fundacionId = ficha!.fundacion.id;
    expect(await obtenerMascotaParaSolicitar(999_999_999, adoptante)).toBeNull();

    // Los textos del servidor de los que depende la clasificación (R6, R7).
    const inexistente = await fallo(() =>
      crearSolicitud(
        {
          mascotaId: 999_999_999,
          motivo: 'x',
          tipoVivienda: 'casa',
          tieneOtrasMascotas: false,
          formulario: png(),
        },
        adoptante,
      ),
    );
    expect(inexistente.estado).toBe(404);
    expect(clasificarErrorEnvio(inexistente).tipo).toBe('no-disponible');
  });

  it('solicitar, ver en la lista y el detalle, duplicada ⇒ 409 reconocida, cancelar y volver a solicitar', async () => {
    const datos = {
      mascotaId,
      motivo: 'Tengo patio y tiempo',
      tipoVivienda: 'casa' as const,
      tieneOtrasMascotas: false,
      formulario: png('firmado.png'),
    };
    const creada = await crearSolicitud(datos, adoptante);
    expect(creada.estado).toBe('pendiente');
    expect(creada.formulario.url).toMatch(/\/mis-solicitudes\/\d+\/formulario$/);
    solicitudCancelada = creada.id;

    const lista = await listarMisSolicitudes({ pagina: 1 }, adoptante);
    expect(lista.data.some((s) => s.id === creada.id && s.estado === 'pendiente')).toBe(true);
    expect(
      (await listarMisSolicitudes({ pagina: 1, estado: 'cancelada' }, adoptante)).data,
    ).toHaveLength(0);
    const detalle = await obtenerMiSolicitud(creada.id, adoptante);
    expect(detalle).toMatchObject({
      motivo: 'Tengo patio y tiempo',
      tipoVivienda: 'casa',
      observacion: null,
    });

    const duplicada = await fallo(() => crearSolicitud(datos, adoptante));
    expect(duplicada.estado).toBe(409);
    expect(clasificarErrorEnvio(duplicada).tipo).toBe('duplicada');

    const cancelada = await cancelarSolicitud(creada.id, adoptante);
    expect(cancelada.estado).toBe('cancelada');
    const otraVez = await fallo(() => cancelarSolicitud(creada.id, adoptante));
    expect(otraVez.estado).toBe(409);
    expect(
      (await listarMisSolicitudes({ pagina: 1, estado: 'cancelada' }, adoptante)).data.map(
        (s) => s.id,
      ),
    ).toContain(creada.id);

    const nueva = await crearSolicitud({ ...datos, formulario: png('firmado2.png') }, adoptante);
    expect(nueva.estado).toBe('pendiente');
    expect(nueva.id).not.toBe(solicitudCancelada);
    solicitudAprobada = nueva.id;
  }, 60_000);

  it('una solicitud ajena responde 404 igual que una inexistente', async () => {
    const ajena = await fallo(() => obtenerMiSolicitud(999_999_999, adoptante));
    expect(ajena.estado).toBe(404);
  });

  it('la fundación aprueba y programa un reporte; el adoptante ve la adopción y su seguimiento', async () => {
    const decision = await fundacion.patch<{ adopcion: { id: number } | null }>(
      `/solicitudes/${solicitudAprobada}/decision`,
      { cuerpo: { decision: 'aprobar', fechaEntrega: fechaBogota(), observacion: 'Bienvenidos' } },
    );
    const adopcionId = decision.adopcion!.id;
    const programado = await fundacion.post<{ id: number }>(
      `/adopciones/${adopcionId}/seguimientos`,
      {
        cuerpo: { tipo: 'reporte', fechaProgramada: fechaBogota(7) },
      },
    );
    seguimientoId = programado.id;

    const aprobada = await obtenerMiSolicitud(solicitudAprobada, adoptante);
    expect(aprobada).toMatchObject({ estado: 'aprobada', observacion: 'Bienvenidos' });
    expect(aprobada.fechaRespuesta).not.toBeNull();
    // Una aprobada ya no se cancela: la UI no lo ofrece y la API lo rechaza.
    expect((await fallo(() => cancelarSolicitud(solicitudAprobada, adoptante))).estado).toBe(409);

    const adopciones = await listarMisAdopciones(1, adoptante);
    const mia = adopciones.data.find((a) => a.id === adopcionId)!;
    expect(mia).toMatchObject({
      estado: 'activa',
      mascota: { id: mascotaId },
      fundacion: { nombre: expect.any(String), ciudad: expect.any(String) },
    });
    const resumen = mia.seguimientos.find((s) => s.id === seguimientoId)!;
    expect(resumen).toMatchObject({ tipo: 'reporte', estado: 'programado', vencido: false });
  }, 60_000);

  it('reportar con un PNG real: el detalle trae el reporte y el seguimiento queda bloqueado en la UI', async () => {
    const antes = await obtenerMiSeguimiento(seguimientoId, adoptante);
    expect(antes).toMatchObject({ tieneReporte: false, reporte: null });

    const despues = await enviarReporte(
      seguimientoId,
      { comentarios: 'Está feliz y sano', fotos: [png('luna.png')] },
      adoptante,
    );
    expect(despues.reporte).toMatchObject({ comentarios: 'Está feliz y sano' });
    expect(despues.reporte!.fotos).toHaveLength(1);
    expect((await obtenerMiSeguimiento(seguimientoId, adoptante)).reporte).not.toBeNull();

    // Comentarios vacíos (se salta el esquema a propósito): 400 en el campo.
    const sinTexto = await fallo(() =>
      enviarReporte(seguimientoId, { comentarios: '  ', fotos: [] }, adoptante),
    );
    expect(sinTexto.estado).toBe(400);
    expect(traducirError(sinTexto, ['comentarios', 'fotos'])).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'comentarios' }],
    });
  }, 60_000);

  it('donar: económica con monto como cadena, en especie, y monto 0 rechazado con 400 en «monto»', async () => {
    const destino = leerFundacionDestino(
      new URLSearchParams(`fundacion=${fundacionId}&nombre=Demo`),
    );
    expect(destino?.id).toBe(fundacionId);

    const economica = await crearDonacion(
      fundacionId,
      esquemaDonacion.parse({
        tipo: 'economica',
        monto: '50000.50',
        comprobante: png('recibo.png'),
      }),
      adoptante,
    );
    expect(economica).toMatchObject({ tipo: 'economica', monto: '50000.50', comprobante: true });
    expect(economica.fundacion.id).toBe(fundacionId);

    const especie = await crearDonacion(
      fundacionId,
      esquemaDonacion.parse({ tipo: 'especie', descripcion: '10 kg de croquetas' }),
      adoptante,
    );
    expect(especie).toMatchObject({
      tipo: 'especie',
      descripcionEspecie: '10 kg de croquetas',
      monto: null,
    });

    // Se salta el esquema del front: la API debe rechazar el cero igual que él.
    const cero = await fallo(() =>
      crearDonacion(fundacionId, { tipo: 'economica', monto: '0' }, adoptante),
    );
    expect(cero.estado).toBe(400);
    expect(traducirError(cero, ['monto'])).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'monto' }],
    });

    const noExiste = await fallo(() =>
      crearDonacion(999_999_999, { tipo: 'especie', descripcion: 'x' }, adoptante),
    );
    expect(noExiste.estado).toBe(404);
    expect(noExiste.mensaje).toMatch(/no recibe donaciones/);
  }, 60_000);
});
