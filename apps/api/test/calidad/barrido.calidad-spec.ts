import 'reflect-metadata';
import type request from 'supertest';
import { ADMIN, arrancarEntorno, type Entorno } from '../auth/helpers';
import { CUERPO_MASCOTA } from '../mascotas/helpers';
import {
  con,
  fechaBogota,
  fundacionAprobada,
  type FundacionPrueba,
  jpeg,
  PDF,
  violacionesDeClaves,
} from '../seguimientos/helpers';

// V15 (barrido): ninguna respuesta JSON de ningún endpoint, con datos reales y para cada rol, puede
// traer contraseñas, hashes, tokens, códigos o rutas internas de almacenamiento. La lista de rutas sale
// del enrutador de Express: una ruta nueva que no esté cubierta ni excluida hace fallar la prueba.
// Requiere Postgres (DATABASE_*) y Mailpit (SMTP_HOST/SMTP_PORT y MAILPIT_UI_PORT).

/**
 * Claves de secretos. Las URLs públicas de fotos (`url`) son legítimas: lo que no puede salir son
 * valores internos de almacenamiento, que `violacionesDeClaves` detecta por su contenido.
 * `accessToken` solo es legítimo en login y refresh (ver EMITEN_ACCESS_TOKEN).
 */
const CLAVES_PROHIBIDAS =
  /^(contrasena\w*|password\w*|\w*hash|\w*_hash|\w*token\w*|\w*codigo\w*|refresh\w*|secret\w*|resetcode\w*|clave)$/i;
const EMITEN_ACCESS_TOKEN = new Set(['POST /auth/login', 'POST /auth/refresh']);

/** Rutas no GET que la prueba no puede ejercitar sin un correo real o sin repetir un flujo ya cubierto. */
const EXCLUIDAS: Record<string, string> = {};

type Rol = 'anonimo' | 'adoptante' | 'fundacion' | 'administrador';
interface Respuesta {
  origen: string;
  cuerpo: unknown;
}

