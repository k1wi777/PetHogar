import { beforeAll, describe, expect, it } from 'vitest';
import { cambiarEstadoUsuario, listarUsuarios } from '@/features/admin-usuarios/api/usuarios';
import {
  decidirValidacion,
  listarFundaciones,
  obtenerFundacion,
} from '@/features/admin-fundaciones/api/fundaciones';
import {
  registrarAdoptante,
  registrarFundacion,
  verificarCorreo,
} from '@/features/autenticacion/api/autenticacion';
import { esquemaAdoptante } from '@/features/autenticacion/schemas/adoptante';
import { esquemaFundacion } from '@/features/autenticacion/schemas/fundacion';
import { obtenerEstadisticas } from '@/features/reportes/api/estadisticas';
import { listarFundacionesAprobadas } from '@/features/reportes/api/fundaciones';
import { seriesDe } from '@/features/reportes/lib/series';
import { nombreDelPdf } from '@/features/reportes/components/BotonDescargaPdf';
import { TIPOS_CON_PDF, TIPOS_REPORTE, type EstadisticasDto } from '@/features/reportes/types';
import { crearClienteHttp, type ClienteHttp } from '@/shared/api/cliente';
import { esErrorApi } from '@/shared/api/errores';
import type { RespuestaSesion } from '@/shared/api/tipos';
import { rutaDeEnlace } from '@/shared/lib/enlaces';
import { traducirError } from '@/shared/lib/errores-formulario';
import { hoyEnBogota } from '@/shared/lib/fechas';
import { crearFetchConCookies } from './cookies';
import { conLimite } from './limite';
import { esperarCorreo, tokenDeVerificacion } from './mailpit';

const API = process.env.TEST_API_URL;
const ORIGEN = process.env.TEST_WEB_ORIGIN ?? 'http://localhost:3000';
const EMAIL_ADMIN = process.env.TEST_ADMIN_EMAIL ?? 'admin@pethogar.local';
const CLAVE_ADMIN = process.env.TEST_ADMIN_PASSWORD;
const EMAIL_DEMO = process.env.TEST_DEMO_EMAIL ?? 'fundacion.demo@pethogar.local';
const CLAVE_DEMO = process.env.TEST_DEMO_PASSWORD;

const EJECUCION = Date.now().toString(36);
const CLAVE = 'ClaveSegura1';
// PNG de 1x1 píxel: firma binaria real, que es lo que valida el backend.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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

async function iniciar(c: ClienteHttp, email: string, contrasena: string) {
  const sesion = await conLimite(() =>
    c.post<RespuestaSesion>('/auth/login', { autenticada: false, cuerpo: { email, contrasena } }),
  );
  c.tokens.guardar(sesion.accessToken);
  return sesion;
}

function datosFundacion(alias: string, email: string) {
  return esquemaFundacion.parse({
    nombre: `Fundación V17 ${alias} ${EJECUCION}`,
    nit: `9${Math.floor(Math.random() * 1e8)}-1`,
    direccion: 'Carrera 5 # 6-7',
    ciudad: 'Montería',
    telefono: '3009876543',
    email,
    contrasena: CLAVE,
    documento: new File([PNG_1X1], 'camara.png', { type: 'image/png' }),
    aceptaPoliticaDatos: true,
  });
}

/** La lista del admin es paginada y acumula datos de otras ejecuciones: se recorre hasta hallar el NIT. */
async function buscarPorNit(
  admin: ClienteHttp,
  estado: 'pendiente' | 'aprobada' | 'rechazada',
  nit: string,
) {
  for (let pagina = 1; ; pagina++) {
    const r = await listarFundaciones({ pagina, estado }, admin);
    const f = r.data.find((x) => x.nit === nit);
    if (f) return f;
    if (pagina * r.limit >= r.total) return undefined;
  }
}

async function bytesDe(c: ClienteHttp, url: string) {
  const { blob, tipo } = await c.descargar(rutaDeEnlace(url));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), tipo };
}
const esPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const esPdf = (b: Uint8Array) => new TextDecoder().decode(b.slice(0, 5)) === '%PDF-';

