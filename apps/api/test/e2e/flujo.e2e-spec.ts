import 'reflect-metadata';
import { ADMIN, arrancarEntorno, type Entorno } from '../auth/helpers';
import { esperarMensajes, extraerToken } from '../auth/mailpit';
import {
  con,
  ENVIAR_FORMULARIO,
  fechaBogota,
  jpeg,
  PDF,
  violacionesDeClaves,
} from '../seguimientos/helpers';
import { CUERPO_MASCOTA } from '../mascotas/helpers';
import { descargarPdf, esPdfValido } from './helpers';

// V5: flujo completo de la API de punta a punta sobre la AppModule real (Postgres, Mailpit y disco).
// Requiere Postgres (DATABASE_*) y Mailpit (SMTP_HOST/SMTP_PORT y MAILPIT_UI_PORT).
// Los pasos están encadenados: cada uno depende del anterior.
describe('V5 — e2e: fundación → mascota → adopción → seguimiento → reportes', () => {
  let e: Entorno;
  let adminAccess: string;
  let fundacionEmail: string;
  let fundacionAccess: string;
  let fundacionId: number;
  let razaId: number;
  let mascotaId: number;
  let adoptanteEmail: string;
  let adoptanteAccess: string;
  let solicitudId: number;
  let adopcionId: number;
  let seguimientoId: number;
  const hoy = fechaBogota(0);

  beforeAll(async () => {
    process.env.SEGUIMIENTOS_CRON_HABILITADO = 'false';
    e = await arrancarEntorno();
  });
  afterAll(async () => {
    await e.cerrar();
  });

  /** Registro → correo real en Mailpit → enlace de verificación. */
  const verificarPorCorreo = async (email: string): Promise<void> => {
    const [mensaje] = await esperarMensajes(email, 1);
    expect(mensaje).toBeDefined();
    const token = extraerToken(mensaje.texto);
    await e.get(`/auth/verify-email?token=${encodeURIComponent(token)}`).expect(200);
  };

  it('1. una fundación se registra, recibe el aviso por correo y no opera hasta ser aprobada', async () => {
    fundacionEmail = e.nuevoCorreo();
    await e
      .registrarFundacion(fundacionEmail, `98${e.sufijo}`.slice(0, 15), 'Refugio E2E')
      .expect(201);
    const [aviso] = await esperarMensajes(fundacionEmail, 1);
    expect(aviso).toBeDefined();
    fundacionAccess = (await e.sesion(fundacionEmail)).access;
    [{ id: fundacionId }] = await e.ds.query(
      'SELECT f.id FROM fundacion f JOIN usuario u ON u.id = f.usuario_id WHERE u.email = $1',
      [fundacionEmail],
    );
    await con(e.get('/fundacion/estadisticas'), fundacionAccess).expect(403);
    await con(e.post('/mascotas'), fundacionAccess).send(CUERPO_MASCOTA).expect(403);
  });

  it('2. el administrador la aprueba y la fundación ya puede operar', async () => {
    adminAccess = (await e.sesion(ADMIN.email, ADMIN.clave)).access;
    await con(e.patch(`/admin/fundaciones/${fundacionId}/validacion`), adminAccess)
      .send({ decision: 'aprobada' })
      .expect(200);
    const vacio = await con(e.get('/fundacion/estadisticas'), fundacionAccess).expect(200);
    expect(vacio.body.solicitudes).toEqual({
      total: 0,
      porEstado: { pendiente: 0, aprobada: 0, rechazada: 0, cancelada: 0 },
    });
  });

  it('3. la fundación publica una mascota con foto y aparece en el catálogo y en su ficha PDF', async () => {
    const especies = (await e.get('/especies').expect(200)).body as {
      id: number;
      nombre: string;
    }[];
    const perro = especies.find((x) => x.nombre === 'perro')!.id;
    const razas = (await e.get(`/especies/${perro}/razas`).expect(200)).body as {
      id: number;
      nombre: string;
    }[];
    razaId = razas.find((r) => r.nombre === 'Mestizo')!.id;
    const creada = await con(e.post('/mascotas'), fundacionAccess)
      .send({ ...CUERPO_MASCOTA, razaId, nombre: 'Peñita' })
      .expect(201);
    mascotaId = creada.body.id as number;
    await con(e.post(`/mascotas/${mascotaId}/fotos`), fundacionAccess)
      .attach('foto', await jpeg(40, 30), { filename: 'f.jpg', contentType: 'image/jpeg' })
      .expect(201);

    const catalogo = await e.get('/mascotas').expect(200);
    expect(catalogo.body.data.map((m: { id: number }) => m.id)).toContain(mascotaId);

    const ficha = await descargarPdf(e.get(`/mascotas/${mascotaId}/ficha.pdf`));
    expect(ficha.tipo).toBe('application/pdf');
    expect(ficha.disposicion).toContain('attachment');
    expect(esPdfValido(ficha.cuerpo)).toBe(true);
    expect(ficha.ms).toBeLessThan(5000);
  });

  it('4. un adoptante se registra, verifica su correo y envía una solicitud', async () => {
    const { email } = await e.registrarAdoptante();
    adoptanteEmail = email;
    await verificarPorCorreo(adoptanteEmail);
    adoptanteAccess = (await e.sesion(adoptanteEmail)).access;
    const [{ id: adoptanteId }]: { id: number }[] = await e.ds.query(
      'SELECT a.id FROM adoptante a JOIN usuario u ON u.id = a.usuario_id WHERE u.email = $1',
      [adoptanteEmail],
    );
    const res = await ENVIAR_FORMULARIO(
      e,
      { email: adoptanteEmail, access: adoptanteAccess, id: adoptanteId },
      mascotaId,
      PDF,
    ).expect(201);
    solicitudId = res.body.id as number;
    expect(res.body.estado).toBe('pendiente');
  });

  it('5. la fundación aprueba: nace la adopción y la mascota sale del catálogo', async () => {
    const res = await con(e.patch(`/solicitudes/${solicitudId}/decision`), fundacionAccess)
      .send({ decision: 'aprobar', fechaEntrega: hoy })
      .expect(200);
    expect(res.body.estado).toBe('aprobada');
    adopcionId = res.body.adopcion.id as number;
    const catalogo = await e.get('/mascotas').expect(200);
    expect(catalogo.body.data.map((m: { id: number }) => m.id)).not.toContain(mascotaId);
    await e.get(`/mascotas/${mascotaId}/ficha.pdf`).expect(404);
  });

  it('6. seguimiento: la fundación lo programa, el adoptante reporta y la fundación lo cierra', async () => {
    const programado = await con(e.post(`/adopciones/${adopcionId}/seguimientos`), fundacionAccess)
      .send({ tipo: 'reporte', fechaProgramada: fechaBogota(1) })
      .expect(201);
    seguimientoId = programado.body.id as number;
    await con(e.post(`/seguimientos/${seguimientoId}/reporte`), adoptanteAccess)
      .field('comentarios', 'Come y juega mucho')
      .expect(201);
    const cerrado = await con(e.patch(`/seguimientos/${seguimientoId}/resultado`), fundacionAccess)
      .field('fechaRealizada', hoy)
      .field('estadoBienestar', 'bueno')
      .field('observaciones', 'Todo en orden')
      .expect(200);
    expect(cerrado.body.estado).toBe('realizado');
  });

  it('7. el adoptante registra una donación económica a la fundación', async () => {
    await con(e.post('/donaciones'), adoptanteAccess)
      .field('fundacionId', String(fundacionId))
      .field('tipo', 'economica')
      .field('monto', '50000.50')
      .expect(201);
  });

  it('8. las estadísticas de la fundación reflejan todo el recorrido', async () => {
    const res = await con(e.get('/fundacion/estadisticas'), fundacionAccess).expect(200);
    const mes = hoy.slice(0, 7);
    expect(res.body.filtros).toEqual({ fundacionId, desde: null, hasta: null });
    expect(res.body.adopciones).toEqual({
      total: 1,
      porMes: [{ mes, cantidad: 1 }],
      porEspecie: [{ especie: 'perro', cantidad: 1 }],
    });
    expect(res.body.solicitudes.porEstado).toEqual({
      pendiente: 0,
      aprobada: 1,
      rechazada: 0,
      cancelada: 0,
    });
    expect(res.body.seguimientos).toEqual({
      total: 1,
      porEstado: { programado: 0, realizado: 1, vencido: 0, cancelado: 0 },
      porBienestar: { bueno: 1, regular: 0, malo: 0 },
    });
    expect(res.body.donaciones).toEqual({
      total: 1,
      porMes: [{ mes, cantidad: 1, monto: '50000.50' }],
      porTipo: { economica: { cantidad: 1, monto: '50000.50' }, especie: { cantidad: 0 } },
    });
    expect(violacionesDeClaves(res.body)).toEqual([]);
  });

  it('9. el administrador ve lo mismo en global y filtrando por fundación; un rango sin datos da ceros', async () => {
    const global = await con(e.get('/admin/estadisticas'), adminAccess).expect(200);
    expect(global.body.solicitudes.total).toBe(1);
    const filtrada = await con(
      e.get(`/admin/estadisticas?fundacionId=${fundacionId}`),
      adminAccess,
    ).expect(200);
    expect(filtrada.body.adopciones.total).toBe(1);
    const vacio = await con(
      e.get(`/admin/estadisticas?fundacionId=${fundacionId}&desde=2000-01-01&hasta=2000-12-31`),
      adminAccess,
    ).expect(200);
    expect(vacio.body.solicitudes.total).toBe(0);
    expect(vacio.body.donaciones.porTipo.economica.monto).toBe('0.00');
    await con(e.get('/admin/estadisticas?fundacionId=99999'), adminAccess).expect(404);
    await con(e.get('/fundacion/estadisticas'), adminAccess).expect(403);
  });

  it.each(['solicitudes', 'seguimientos', 'donaciones'])(
    '10. el reporte PDF de %s se genera en menos de 5 s',
    async (reporte) => {
      const pdf = await descargarPdf(
        con(e.get(`/fundacion/reportes/${reporte}.pdf`), fundacionAccess),
      );
      expect(pdf.tipo).toBe('application/pdf');
      expect(pdf.disposicion).toBe(`attachment; filename="reporte-${reporte}.pdf"`);
      expect(esPdfValido(pdf.cuerpo)).toBe(true);
      expect(pdf.ms).toBeLessThan(5000);
    },
  );

  it('11. los reportes son solo de la fundación y el adoptante no accede', async () => {
    await con(e.get('/fundacion/reportes/solicitudes.pdf'), adoptanteAccess).expect(403);
    await con(e.get('/fundacion/reportes/donaciones.pdf'), adminAccess).expect(403);
    await e.get('/fundacion/reportes/solicitudes.pdf').expect(401);
    await con(
      e.get('/fundacion/reportes/solicitudes.pdf?desde=2026-10-05&hasta=2026-10-01'),
      fundacionAccess,
    ).expect(400);
  });
});