describe('V15 — barrido de claves prohibidas en todas las rutas JSON', () => {
  let e: Entorno;
  const respuestas: Respuesta[] = [];
  const mutaciones = new Set<string>();
  const tokens: Record<Rol, string | null> = {
    anonimo: null,
    adoptante: null,
    fundacion: null,
    administrador: null,
  };
  const ids = {
    fundacionPendiente: 0,
    especie: 0,
    mascotaDisponible: 0,
    adopcion: 0,
    donacion: 0,
    seguimiento: 0,
    evidencia: 0,
    solicitud: 0,
  };

  const reg = (clave: string, res: request.Response): request.Response => {
    mutaciones.add(clave);
    if (/json/.test(String(res.headers['content-type']))) {
      respuestas.push({ origen: clave, cuerpo: res.body });
    }
    return res;
  };

  beforeAll(async () => {
    process.env.SEGUIMIENTOS_CRON_HABILITADO = 'false';
    e = await arrancarEntorno();
  });
  afterAll(async () => {
    await e.cerrar();
  });

  it('prepara datos reales recorriendo cada operación de escritura', async () => {
    tokens.administrador = (await e.sesion(ADMIN.email, ADMIN.clave)).access;
    const admin = tokens.administrador;

    // Registro (adoptante y fundación) y administración de fundaciones.
    const sinVerificar = e.nuevoCorreo();
    e.correosCreados.push(sinVerificar);
    reg(
      'POST /auth/register/adoptante',
      await e
        .post('/auth/register/adoptante')
        .send({
          primerNombre: 'Ana',
          primerApellido: 'Pérez',
          tipoDocumento: 'CC',
          numeroDocumento: e.nuevoDoc(),
          fechaNacimiento: '1995-04-23',
          telefono: '3001234567',
          email: sinVerificar,
          direccion: 'Calle 1 # 2-3',
          ciudad: 'Montería',
          contrasena: 'Clave1234',
          aceptaPoliticaDatos: true,
        })
        .expect(201),
    );
    reg(
      'POST /auth/verify-email/resend',
      await e.post('/auth/verify-email/resend').send({ email: sinVerificar }).expect(200),
    );
    const emailPendiente = e.nuevoCorreo();
    reg(
      'POST /auth/register/fundacion',
      await e.registrarFundacion(emailPendiente, `97${e.sufijo}`.slice(0, 15)).expect(201),
    );
    const [{ id: pendiente }]: { id: number }[] = await e.ds.query(
      'SELECT f.id FROM fundacion f JOIN usuario u ON u.id = f.usuario_id WHERE u.email = $1',
      [emailPendiente],
    );
    ids.fundacionPendiente = pendiente;
    reg(
      'PATCH /admin/fundaciones/:id/validacion',
      await con(e.patch(`/admin/fundaciones/${pendiente}/validacion`), admin)
        .send({ decision: 'aprobada' })
        .expect(200),
    );

    // Sesión del adoptante: login, refresh y logout.
    const emailAdoptante = await e.adoptanteVerificado();
    const acceso = reg('POST /auth/login', await e.login(emailAdoptante).expect(200));
    const cookie = String(
      (acceso.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith('refresh_token='),
      ),
    ).split(';')[0];
    const renovada = reg(
      'POST /auth/refresh',
      await e.post('/auth/refresh').set('Cookie', cookie).expect(200),
    );
    const cookie2 = String(
      (renovada.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith('refresh_token='),
      ),
    ).split(';')[0];
    reg('POST /auth/logout', await e.post('/auth/logout').set('Cookie', cookie2).expect(204));
    const sesion = await e.sesion(emailAdoptante);
    tokens.adoptante = sesion.access;
    const adoptante = tokens.adoptante;

    // Recuperación de contraseña.
    reg(
      'POST /auth/forgot-password',
      await e.post('/auth/forgot-password').send({ email: emailAdoptante }).expect(200),
    );
    reg(
      'POST /auth/reset-password',
      await e
        .post('/auth/reset-password')
        .send({ email: emailAdoptante, codigo: '000000', nuevaContrasena: 'OtraClave123' })
        .expect(400),
    );

    // Fundación aprobada: mascotas, fotos, historial.
    const F: FundacionPrueba = await fundacionAprobada(e, 'Montería', 'sql');
    tokens.fundacion = F.access;
    const especies = (await e.get('/especies').expect(200)).body as {
      id: number;
      nombre: string;
    }[];
    ids.especie = especies[0].id;
    const razaId = (
      (await e.get(`/especies/${ids.especie}/razas`).expect(200)).body as { id: number }[]
    )[0].id;
    const crear = async (nombre: string): Promise<number> =>
      (
        reg(
          'POST /mascotas',
          await con(e.post('/mascotas'), F.access)
            .send({ ...CUERPO_MASCOTA, razaId, nombre })
            .expect(201),
        ).body as { id: number }
      ).id;
    const m1 = await crear('Adoptable');
    const m2 = await crear('Disponible');
    const m3 = await crear('DeBaja');
    ids.mascotaDisponible = m2;
    reg(
      'PATCH /mascotas/:id',
      await con(e.patch(`/mascotas/${m2}`), F.access)
        .send({ descripcion: 'Muy cariñosa' })
        .expect(200),
    );
    const foto = async (m: number) =>
      reg(
        'POST /mascotas/:id/fotos',
        await con(e.post(`/mascotas/${m}/fotos`), F.access)
          .attach('foto', await jpeg(30, 30), { filename: 'f.jpg', contentType: 'image/jpeg' })
          .expect(201),
      );
    await foto(m1);
    const f2a = (await foto(m2)).body as { id: number };
    const f2b = (await foto(m2)).body as { id: number };
    reg(
      'PATCH /mascotas/:id/fotos/:fotoId/principal',
      await con(e.patch(`/mascotas/${m2}/fotos/${f2b.id}/principal`), F.access).expect(200),
    );
    reg(
      'DELETE /mascotas/:id/fotos/:fotoId',
      await con(e.del(`/mascotas/${m2}/fotos/${f2a.id}`), F.access),
    );
    reg(
      'POST /mascotas/:id/historial',
      await con(e.post(`/mascotas/${m2}/historial`), F.access)
        .send({
          tipo: 'vacuna',
          fecha: fechaBogota(-1),
          descripcion: 'Rabia',
          veterinario: 'Dra. Ruiz',
        })
        .expect(201),
    );
    reg(
      'PATCH /mascotas/:id/baja',
      await con(e.patch(`/mascotas/${m3}/baja`), F.access).expect(200),
    );

    // Solicitudes: enviar, cancelar y aprobar.
    const enviar = async (mascotaId: number) =>
      reg(
        'POST /solicitudes',
        await con(e.post('/solicitudes'), adoptante)
          .field('mascotaId', String(mascotaId))
          .field('motivo', 'Quiero darle un hogar')
          .field('tipoVivienda', 'casa')
          .field('tieneOtrasMascotas', 'false')
          .attach('formulario', PDF, { filename: 'f.pdf', contentType: 'application/pdf' })
          .expect(201),
      );
    const sCancelar = (await enviar(m2)).body as { id: number };
    reg(
      'PATCH /solicitudes/:id/cancelar',
      await con(e.patch(`/solicitudes/${sCancelar.id}/cancelar`), adoptante).expect(200),
    );
    ids.solicitud = (await enviar(m1)).body.id as number;
    reg(
      'PATCH /solicitudes/:id/decision',
      await con(e.patch(`/solicitudes/${ids.solicitud}/decision`), F.access)
        .send({ decision: 'aprobar', fechaEntrega: fechaBogota(0) })
        .expect(200),
    );
    [{ id: ids.adopcion }] = await e.ds.query('SELECT id FROM adopcion WHERE solicitud_id = $1', [
      ids.solicitud,
    ]);
    reg(
      'POST /fundacion/adopciones/:id/acta',
      await con(e.post(`/fundacion/adopciones/${ids.adopcion}/acta`), F.access)
        .attach('acta', PDF, { filename: 'a.pdf', contentType: 'application/pdf' })
        .expect(201),
    );

    // Seguimiento: programar, reportar con foto y cerrar con evidencia.
    ids.seguimiento = reg(
      'POST /adopciones/:id/seguimientos',
      await con(e.post(`/adopciones/${ids.adopcion}/seguimientos`), F.access)
        .send({ tipo: 'reporte', fechaProgramada: fechaBogota(1) })
        .expect(201),
    ).body.id as number;
    reg(
      'POST /seguimientos/:id/reporte',
      await con(e.post(`/seguimientos/${ids.seguimiento}/reporte`), adoptante)
        .field('comentarios', 'Todo bien')
        .attach('fotos', await jpeg(), { filename: 'r.jpg', contentType: 'image/jpeg' })
        .expect(201),
    );
    reg(
      'PATCH /seguimientos/:id/resultado',
      await con(e.patch(`/seguimientos/${ids.seguimiento}/resultado`), F.access)
        .field('fechaRealizada', fechaBogota(0))
        .field('estadoBienestar', 'bueno')
        .field('observaciones', 'Excelente')
        .attach('evidencias', await jpeg(), { filename: 'e.jpg', contentType: 'image/jpeg' })
        .expect(200),
    );
    [{ id: ids.evidencia }] = await e.ds.query(
      'SELECT id FROM seguimiento_evidencia WHERE seguimiento_id = $1 LIMIT 1',
      [ids.seguimiento],
    );

    // Donaciones con comprobante.
    reg(
      'POST /donaciones',
      await con(e.post('/donaciones'), adoptante)
        .field('fundacionId', String(F.id))
        .field('tipo', 'economica')
        .field('monto', '25000.00')
        .attach('comprobante', PDF, { filename: 'c.pdf', contentType: 'application/pdf' })
        .expect(201),
    );
    reg(
      'POST /fundacion/donaciones',
      await con(e.post('/fundacion/donaciones'), F.access)
        .field('nombreDonante', 'Pedro Paz')
        .field('tipo', 'especie')
        .field('descripcion', 'Dos bultos de croquetas')
        .attach('comprobante', PDF, { filename: 'c.pdf', contentType: 'application/pdf' })
        .expect(201),
    );
    [{ id: ids.donacion }] = await e.ds.query(
      'SELECT id FROM donacion WHERE comprobante_url IS NOT NULL LIMIT 1',
    );

    // Notificaciones (las generaron los eventos anteriores).
    await new Promise((r) => setTimeout(r, 1500));
    const lista = await con(e.get('/notificaciones'), adoptante).expect(200);
    expect(lista.body.data.length).toBeGreaterThan(0);
    reg(
      'PATCH /notificaciones/:id/leida',
      await con(e.patch(`/notificaciones/${lista.body.data[0].id}/leida`), adoptante).expect(200),
    );
    reg(
      'PATCH /notificaciones/leer-todas',
      await con(e.patch('/notificaciones/leer-todas'), adoptante),
    );

    // Administración de usuarios.
    const [{ id: usuarioId }]: { id: number }[] = await e.ds.query(
      'SELECT id FROM usuario WHERE email = $1',
      [sinVerificar],
    );
    reg(
      'PATCH /admin/usuarios/:id/estado',
      await con(e.patch(`/admin/usuarios/${usuarioId}/estado`), admin)
        .send({ activo: false })
        .expect(200),
    );
    await con(e.patch(`/admin/usuarios/${usuarioId}/estado`), admin)
      .send({ activo: true })
      .expect(200);

    // Cierre de la adopción (al final: ya no admite seguimientos).
    reg(
      'PATCH /adopciones/:id/estado',
      await con(e.patch(`/adopciones/${ids.adopcion}/estado`), F.access)
        .send({ estado: 'finalizada', motivo: 'Adopción consolidada' })
        .expect(200),
    );
  });

  const PARAMETROS = (plantilla: string): string => {
    const sustituciones: Record<string, string> = {
      ':evidenciaId': String(ids.evidencia),
    };
    const porRuta: Record<string, number> = {
      '/admin/fundaciones/:id': ids.fundacionPendiente,
      '/admin/fundaciones/:id/documento': ids.fundacionPendiente,
      '/especies/:id/razas': ids.especie,
      '/fundacion/adopciones/:id/acta': ids.adopcion,
      '/mis-adopciones/:id/acta': ids.adopcion,
      '/fundacion/donaciones/:id/comprobante': ids.donacion,
      '/fundacion/mascotas/:id': ids.mascotaDisponible,
      '/mascotas/:id': ids.mascotaDisponible,
      '/mascotas/:id/historial': ids.mascotaDisponible,
      '/mascotas/:id/ficha.pdf': ids.mascotaDisponible,
      '/fundacion/seguimientos/:id': ids.seguimiento,
      '/mis-seguimientos/:id': ids.seguimiento,
      '/fundacion/seguimientos/:id/evidencias/:evidenciaId': ids.seguimiento,
      '/mis-seguimientos/:id/evidencias/:evidenciaId': ids.seguimiento,
      '/fundacion/solicitudes/:id': ids.solicitud,
      '/fundacion/solicitudes/:id/formulario': ids.solicitud,
      '/mis-solicitudes/:id': ids.solicitud,
      '/mis-solicitudes/:id/formulario': ids.solicitud,
    };
    if (!plantilla.includes(':')) return plantilla;
    if (!(plantilla in porRuta)) {
      throw new Error(
        `La ruta ${plantilla} tiene parámetros y no está en el barrido: añádela a PARAMETROS`,
      );
    }
    let ruta = plantilla.replace(':id', String(porRuta[plantilla]));
    for (const [marca, valor] of Object.entries(sustituciones)) ruta = ruta.replace(marca, valor);
    return ruta;
  };

  const rutasRegistradas = (): { metodo: string; plantilla: string }[] => {
    const router = (
      e.app.getHttpAdapter().getInstance() as unknown as {
        router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] };
      }
    ).router;
    return router.stack.flatMap((capa) =>
      capa.route
        ? Object.keys(capa.route.methods).map((metodo) => ({
            metodo: metodo.toUpperCase(),
            plantilla: capa.route!.path.replace(/^\/api/, ''),
          }))
        : [],
    );
  };

  it('cada ruta GET responde a los cuatro roles y ninguna respuesta JSON filtra secretos', async () => {
    const gets = rutasRegistradas().filter((r) => r.metodo === 'GET');
    expect(gets.length).toBeGreaterThanOrEqual(40);
    let inspeccionadas = 0;
    const exitosas = new Set<string>();
    for (const { plantilla } of gets) {
      const ruta = PARAMETROS(plantilla);
      for (const rol of Object.keys(tokens) as Rol[]) {
        const token = tokens[rol];
        const peticion = e.get(ruta);
        const res = await (token ? con(peticion, token) : peticion).buffer(true).parse((r, fin) => {
          const trozos: Buffer[] = [];
          r.on('data', (t: Buffer) => trozos.push(t));
          r.on('end', () => fin(null, Buffer.concat(trozos)));
        });
        if (res.status === 200) exitosas.add(plantilla);
        if (!/json/.test(String(res.headers['content-type']))) continue;
        respuestas.push({
          origen: `GET ${plantilla} (${rol}, ${res.status})`,
          cuerpo: JSON.parse((res.body as Buffer).toString('utf8')),
        });
        inspeccionadas++;
      }
    }
    expect(inspeccionadas).toBeGreaterThan(120);
    // Las rutas con datos poblados devuelven contenido real (no solo errores) para algún rol.
    for (const clave of [
      '/mascotas',
      '/mascotas/:id',
      '/fundacion/solicitudes/:id',
      '/mis-solicitudes/:id',
      '/fundacion/seguimientos/:id',
      '/mis-seguimientos/:id',
      '/fundacion/donaciones',
      '/fundacion/estadisticas',
      '/admin/estadisticas',
      '/admin/fundaciones/:id',
      '/notificaciones',
      '/auth/me',
    ]) {
      expect(exitosas.has(clave)).toBe(true);
    }
  });

  it('todas las rutas de escritura se ejercitaron con datos reales o están excluidas con motivo', () => {
    const escritura = rutasRegistradas()
      .filter((r) => r.metodo !== 'GET')
      .map((r) => `${r.metodo} ${r.plantilla}`);
    const sinCubrir = escritura.filter((r) => !mutaciones.has(r) && !(r in EXCLUIDAS));
    expect(sinCubrir).toEqual([]);
    const sobrantes = [...mutaciones].filter((r) => !escritura.includes(r));
    expect(sobrantes).toEqual([]);
  });

  it('ninguna respuesta contiene contraseñas, hashes, tokens, códigos, claves ni rutas internas', () => {
    expect(respuestas.length).toBeGreaterThan(150);
    const violaciones = respuestas.flatMap(({ origen, cuerpo }) => {
      const permitido = [...EMITEN_ACCESS_TOKEN].some((r) => origen.startsWith(r));
      return violacionesDeClaves(cuerpo, origen, CLAVES_PROHIBIDAS).filter(
        (v) => !(permitido && v.endsWith('.accessToken')),
      );
    });
    expect(violaciones).toEqual([]);
  });

  it('el sondeo no es vacuo: una clave prohibida inyectada SÍ se detecta', () => {
    expect(
      violacionesDeClaves(
        { a: { tokenVerificacionHash: 'x', ok: 1 }, b: ['privado/solicitudes/a.pdf'] },
        '$',
        CLAVES_PROHIBIDAS,
      ),
    ).toEqual(['$.a.tokenVerificacionHash', '$.b[0]=privado/solicitudes/a.pdf']);
    expect(violacionesDeClaves({ codigoRecuperacion: '123456' }, '$', CLAVES_PROHIBIDAS)).toEqual([
      '$.codigoRecuperacion',
    ]);
  });
});