// Presupuesto de límites: login/registro con `conLimite` (hasta 7 logins y 3 registros), estadísticas
// < 20 (60/min), PDF 3 (10/min) y descargas < 30/min. Crea sus propios datos y no toca la demo.
describe('V17: administrador y reportes contra la API real (capa de datos de las tres features)', () => {
  const admin = cliente();
  const demo = cliente();
  let idAdmin = 0;
  let idDemo = 0;

  beforeAll(async () => {
    if (!API || !CLAVE_ADMIN || !CLAVE_DEMO) {
      throw new Error(
        'Define TEST_API_URL, TEST_ADMIN_PASSWORD y TEST_DEMO_PASSWORD (API real con seed:demo). Ver verification.md (V17).',
      );
    }
    const sesionAdmin = await iniciar(admin, EMAIL_ADMIN, CLAVE_ADMIN);
    expect(sesionAdmin.usuario.rol).toBe('administrador');
    idAdmin = sesionAdmin.usuario.id;
    const sesionDemo = await iniciar(demo, EMAIL_DEMO, CLAVE_DEMO);
    expect(sesionDemo.usuario.fundacion?.estadoValidacion).toBe('aprobada');
    idDemo = sesionDemo.usuario.fundacion!.id;
  }, 300_000);

  it('F-21: una fundación registrada aparece pendiente, se descarga su documento y al aprobarla entra con su panel completo', async () => {
    const email = `v17-adm-aprobada-${EJECUCION}@pethogar.test`;
    const datos = datosFundacion('aprobada', email);
    await conLimite(() => registrarFundacion(datos, cliente()));

    const enLista = await buscarPorNit(admin, 'pendiente', datos.nit);
    expect(enLista).toMatchObject({
      nombre: datos.nombre,
      ciudad: 'Montería',
      estadoValidacion: 'pendiente',
    });
    const id = enLista!.id;

    const detalle = await obtenerFundacion(id, admin);
    expect(detalle.nit).toBe(datos.nit);
    expect(detalle.contacto.email).toBe(email);
    expect(detalle.documento.url).toBe(`/api/admin/fundaciones/${id}/documento`);
    // Nunca se expone una clave de almacenamiento.
    expect(JSON.stringify(detalle)).not.toMatch(/privado|\.png/);
    const documento = await bytesDe(admin, detalle.documento.url);
    expect(esPng(documento.bytes)).toBe(true);
    expect(documento.tipo).toBe('image/png');

    const aprobada = await decidirValidacion(id, { decision: 'aprobada' }, admin);
    expect(aprobada.estadoValidacion).toBe('aprobada');
    const otra = await fallo(() => decidirValidacion(id, { decision: 'aprobada' }, admin));
    expect(otra.estado).toBe(409);
    const rechazarAprobada = await fallo(() =>
      decidirValidacion(id, { decision: 'rechazada', observacion: 'Tarde' }, admin),
    );
    expect(rechazarAprobada.estado).toBe(409);

    expect(await buscarPorNit(admin, 'pendiente', datos.nit)).toBeUndefined();
    expect((await buscarPorNit(admin, 'aprobada', datos.nit))?.id).toBe(id);
    // El selector del administrador (aprobadas) la ofrece o, si hay más de 100, avisa de que hay más.
    const aprobadas = await listarFundacionesAprobadas(admin);
    expect(aprobadas.fundaciones.some((f) => f.id === id) || aprobadas.hayMas).toBe(true);

    // En su siguiente inicio de sesión la fundación ya está aprobada.
    const sesion = await iniciar(cliente(), email, CLAVE);
    expect(sesion.usuario.fundacion?.estadoValidacion).toBe('aprobada');
  }, 300_000);

  it('F-21: rechazar exige observación (400 junto al campo) y la fundación la ve; no se rechaza dos veces', async () => {
    const email = `v17-adm-rechazada-${EJECUCION}@pethogar.test`;
    const datos = datosFundacion('rechazada', email);
    await conLimite(() => registrarFundacion(datos, cliente()));
    const id = (await buscarPorNit(admin, 'pendiente', datos.nit))!.id;

    const sinMotivo = await fallo(() => decidirValidacion(id, { decision: 'rechazada' }, admin));
    expect(sinMotivo.estado).toBe(400);
    // El servidor lista varios mensajes del campo (el front valida antes y nunca llega aquí).
    expect(traducirError(sinMotivo, ['observacion'])).toMatchObject({
      tipo: 'campos',
      campos: [{ campo: 'observacion' }],
    });
    expect(sinMotivo.errores?.find((e) => e.campo === 'observacion')?.mensajes).toContain(
      'Indica el motivo del rechazo',
    );
    expect((await obtenerFundacion(id, admin)).estadoValidacion).toBe('pendiente');

    const rechazada = await decidirValidacion(
      id,
      { decision: 'rechazada', observacion: 'Documento ilegible' },
      admin,
    );
    expect(rechazada).toMatchObject({
      estadoValidacion: 'rechazada',
      observacionValidacion: 'Documento ilegible',
    });
    const otra = await fallo(() =>
      decidirValidacion(id, { decision: 'rechazada', observacion: 'Otra vez' }, admin),
    );
    expect(otra.estado).toBe(409);
    expect((await buscarPorNit(admin, 'rechazada', datos.nit))?.id).toBe(id);

    const sesion = await iniciar(cliente(), email, CLAVE);
    expect(sesion.usuario.fundacion).toMatchObject({
      estadoValidacion: 'rechazada',
      observacionValidacion: 'Documento ilegible',
    });
    const inexistente = await fallo(() => obtenerFundacion(99999999, admin));
    expect(inexistente.estado).toBe(404);
  }, 300_000);

  it('F-22: busca por correo, nombre y rol; desactivar cierra el acceso, activar lo devuelve y el administrador no puede desactivarse', async () => {
    const email = `v17-adm-usuario-${EJECUCION}@pethogar.test`;
    const desde = Date.now();
    const datos = esquemaAdoptante.parse({
      primerNombre: 'Veintisiete',
      primerApellido: 'Gestion',
      tipoDocumento: 'CC',
      numeroDocumento: `U${EJECUCION}${Math.floor(Math.random() * 1e6)}`.slice(0, 20),
      fechaNacimiento: '1990-05-10',
      telefono: '3001234567',
      email,
      direccion: 'Calle 1 # 2-3',
      ciudad: 'Montería',
      contrasena: CLAVE,
      aceptaPoliticaDatos: true,
    });
    await conLimite(() => registrarAdoptante(datos, cliente()));
    const token = tokenDeVerificacion(await esperarCorreo(email, /Verifica tu correo/, desde));
    await conLimite(() => verificarCorreo(token, cliente()));

    const porCorreo = await listarUsuarios({ pagina: 1, correo: email }, admin);
    expect(porCorreo.data).toHaveLength(1);
    const propio = porCorreo.data[0]!;
    expect(propio).toMatchObject({ email, rol: 'adoptante', activo: true });
    expect(propio.nombre).toContain('Veintisiete');
    expect(
      (await listarUsuarios({ pagina: 1, correo: email, nombre: 'Veintisiete' }, admin)).data,
    ).toHaveLength(1);
    expect(
      (await listarUsuarios({ pagina: 1, correo: email, rol: 'adoptante' }, admin)).data,
    ).toHaveLength(1);
    expect(
      (await listarUsuarios({ pagina: 1, correo: email, rol: 'fundacion' }, admin)).data,
    ).toHaveLength(0);
    expect(
      (await listarUsuarios({ pagina: 1, correo: email, nombre: 'Inexistente' }, admin)).data,
    ).toHaveLength(0);

    const propioCliente = cliente();
    await iniciar(propioCliente, email, CLAVE);

    const desactivado = await cambiarEstadoUsuario(propio.id, false, admin);
    expect(desactivado.activo).toBe(false);
    expect((await listarUsuarios({ pagina: 1, correo: email }, admin)).data[0]!.activo).toBe(false);
    // Desactivar corta el acceso de inmediato y no deja volver a ingresar.
    expect((await fallo(() => propioCliente.get('/auth/me'))).estado).toBeGreaterThanOrEqual(401);
    const login = await fallo(() => iniciar(cliente(), email, CLAVE));
    expect(login.estado).toBe(403);

    const activado = await cambiarEstadoUsuario(propio.id, true, admin);
    expect(activado.activo).toBe(true);
    expect((await iniciar(cliente(), email, CLAVE)).usuario.email).toBe(email);

    // Comprobación de contrato: la UI no ofrece el botón en la propia cuenta, y el servidor la rechaza.
    const alAdmin = await listarUsuarios({ pagina: 1, correo: EMAIL_ADMIN }, admin);
    expect(alAdmin.data.find((u) => u.id === idAdmin)).toMatchObject({
      rol: 'administrador',
      nombre: null,
    });
    const propia = await fallo(() => cambiarEstadoUsuario(idAdmin, false, admin));
    expect(propia.estado).toBe(400);
    expect(propia.mensaje).toContain('No puedes desactivar tu propia cuenta');
    expect((await fallo(() => cambiarEstadoUsuario(99999999, true, admin))).estado).toBe(404);
  }, 400_000);

  function comprobarCoherencia(d: EstadisticasDto) {
    const totales: Record<string, number[]> = {
      adopciones: [d.adopciones.total, d.adopciones.total],
      solicitudes: [d.solicitudes.total],
      seguimientos: [
        d.seguimientos.total,
        d.seguimientos.porBienestar.bueno +
          d.seguimientos.porBienestar.regular +
          d.seguimientos.porBienestar.malo,
      ],
      donaciones: [d.donaciones.total, d.donaciones.total],
    };
    for (const reporte of TIPOS_REPORTE) {
      const series = seriesDe(reporte, d);
      expect(
        series.map((s) => s.total),
        reporte,
      ).toEqual(totales[reporte]);
      for (const serie of series) {
        // La tabla equivalente (celdas) sale de las mismas filas y tiene la forma de sus columnas.
        for (const f of serie.filas) expect(f.celdas).toHaveLength(serie.columnas.length);
        if (serie.tipo === 'dona' && serie.total > 0) {
          expect(
            serie.filas.reduce((a, f) => a + (f.porcentaje ?? 0), 0),
            serie.id,
          ).toBe(100);
        }
      }
    }
    // Cada celda de cantidad de la tabla es el conteo del servidor.
    const solicitudes = seriesDe('solicitudes', d)[0]!;
    expect(solicitudes.filas.map((f) => f.celdas[1])).toEqual([
      String(d.solicitudes.porEstado.pendiente),
      String(d.solicitudes.porEstado.aprobada),
      String(d.solicitudes.porEstado.rechazada),
      String(d.solicitudes.porEstado.cancelada),
    ]);
  }

  const sinFiltros = (d: EstadisticasDto) => ({ ...d, filtros: undefined });

  it('F-20 y F-23: las estadísticas de la demo son coherentes con las series y el filtro por fundación del administrador es idéntico', async () => {
    const propia = await obtenerEstadisticas('fundacion', {}, demo);
    comprobarCoherencia(propia);
    // El seed demo da actividad: alguna serie con datos para ver gráficas.
    expect(TIPOS_REPORTE.flatMap((r) => seriesDe(r, propia)).some((s) => s.total > 0)).toBe(true);

    const deLaDemo = await obtenerEstadisticas('administrador', { fundacionId: idDemo }, admin);
    expect(deLaDemo.filtros.fundacionId).toBe(idDemo);
    expect(sinFiltros(deLaDemo)).toEqual(sinFiltros(propia));

    const global = await obtenerEstadisticas('administrador', {}, admin);
    comprobarCoherencia(global);
    expect(global.filtros.fundacionId).toBeNull();
    expect(global.adopciones.total).toBeGreaterThanOrEqual(propia.adopciones.total);
    expect(global.solicitudes.total).toBeGreaterThanOrEqual(propia.solicitudes.total);
    expect(global.seguimientos.total).toBeGreaterThanOrEqual(propia.seguimientos.total);
    expect(global.donaciones.total).toBeGreaterThanOrEqual(propia.donaciones.total);

    // Con rango: la fundación y el administrador filtrado por ella coinciden también.
    // Hasta una fecha lejana: los seguimientos programados caen en el futuro.
    const rango = { desde: '2000-01-01', hasta: '2099-12-31' };
    const propiaRango = await obtenerEstadisticas('fundacion', rango, demo);
    const adminRango = await obtenerEstadisticas(
      'administrador',
      { ...rango, fundacionId: idDemo },
      admin,
    );
    expect(propiaRango.filtros).toMatchObject({ desde: rango.desde, hasta: rango.hasta });
    expect(sinFiltros(adminRango)).toEqual(sinFiltros(propiaRango));
    expect(sinFiltros(propiaRango)).toEqual(sinFiltros(propia));

    // Un rango sin actividad: todas las series quedan vacías (estado vacío en la pantalla).
    const vacio = await obtenerEstadisticas(
      'fundacion',
      { desde: '2000-01-01', hasta: '2000-01-31' },
      demo,
    );
    for (const r of TIPOS_REPORTE)
      for (const s of seriesDe(r, vacio)) expect(s.total, s.id).toBe(0);

    // Un rango invertido (el front no lo envía) y una fundación inexistente se rechazan con sus códigos.
    const invertido = { desde: '2026-10-31', hasta: '2026-10-01' };
    expect((await fallo(() => obtenerEstadisticas('fundacion', invertido, demo))).estado).toBe(400);
    expect((await fallo(() => obtenerEstadisticas('administrador', invertido, admin))).estado).toBe(
      400,
    );
    expect(
      (await fallo(() => obtenerEstadisticas('administrador', { fundacionId: 999999 }, admin)))
        .estado,
    ).toBe(404);
    // El administrador no consulta la ruta de la fundación y viceversa.
    expect((await fallo(() => obtenerEstadisticas('fundacion', {}, admin))).estado).toBe(403);
    expect((await fallo(() => obtenerEstadisticas('administrador', {}, demo))).estado).toBe(403);
  }, 300_000);

  it('F-20 y F-23: los tres PDF de la fundación (con el rango) traen %PDF-; el administrador no tiene PDF (403) y no hay PDF de adopciones', async () => {
    const consulta = { reporte: 'solicitudes' as const, desde: '2000-01-01', hasta: hoyEnBogota() };
    expect(TIPOS_CON_PDF).toEqual(['solicitudes', 'seguimientos', 'donaciones']);
    for (const tipo of TIPOS_CON_PDF) {
      const { blob, tipo: contenido } = await demo.descargar(
        rutaDeEnlace(`/api/fundacion/reportes/${tipo}.pdf`),
        { consulta: { desde: consulta.desde, hasta: consulta.hasta } },
      );
      expect(contenido).toBe('application/pdf');
      expect(esPdf(new Uint8Array(await blob.arrayBuffer())), tipo).toBe(true);
    }
    expect(nombreDelPdf('solicitudes', consulta)).toBe(
      `reporte-solicitudes-2000-01-01_${consulta.hasta}`,
    );
    const delAdmin = await fallo(() =>
      admin.descargar(rutaDeEnlace('/api/fundacion/reportes/solicitudes.pdf'), {
        consulta: { desde: consulta.desde, hasta: consulta.hasta },
      }),
    );
    expect(delAdmin.estado).toBe(403);
    const adopciones = await fallo(() =>
      demo.descargar(rutaDeEnlace('/api/fundacion/reportes/adopciones.pdf')),
    );
    expect(adopciones.estado).toBe(404);
  }, 120_000);
});
