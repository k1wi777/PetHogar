import 'reflect-metadata';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { ADMIN, arrancarEntorno, bearer, type Entorno } from '../auth/helpers';
import {
  archivosDeMascotas,
  con,
  CUERPO_MASCOTA,
  fundacionAprobada,
  type FundacionPrueba,
  jpeg,
  PDF,
  png,
  violaciones,
} from './helpers';

// V11: mascotas, fotos, historial y catálogo sobre la AppModule real (Postgres, Mailpit y disco).
// Requiere Postgres (DATABASE_*) y Mailpit (SMTP_HOST/SMTP_PORT y MAILPIT_UI_PORT).
const MENSAJE_NO_EXISTE = 'La mascota no existe';

describe('V11 — mascotas y catálogo público (Postgres, Mailpit y disco)', () => {
  let e: Entorno;
  let C: FundacionPrueba; // fundación del flujo principal (aprobada por la API de administración)
  let A: FundacionPrueba; // Bogotá
  let B: FundacionPrueba; // Medellín
  let pendiente: { id: number; access: string };
  let adoptante: string;
  let perro: number;
  let gato: number;
  let razaPerro: number;
  let razaGato: number;
  /** Todas las respuestas reales, para el barrido final de claves prohibidas. */
  const respuestas: { ruta: string; cuerpo: unknown }[] = [];

  const registrar = (res: request.Response, ruta: string): request.Response => {
    respuestas.push({ ruta, cuerpo: res.body });
    return res;
  };
  const crear = async (f: FundacionPrueba, extra: object = {}): Promise<number> => {
    const res = await con(e.post('/mascotas'), f.access)
      .send({ ...CUERPO_MASCOTA, razaId: razaPerro, ...extra })
      .expect(201);
    registrar(res, 'POST /mascotas');
    return res.body.id as number;
  };
  const subir = (f: FundacionPrueba, mascotaId: number, buffer: Buffer, nombre = 'foto.jpg') =>
    con(e.post(`/mascotas/${mascotaId}/fotos`), f.access).attach('foto', buffer, {
      filename: nombre,
      contentType: nombre.endsWith('.png') ? 'image/png' : 'image/jpeg',
    });
  const filasFoto = (mascotaId: number) =>
    e.ds.query(
      'SELECT id, url, url_catalogo, es_principal FROM foto_mascota WHERE mascota_id = $1 ORDER BY id',
      [mascotaId],
    ) as Promise<{ id: number; url: string; url_catalogo: string; es_principal: boolean }[]>;
  const enDisco = (clave: string): boolean => existsSync(path.join(e.uploads, clave));
  const catalogo = async (consulta = '') => {
    const res = await e.get(`/mascotas${consulta}`).expect(200);
    registrar(res, `GET /mascotas${consulta}`);
    return res.body as {
      data: { id: number; nombre: string }[];
      total: number;
      page: number;
      limit: number;
    };
  };

  beforeAll(async () => {
    e = await arrancarEntorno();
    const admin = (await e.sesion(ADMIN.email, ADMIN.clave)).access;
    C = await fundacionAprobada(e, 'Cali', 'api', admin);
    A = await fundacionAprobada(e, 'Bogotá');
    B = await fundacionAprobada(e, 'Medellín');
    const emailP = e.nuevoCorreo();
    await e.registrarFundacion(emailP, `96${e.sufijo}`.slice(0, 20)).expect(201);
    await e.ds.query('UPDATE usuario SET email_verificado = true WHERE email = $1', [emailP]);
    pendiente = { id: 0, access: (await e.sesion(emailP)).access };
    adoptante = (await e.sesion(await e.adoptanteVerificado())).access;
  });
  afterAll(() => e?.cerrar());

  // ───────────────────────────── B-18 ─────────────────────────────
  describe('especies y razas (públicas)', () => {
    it('lista especies y razas con los datos del seed, sin autenticación', async () => {
      const especies = registrar(await e.get('/especies').expect(200), 'GET /especies').body as {
        id: number;
        nombre: string;
      }[];
      expect(especies.map((x) => x.nombre).sort()).toEqual(['gato', 'perro']);
      perro = especies.find((x) => x.nombre === 'perro')!.id;
      gato = especies.find((x) => x.nombre === 'gato')!.id;
      const razasPerro = (await e.get(`/especies/${perro}/razas`).expect(200)).body as {
        id: number;
        nombre: string;
      }[];
      expect(razasPerro.map((r) => r.nombre)).toContain('Labrador');
      expect(razasPerro).toHaveLength(9);
      razaPerro = razasPerro.find((r) => r.nombre === 'Mestizo')!.id;
      const razasGato = (await e.get(`/especies/${gato}/razas`).expect(200)).body as {
        id: number;
        nombre: string;
      }[];
      razaGato = razasGato.find((r) => r.nombre === 'Siamés')!.id;
      expect(Object.keys(razasPerro[0]).sort()).toEqual(['id', 'nombre']);
    });

    it('404 en español si la especie no existe y 400 con un id inválido', async () => {
      const res = await e.get('/especies/9999/razas').expect(404);
      expect(res.body.message).toBe('La especie no existe');
      await e.get('/especies/abc/razas').expect(400);
      await e.get('/especies/99999999999/razas').expect(400);
    });
  });

  // ───────────────────────────── B-19 y B-20 ─────────────────────────────
  describe('publicar mascotas y fotos (fundación C)', () => {
    let mascota: number;
    const fotos: number[] = [];

    it('publica una mascota: queda disponible y asociada a la fundación del token', async () => {
      const res = await con(e.post('/mascotas'), C.access)
        .send({ ...CUERPO_MASCOTA, razaId: razaPerro, estado: 'adoptada', fundacionId: A.id })
        .expect(201);
      registrar(res, 'POST /mascotas');
      mascota = res.body.id;
      expect(res.body).toMatchObject({ estado: 'disponible', nombre: 'Luna', razaId: razaPerro });
      const [fila] = await e.ds.query('SELECT fundacion_id, estado FROM mascota WHERE id = $1', [
        mascota,
      ]);
      expect(fila).toEqual({ fundacion_id: C.id, estado: 'disponible' });
    });

    it('rechaza datos inválidos con mensajes por campo en español, sin crear nada', async () => {
      const antes = await e.ds.query('SELECT count(*)::int AS n FROM mascota');
      const res = await con(e.post('/mascotas'), C.access)
        .send({
          nombre: '',
          razaId: 999999,
          sexo: 'otro',
          edadMeses: -1,
          tamano: 'enorme',
          estadoSalud: 'x'.repeat(201),
        })
        .expect(400);
      const campos = (res.body.errores as { campo: string; mensajes: string[] }[]).map(
        (x) => x.campo,
      );
      expect(campos).toEqual(expect.arrayContaining(['nombre', 'sexo', 'edadMeses', 'tamano']));
      const raza = await con(e.post('/mascotas'), C.access)
        .send({ ...CUERPO_MASCOTA, razaId: 999999 })
        .expect(400);
      expect(raza.body.errores).toEqual([{ campo: 'razaId', mensajes: ['La raza no existe'] }]);
      expect(await e.ds.query('SELECT count(*)::int AS n FROM mascota')).toEqual(antes);
    });

    it('sube 6 fotos JPG y PNG: dos archivos reales por foto, servidos por HTTP, una sola principal', async () => {
      for (let i = 0; i < 6; i++) {
        const res =
          i % 2 === 0
            ? await subir(C, mascota, await jpeg(2000, 1000), `f${i}.jpg`).expect(201)
            : await subir(C, mascota, await png(1700, 900), `f${i}.png`).expect(201);
        registrar(res, 'POST /mascotas/:id/fotos');
        fotos.push(res.body.id);
        expect(res.body.esPrincipal).toBe(i === 0);
        expect(Object.keys(res.body).sort()).toEqual(['esPrincipal', 'id', 'url', 'urlCatalogo']);
      }
      const filas = await filasFoto(mascota);
      expect(filas).toHaveLength(6);
      expect(filas.filter((f) => f.es_principal)).toHaveLength(1);
      for (const fila of filas) {
        expect(fila.url).toMatch(/^publico\/mascotas\/[0-9a-f-]{36}\.jpg$/);
        expect(fila.url_catalogo).toMatch(/^publico\/mascotas\/[0-9a-f-]{36}\.jpg$/);
        expect(enDisco(fila.url) && enDisco(fila.url_catalogo)).toBe(true);
      }
      // Tamaños reales: catálogo ≤ 640 px y grande ≤ 1600 px (JPEG aunque entrara PNG).
      const meta = async (clave: string) => sharp(path.join(e.uploads, clave)).metadata();
      expect(await meta(filas[0].url_catalogo)).toMatchObject({ format: 'jpeg', width: 640 });
      expect(await meta(filas[0].url)).toMatchObject({ format: 'jpeg', width: 1600 });
      expect(await meta(filas[1].url)).toMatchObject({ format: 'jpeg', width: 1600 });
      // Servidos por HTTP bajo /uploads con cabeceras seguras.
      const detalle = await con(e.get(`/fundacion/mascotas/${mascota}`), C.access).expect(200);
      registrar(detalle, 'GET /fundacion/mascotas/:id');
      expect(detalle.body.fotos).toHaveLength(6);
      expect(detalle.body.fotos[0].esPrincipal).toBe(true);
      for (const foto of detalle.body.fotos as { url: string; urlCatalogo: string }[]) {
        for (const url of [foto.url, foto.urlCatalogo]) {
          const servida = await request(e.app.getHttpServer())
            .get(new URL(url).pathname)
            .expect(200);
          expect(servida.headers['content-type']).toContain('image/jpeg');
          expect(servida.headers['x-content-type-options']).toBe('nosniff');
        }
      }
    });

    it('rechaza la séptima foto con 409 sin dejar archivos ni filas', async () => {
      const archivosAntes = archivosDeMascotas(e.uploads);
      const res = await subir(C, mascota, await jpeg()).expect(409);
      expect(res.body.message).toBe('Solo puedes subir hasta 6 fotos por mascota');
      expect(await filasFoto(mascota)).toHaveLength(6);
      expect(archivosDeMascotas(e.uploads)).toEqual(archivosAntes);
    });

    it('rechaza archivos inválidos (400/413) sin dejar rastro', async () => {
      const otra = await crear(C);
      const antes = archivosDeMascotas(e.uploads);
      const pdf = await subir(C, otra, PDF, 'fraude.jpg').expect(400);
      expect(pdf.body.message).toBe('Solo se permiten imágenes JPG o PNG');
      const corrupto = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 9)]);
      const dañado = await subir(C, otra, corrupto).expect(400);
      expect(dañado.body.message).toBe('La imagen está dañada o no se puede procesar');
      const grande = await subir(
        C,
        otra,
        Buffer.concat([await jpeg(), Buffer.alloc(5 * 1024 * 1024)]),
      ).expect(413);
      expect(grande.body.message).toContain('5 MB');
      await con(e.post(`/mascotas/${otra}/fotos`), C.access).expect(400);
      await con(e.post(`/mascotas/${otra}/fotos`), C.access)
        .attach('otro', await jpeg(), { filename: 'a.jpg' })
        .expect(400);
      expect(await filasFoto(otra)).toHaveLength(0);
      expect(archivosDeMascotas(e.uploads)).toEqual(antes);
    });

    it('ocho subidas simultáneas sobre una mascota vacía: exactamente 6 filas y 12 archivos', async () => {
      const vacia = await crear(C, { nombre: 'Concurrente' });
      const archivosAntes = archivosDeMascotas(e.uploads).length;
      const buffers = await Promise.all(Array.from({ length: 8 }, (_, i) => jpeg(2 + i, 2)));
      const resultados = await Promise.all(buffers.map((b) => subir(C, vacia, b)));
      const codigos = resultados.map((r) => r.status).sort();
      expect(codigos).toEqual([201, 201, 201, 201, 201, 201, 409, 409]);
      const filas = await filasFoto(vacia);
      expect(filas).toHaveLength(6);
      expect(filas.filter((f) => f.es_principal)).toHaveLength(1);
      expect(archivosDeMascotas(e.uploads).length - archivosAntes).toBe(12);
      for (const f of filas) expect(enDisco(f.url) && enDisco(f.url_catalogo)).toBe(true);
    });

    it('marca otra foto como principal: queda exactamente una', async () => {
      const res = await con(
        e.patch(`/mascotas/${mascota}/fotos/${fotos[3]}/principal`),
        C.access,
      ).expect(200);
      registrar(res, 'PATCH principal');
      expect(res.body[0]).toMatchObject({ id: fotos[3], esPrincipal: true });
      const filas = await filasFoto(mascota);
      expect(filas.filter((f) => f.es_principal).map((f) => f.id)).toEqual([fotos[3]]);
      await con(e.patch(`/mascotas/${mascota}/fotos/999999/principal`), C.access).expect(404);
    });

    it('marcar principal en paralelo nunca deja dos principales', async () => {
      await Promise.all(
        [fotos[1], fotos[2], fotos[4], fotos[5]].map((f) =>
          con(e.patch(`/mascotas/${mascota}/fotos/${f}/principal`), C.access),
        ),
      );
      const filas = await filasFoto(mascota);
      expect(filas.filter((f) => f.es_principal)).toHaveLength(1);
    });

    it('eliminar la principal promueve otra y borra los dos archivos', async () => {
      const antes = await filasFoto(mascota);
      const principal = antes.find((f) => f.es_principal)!;
      await con(e.del(`/mascotas/${mascota}/fotos/${principal.id}`), C.access).expect(204);
      const despues = await filasFoto(mascota);
      expect(despues).toHaveLength(5);
      expect(despues.filter((f) => f.es_principal)).toHaveLength(1);
      expect(despues.find((f) => f.es_principal)!.id).toBe(Math.min(...despues.map((f) => f.id)));
      expect(enDisco(principal.url) || enDisco(principal.url_catalogo)).toBe(false);
      await con(e.del(`/mascotas/${mascota}/fotos/${principal.id}`), C.access).expect(404);
      // Tras borrar una cabe otra de nuevo.
      await subir(C, mascota, await jpeg()).expect(201);
      expect(await filasFoto(mascota)).toHaveLength(6);
    });

    it('borrar todas las fotos deja la mascota sin fotos y sin archivos', async () => {
      const sola = await crear(C, { nombre: 'Solita' });
      const foto = (await subir(C, sola, await png()).expect(201)).body.id;
      const [fila] = await filasFoto(sola);
      expect(fila.es_principal).toBe(true);
      await con(e.del(`/mascotas/${sola}/fotos/${foto}`), C.access).expect(204);
      expect(await filasFoto(sola)).toHaveLength(0);
      expect(enDisco(fila.url) || enDisco(fila.url_catalogo)).toBe(false);
    });
  });

  // ───────────────────────────── B-21 ─────────────────────────────
  describe('historial médico', () => {
    let mascota: number;
    beforeAll(async () => {
      mascota = await crear(C, { nombre: 'Historial' });
    });
    const hoyBogota = (desfaseDias = 0): string => {
      const d = new Date(Date.now() + desfaseDias * 86_400_000);
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    };

    it('registra eventos y los lista públicamente por fecha descendente con desempate por id', async () => {
      const nuevo = (fecha: string, descripcion: string, extra: object = {}) =>
        con(e.post(`/mascotas/${mascota}/historial`), C.access)
          .send({ tipo: 'vacuna', fecha, descripcion, ...extra })
          .expect(201);
      const primero = await nuevo('2026-01-10', 'Rabia', { veterinario: 'Dra. Pérez' });
      registrar(primero, 'POST historial');
      expect(primero.body).toMatchObject({
        tipo: 'vacuna',
        fecha: '2026-01-10',
        veterinario: 'Dra. Pérez',
      });
      await nuevo('2026-03-01', 'Triple felina');
      await nuevo('2026-03-01', 'Refuerzo mismo día');
      await nuevo(hoyBogota(), 'Hoy en Colombia es válido');
      const res = await e.get(`/mascotas/${mascota}/historial`).expect(200);
      registrar(res, 'GET historial');
      expect(res.body.map((h: { descripcion: string }) => h.descripcion)).toEqual([
        'Hoy en Colombia es válido',
        'Refuerzo mismo día',
        'Triple felina',
        'Rabia',
      ]);
    });

    it('rechaza con 400 fechas futuras, inexistentes y datos inválidos', async () => {
      const intentar = (cuerpo: object) =>
        con(e.post(`/mascotas/${mascota}/historial`), C.access)
          .send(cuerpo)
          .expect(400);
      const futura = await intentar({ tipo: 'consulta', fecha: hoyBogota(2), descripcion: 'x' });
      expect(JSON.stringify(futura.body)).toContain('La fecha del registro no puede ser futura');
      await intentar({ tipo: 'consulta', fecha: '2026-02-30', descripcion: 'x' });
      await intentar({ tipo: 'otro', fecha: '2026-01-01', descripcion: '' });
      await intentar({ tipo: 'consulta', fecha: '2026-01-01', descripcion: 'x'.repeat(301) });
      await intentar({
        tipo: 'consulta',
        fecha: '2026-01-01',
        descripcion: 'x',
        veterinario: 'v'.repeat(101),
      });
      const n = await e.ds.query(
        'SELECT count(*)::int AS n FROM historial_medico WHERE mascota_id = $1',
        [mascota],
      );
      expect(n[0].n).toBe(4);
    });
  });

  // ───────────────────────────── B-22 ─────────────────────────────
  describe('catálogo público y ficha', () => {
    const nombres = (r: { data: { nombre: string }[] }): string[] =>
      r.data.map((m) => m.nombre).sort();
    let rex: number;

    beforeAll(async () => {
      rex = await crear(A, { nombre: 'Cat-Rex', tamano: 'grande', edadMeses: 60 });
      await crear(A, { nombre: 'Cat-Mia', razaId: razaGato, tamano: 'pequeño', edadMeses: 6 });
      await crear(B, { nombre: 'Cat-Toby', tamano: 'pequeño', edadMeses: 24 });
      await crear(B, { nombre: 'Cat-Kira', razaId: razaGato, tamano: 'mediano', edadMeses: 36 });
      await subir(A, rex, await jpeg()).expect(201);
      // Un caso de estado: ni en_proceso ni inactiva ni adoptada aparecen.
      for (const [nombre, estado] of [
        ['Cat-Proceso', 'en_proceso'],
        ['Cat-Adoptada', 'adoptada'],
      ]) {
        const id = await crear(A, { nombre });
        await e.ds.query('UPDATE mascota SET estado = $1 WHERE id = $2', [estado, id]);
      }
      const baja = await crear(A, { nombre: 'Cat-Baja' });
      await con(e.patch(`/mascotas/${baja}/baja`), A.access).expect(200);
    });

    it('sin filtros lista solo disponibles, con la foto principal y sin credenciales', async () => {
      const res = await catalogo('?limit=100');
      const cat = res.data.filter((m) => m.nombre.startsWith('Cat-'));
      expect(cat.map((m) => m.nombre).sort()).toEqual([
        'Cat-Kira',
        'Cat-Mia',
        'Cat-Rex',
        'Cat-Toby',
      ]);
      const conFoto = cat.find((m) => m.nombre === 'Cat-Rex') as unknown as {
        fotoPrincipal: { urlCatalogo: string };
        especie: string;
        ciudad: string;
        fundacion: { nombre: string };
      };
      expect(conFoto.fotoPrincipal.urlCatalogo).toMatch(/\/uploads\/mascotas\/[0-9a-f-]{36}\.jpg$/);
      expect(conFoto).toMatchObject({
        especie: 'perro',
        ciudad: 'Bogotá',
        fundacion: { nombre: 'Refugio Bogotá' },
      });
      expect(cat.find((m) => m.nombre === 'Cat-Mia')).toMatchObject({ fotoPrincipal: null });
    });

    it('filtra por especie, tamaño, rango de edad (inclusivo) y ciudad sin mayúsculas ni tildes', async () => {
      expect(nombres(await catalogo(`?especieId=${gato}&ciudad=bogotá`))).toEqual(['Cat-Mia']);
      expect(nombres(await catalogo(`?ciudad=BOGOTA`)).filter((n) => n.startsWith('Cat-'))).toEqual(
        ['Cat-Mia', 'Cat-Rex'],
      );
      expect(nombres(await catalogo(`?ciudad=medellin`))).toEqual(['Cat-Kira', 'Cat-Toby']);
      expect(nombres(await catalogo(`?ciudad=%20MEDELLÍN%20`))).toEqual(['Cat-Kira', 'Cat-Toby']);
      expect(nombres(await catalogo(`?ciudad=medellin&tamano=pequeño`))).toEqual(['Cat-Toby']);
      expect(nombres(await catalogo(`?ciudad=medellin&edadMinMeses=24&edadMaxMeses=36`))).toEqual([
        'Cat-Kira',
        'Cat-Toby',
      ]);
      expect(nombres(await catalogo(`?ciudad=medellin&edadMinMeses=25`))).toEqual(['Cat-Kira']);
      expect(nombres(await catalogo(`?ciudad=medellin&edadMaxMeses=24`))).toEqual(['Cat-Toby']);
      expect(
        nombres(
          await catalogo(
            `?ciudad=bogota&especieId=${perro}&tamano=grande&edadMinMeses=60&edadMaxMeses=60`,
          ),
        ),
      ).toEqual(['Cat-Rex']);
    });

    it('sin resultados: lista vacía con total 0; con ciudad hostil no hay inyección ni error', async () => {
      const vacio = await catalogo('?ciudad=Atlantida');
      expect(vacio).toMatchObject({ data: [], total: 0, page: 1, limit: 12 });
      const hostil = await catalogo(`?ciudad=${encodeURIComponent("x'; DROP TABLE mascota; --")}`);
      expect(hostil.total).toBe(0);
      const comodin = await catalogo('?ciudad=%25');
      expect(comodin.total).toBe(0);
      expect((await e.ds.query('SELECT count(*)::int AS n FROM mascota'))[0].n).toBeGreaterThan(5);
    });

    it('rechaza filtros inválidos con 400 y mensajes en español', async () => {
      for (const consulta of [
        '?limit=101',
        '?page=0',
        '?edadMinMeses=30&edadMaxMeses=10',
        '?tamano=enorme',
        '?especieId=abc',
        '?edadMinMeses=-1',
        '?page=99999999999999999999',
        '?ciudad=',
      ]) {
        const res = await e.get(`/mascotas${consulta}`).expect(400);
        expect(res.body.message).toBeDefined();
      }
    });

    it('pagina con orden estable por fecha descendente e id descendente, sin repetir ni omitir', async () => {
      // Empates de fecha: el desempate por id debe fijar el orden.
      await e.ds.query(
        `UPDATE mascota SET fecha_publicacion = '2026-01-01T00:00:00Z' WHERE nombre LIKE 'Cat-%'`,
      );
      const oraculo: { id: number }[] = await e.ds.query(
        `SELECT m.id FROM mascota m JOIN fundacion f ON f.id = m.fundacion_id
         WHERE m.estado = 'disponible' AND f.estado_validacion = 'aprobada'
         ORDER BY m.fecha_publicacion DESC, m.id DESC`,
      );
      const recogidos: number[] = [];
      for (let page = 1; page <= Math.ceil(oraculo.length / 3); page++) {
        const res = await catalogo(`?limit=3&page=${page}`);
        expect(res.total).toBe(oraculo.length);
        recogidos.push(...res.data.map((m) => m.id));
      }
      expect(recogidos).toEqual(oraculo.map((o) => o.id));
      expect(new Set(recogidos).size).toBe(recogidos.length);
      expect((await catalogo(`?limit=3&page=${oraculo.length}`)).data).toEqual([]);
    });

    it('la ficha trae datos, fotos con URL pública, historial y solo los datos públicos de la fundación', async () => {
      const res = await e.get(`/mascotas/${rex}`).expect(200);
      registrar(res, 'GET /mascotas/:id');
      expect(res.body).toMatchObject({
        nombre: 'Cat-Rex',
        especie: 'perro',
        tamano: 'grande',
        estadoSalud: CUERPO_MASCOTA.estadoSalud,
      });
      expect(Object.keys(res.body.fundacion).sort()).toEqual([
        'ciudad',
        'descripcion',
        'id',
        'nombre',
      ]);
      expect(res.body.fundacion).toMatchObject({ id: A.id, ciudad: 'Bogotá' });
      expect(res.body.fotos).toHaveLength(1);
      expect(res.body.fotos[0].esPrincipal).toBe(true);
      expect(res.body.historial).toEqual([]);
    });

    it('404 para inexistentes, en proceso, adoptadas e inactivas; 400 con ids inválidos', async () => {
      const ocultas: { id: number }[] = await e.ds.query(
        `SELECT id FROM mascota WHERE nombre IN ('Cat-Proceso', 'Cat-Adoptada', 'Cat-Baja')`,
      );
      expect(ocultas).toHaveLength(3);
      for (const { id } of [...ocultas, { id: 999999 }]) {
        const ficha = await e.get(`/mascotas/${id}`).expect(404);
        expect(ficha.body.message).toBe(MENSAJE_NO_EXISTE);
        await e.get(`/mascotas/${id}/historial`).expect(404);
      }
      await e.get('/mascotas/abc').expect(400);
      await e.get('/mascotas/99999999999').expect(400);
    });
  });

  // ─────────────── baja, estados y edición ───────────────
  describe('baja, transiciones de estado y edición', () => {
    it('la baja retira la mascota del catálogo y de la ficha, y la fundación aún la ve', async () => {
      const id = await crear(C, { nombre: 'Se-va' });
      expect((await e.get(`/mascotas/${id}`).expect(200)).body.nombre).toBe('Se-va');
      const res = await con(e.patch(`/mascotas/${id}/baja`), C.access).expect(200);
      expect(res.body.estado).toBe('inactiva');
      await e.get(`/mascotas/${id}`).expect(404);
      expect((await catalogo('?limit=100&ciudad=cali')).data.map((m) => m.id)).not.toContain(id);
      const propias = await con(
        e.get('/fundacion/mascotas?estado=inactiva&limit=100'),
        C.access,
      ).expect(200);
      registrar(propias, 'GET /fundacion/mascotas');
      expect(propias.body.data.map((m: { id: number }) => m.id)).toContain(id);
      expect(propias.body.data.every((m: { estado: string }) => m.estado === 'inactiva')).toBe(
        true,
      );
    });

    it('409 con el estado actual al repetir la baja o editar una inactiva, sin modificar nada', async () => {
      const id = await crear(C, { nombre: 'Inactiva' });
      await con(e.patch(`/mascotas/${id}/baja`), C.access).expect(200);
      const otra = await con(e.patch(`/mascotas/${id}/baja`), C.access).expect(409);
      expect(otra.body.message).toBe('La mascota está inactiva y no admite esta acción');
      const edit = await con(e.patch(`/mascotas/${id}`), C.access)
        .send({ nombre: 'Cambio' })
        .expect(409);
      expect(edit.body.message).toContain('inactiva');
      expect((await e.ds.query('SELECT nombre FROM mascota WHERE id = $1', [id]))[0].nombre).toBe(
        'Inactiva',
      );
    });

    it('en proceso: se edita pero no se da de baja; adoptada: ni una ni otra; el estado nunca cambia por PATCH', async () => {
      const id = await crear(C, { nombre: 'En-proceso' });
      await e.ds.query(`UPDATE mascota SET estado = 'en_proceso' WHERE id = $1`, [id]);
      const baja = await con(e.patch(`/mascotas/${id}/baja`), C.access).expect(409);
      expect(baja.body.message).toContain('en proceso');
      const edicion = await con(e.patch(`/mascotas/${id}`), C.access)
        .send({ nombre: 'Renombrada', estado: 'disponible' })
        .expect(200);
      expect(edicion.body).toMatchObject({ nombre: 'Renombrada', estado: 'en_proceso' });
      await e.ds.query(`UPDATE mascota SET estado = 'adoptada' WHERE id = $1`, [id]);
      const adoptada = await con(e.patch(`/mascotas/${id}`), C.access)
        .send({ nombre: 'Otra', estado: 'disponible' })
        .expect(409);
      expect(adoptada.body.message).toBe('La mascota está adoptada y no admite esta acción');
      await con(e.patch(`/mascotas/${id}/baja`), C.access).expect(409);
      expect(
        (await e.ds.query('SELECT estado, nombre FROM mascota WHERE id = $1', [id]))[0],
      ).toEqual({ estado: 'adoptada', nombre: 'Renombrada' });
    });

    it('edita datos descriptivos (incluida la raza), limpia opcionales con null y valida', async () => {
      const id = await crear(C, { nombre: 'Editable' });
      const res = await con(e.patch(`/mascotas/${id}`), C.access)
        .send({ nombre: '  Editada ', razaId: razaGato, color: null, edadMeses: 30 })
        .expect(200);
      expect(res.body).toMatchObject({
        nombre: 'Editada',
        razaId: razaGato,
        color: null,
        edadMeses: 30,
      });
      await con(e.patch(`/mascotas/${id}`), C.access)
        .send({ razaId: 999999 })
        .expect(400);
      await con(e.patch(`/mascotas/${id}`), C.access)
        .send({ nombre: null })
        .expect(400);
      await con(e.patch(`/mascotas/${id}`), C.access)
        .send({})
        .expect(400);
    });

    it('dos bajas simultáneas: una responde 200 y la otra 409', async () => {
      const id = await crear(C, { nombre: 'Doble-baja' });
      const [r1, r2] = await Promise.all([
        con(e.patch(`/mascotas/${id}/baja`), C.access),
        con(e.patch(`/mascotas/${id}/baja`), C.access),
      ]);
      expect([r1.status, r2.status].sort()).toEqual([200, 409]);
      expect((await e.ds.query('SELECT estado FROM mascota WHERE id = $1', [id]))[0].estado).toBe(
        'inactiva',
      );
    });

    it('baja simultánea contra un cambio a en_proceso: solo gana el que parte del estado vigente', async () => {
      for (let i = 0; i < 5; i++) {
        const id = await crear(C, { nombre: `Carrera-${i}` });
        const [baja] = await Promise.all([
          con(e.patch(`/mascotas/${id}/baja`), C.access),
          e.ds.query(
            `UPDATE mascota SET estado = 'en_proceso' WHERE id = $1 AND estado = 'disponible'`,
            [id],
          ),
        ]);
        const estado = (await e.ds.query('SELECT estado FROM mascota WHERE id = $1', [id]))[0]
          .estado;
        expect(
          baja.status === 200
            ? estado === 'inactiva'
            : estado === 'en_proceso' && baja.status === 409,
        ).toBe(true);
      }
    });
  });

  // ─────────────── propiedad y control de acceso ───────────────
  describe('propiedad y acceso', () => {
    let ajena: number;
    let foto: number;
    beforeAll(async () => {
      ajena = await crear(C, { nombre: 'De-C' });
      foto = (await subir(C, ajena, await jpeg()).expect(201)).body.id;
    });

    it('una fundación que usa una mascota ajena recibe el mismo 404 que con una inexistente, sin cambios', async () => {
      const rutas = (id: number) => [
        con(e.patch(`/mascotas/${id}`), B.access).send({ nombre: 'Robada' }),
        con(e.patch(`/mascotas/${id}/baja`), B.access),
        con(e.get(`/fundacion/mascotas/${id}`), B.access),
        subir(B, id, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])),
        con(e.patch(`/mascotas/${id}/fotos/${foto}/principal`), B.access),
        con(e.del(`/mascotas/${id}/fotos/${foto}`), B.access),
        con(e.post(`/mascotas/${id}/historial`), B.access).send({
          tipo: 'vacuna',
          fecha: '2026-01-01',
          descripcion: 'x',
        }),
      ];
      const sobreAjena = await Promise.all(rutas(ajena));
      const sobreInexistente = await Promise.all(rutas(999999));
      sobreAjena.forEach((res, i) => {
        expect([i, res.status]).toEqual([i, 404]);
        expect(res.body.message).toBe(MENSAJE_NO_EXISTE);
        expect(res.body.message).toBe(sobreInexistente[i].body.message);
        expect(res.status).toBe(sobreInexistente[i].status);
      });
      const [fila] = await e.ds.query('SELECT nombre, estado FROM mascota WHERE id = $1', [ajena]);
      expect(fila).toEqual({ nombre: 'De-C', estado: 'disponible' });
      expect(await filasFoto(ajena)).toHaveLength(1);
      expect(
        (
          await e.ds.query(
            'SELECT count(*)::int AS n FROM historial_medico WHERE mascota_id = $1',
            [ajena],
          )
        )[0].n,
      ).toBe(0);
    });

    it('GET /fundacion/mascotas devuelve solo las propias', async () => {
      const res = await con(e.get('/fundacion/mascotas?limit=100'), B.access).expect(200);
      const ids: { id: number }[] = await e.ds.query(
        'SELECT id FROM mascota WHERE fundacion_id = $1',
        [B.id],
      );
      expect(res.body.data.map((m: { id: number }) => m.id).sort()).toEqual(
        ids.map((i) => i.id).sort(),
      );
      expect(res.body.total).toBe(ids.length);
    });

    it('fundación pendiente 403, adoptante 403, anónimo 401 en todas las rutas de gestión', async () => {
      const rutas: [string, string][] = [
        ['post', '/mascotas'],
        ['patch', `/mascotas/${ajena}`],
        ['patch', `/mascotas/${ajena}/baja`],
        ['get', '/fundacion/mascotas'],
        ['get', `/fundacion/mascotas/${ajena}`],
        ['post', `/mascotas/${ajena}/fotos`],
        ['patch', `/mascotas/${ajena}/fotos/${foto}/principal`],
        ['delete', `/mascotas/${ajena}/fotos/${foto}`],
        ['post', `/mascotas/${ajena}/historial`],
      ];
      const llamar = (m: string, ruta: string, access?: string): request.Test => {
        const req = request(e.app.getHttpServer())
          [m as 'get'](`/api${ruta}`)
          .set('X-Forwarded-For', e.ipNueva());
        return access ? req.set('Authorization', bearer(access)) : req;
      };
      for (const [m, ruta] of rutas) {
        const p = await llamar(m, ruta, pendiente.access).send({ nombre: 'x' });
        expect([m, ruta, p.status]).toEqual([m, ruta, 403]);
        expect(p.body.message).toContain('pendiente de validación');
        expect([m, ruta, (await llamar(m, ruta, adoptante)).status]).toEqual([m, ruta, 403]);
        expect([m, ruta, (await llamar(m, ruta)).status]).toEqual([m, ruta, 401]);
      }
      expect(
        (await e.ds.query('SELECT nombre FROM mascota WHERE id = $1', [ajena]))[0].nombre,
      ).toBe('De-C');
    });

    it('una fundación rechazada también pierde el acceso a la gestión', async () => {
      await e.ds.query(`UPDATE fundacion SET estado_validacion = 'rechazada' WHERE id = $1`, [
        B.id,
      ]);
      await con(e.get('/fundacion/mascotas'), B.access).expect(403);
      await e.ds.query(`UPDATE fundacion SET estado_validacion = 'aprobada' WHERE id = $1`, [B.id]);
      await con(e.get('/fundacion/mascotas'), B.access).expect(200);
    });
  });

  // ─────────────── rate limit ───────────────
  describe('límite de peticiones por IP', () => {
    it('las rutas públicas aceptan 60 por minuto y la 61.ª recibe 429', async () => {
      const ip = '172.30.0.10';
      for (let i = 0; i < 60; i++) await e.get('/mascotas?limit=1', ip).expect(200);
      await e.get('/mascotas?limit=1', ip).expect(429);
      // Otra IP no se ve afectada; las demás rutas públicas tienen su propio contador.
      await e.get('/mascotas?limit=1').expect(200);
      await e.get('/especies', ip).expect(200);
    });

    it('la subida de fotos aplica un límite más estricto: 20 por minuto', async () => {
      const ip = '172.30.0.20';
      const mascota = await crear(C, { nombre: 'Limite' });
      for (let i = 0; i < 20; i++) {
        await con(e.post(`/mascotas/${mascota}/fotos`, ip), C.access)
          .attach('foto', PDF, { filename: 'x.jpg' })
          .expect(400);
      }
      await con(e.post(`/mascotas/${mascota}/fotos`, ip), C.access)
        .attach('foto', PDF, { filename: 'x.jpg' })
        .expect(429);
      // La gestión normal sigue sujeta solo al límite global.
      for (let i = 0; i < 25; i++)
        await con(e.get('/fundacion/mascotas', ip), C.access).expect(200);
    });
  });

  // ─────────────── cierre: claves prohibidas y huérfanos ───────────────
  describe('verificación final', () => {
    it('ninguna respuesta real expone claves de almacenamiento ni datos privados de la fundación', () => {
      expect(respuestas.length).toBeGreaterThan(20);
      const todas = respuestas.flatMap((r) => violaciones(r.cuerpo, r.ruta));
      expect(todas).toEqual([]);
      const publicas = respuestas.filter((r) => r.ruta.startsWith('GET /mascotas'));
      const texto = JSON.stringify(publicas.map((r) => r.cuerpo));
      for (const secreto of [e.sufijo.toString(), 'documento', 'privado/', 'contrasena']) {
        expect(texto).not.toContain(secreto);
      }
    });

    it('no quedan archivos huérfanos: los de disco son exactamente los de la base', async () => {
      const filas: { url: string; url_catalogo: string }[] = await e.ds.query(
        'SELECT url, url_catalogo FROM foto_mascota',
      );
      const esperados = filas
        .flatMap((f) => [f.url, f.url_catalogo])
        .map((k) => k.split('/').pop()!)
        .sort();
      expect(archivosDeMascotas(e.uploads)).toEqual(esperados);
      expect(esperados.length).toBeGreaterThan(20);
    });
  });
});
