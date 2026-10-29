import 'reflect-metadata';
import * as path from 'node:path';
import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import { DonationRegistered } from '../../src/common/events';
import { ADMIN, arrancarEntorno, type Entorno } from '../auth/helpers';
import {
  adoptanteConSesion,
  type AdoptantePrueba,
  archivosDonaciones,
  centimos,
  con,
  contar,
  correosConAsunto,
  EJECUTABLE,
  enDisco,
  esperarCorreos,
  esperarHasta,
  fundacionAprobada,
  type FundacionPrueba,
  jpeg,
  notificacionesConClave,
  notificacionesDe,
  PDF,
  png,
  PROHIBIDAS_V14,
  SVG,
  usuarioIdDe,
  usuarioIdDeFundacion,
  violacionesDeClaves,
} from './helpers';

// V14 (donaciones): B-33 y B-34 sobre la AppModule real (Postgres, Mailpit y disco).
// Requiere Postgres (DATABASE_*) y Mailpit (SMTP_HOST/SMTP_PORT y MAILPIT_UI_PORT).
interface Archivo {
  buffer: Buffer;
  nombre: string;
  tipo: string;
}

const ASUNTO_CONFIRMACION = 'Confirmamos tu donación en PetHogar';

describe('V14 — donaciones: registro, listado con totales y comprobantes (Postgres, Mailpit y disco)', () => {
  let e: Entorno;
  let F1: FundacionPrueba;
  let F2: FundacionPrueba;
  let F3: FundacionPrueba; // la del oráculo del listado
  let Ad1: AdoptantePrueba;
  let admin: string;
  let usuarioF1: number;
  let usuarioF2: number;
  let usuarioF3: number;
  let usuarioAd1: number;
  let emitidos: DonationRegistered[];
  const respuestas: unknown[] = [];

  const archivo = (buffer: Buffer, nombre: string, tipo: string): Archivo => ({
    buffer,
    nombre,
    tipo,
  });
  const donar = (
    access: string,
    campos: Record<string, string>,
    adjunto?: Archivo,
    ip?: string,
  ) => {
    const r = con(e.post('/donaciones', ip), access);
    for (const [k, v] of Object.entries(campos)) r.field(k, v);
    if (adjunto) {
      r.attach('comprobante', adjunto.buffer, {
        filename: adjunto.nombre,
        contentType: adjunto.tipo,
      });
    }
    return r;
  };
  const manual = (f: FundacionPrueba, campos: Record<string, string>, adjunto?: Archivo) => {
    const r = con(e.post('/fundacion/donaciones'), f.access);
    for (const [k, v] of Object.entries(campos)) r.field(k, v);
    if (adjunto) {
      r.attach('comprobante', adjunto.buffer, {
        filename: adjunto.nombre,
        contentType: adjunto.tipo,
      });
    }
    return r;
  };
  const filas = (): Promise<number> => contar(e, 'SELECT count(*) AS n FROM donacion');
  const registrada = async (id: number) =>
    (
      (await e.ds.query(
        `SELECT id, fundacion_id, usuario_id, nombre_donante, tipo, monto::text AS monto,
                descripcion_especie, comprobante_url FROM donacion WHERE id = $1`,
        [id],
      )) as {
        id: number;
        fundacion_id: number;
        usuario_id: number | null;
        nombre_donante: string | null;
        tipo: string;
        monto: string | null;
        descripcion_especie: string | null;
        comprobante_url: string | null;
      }[]
    )[0];

  beforeAll(async () => {
    process.env.SEGUIMIENTOS_CRON_HABILITADO = 'false';
    e = await arrancarEntorno();
    admin = (await e.sesion(ADMIN.email, ADMIN.clave)).access;
    [F1, F2, F3] = [
      await fundacionAprobada(e, 'Cali'),
      await fundacionAprobada(e, 'Bogotá'),
      await fundacionAprobada(e, 'Medellín'),
    ];
    Ad1 = await adoptanteConSesion(e);
    usuarioAd1 = await usuarioIdDe(e, Ad1.email);
    [usuarioF1, usuarioF2, usuarioF3] = await Promise.all([
      usuarioIdDeFundacion(e, F1.id),
      usuarioIdDeFundacion(e, F2.id),
      usuarioIdDeFundacion(e, F3.id),
    ]);
    emitidos = [];
    e.app.get(EventEmitter2).on(DonationRegistered.eventName, (ev: DonationRegistered) => {
      emitidos.push(ev);
    });
  });
  afterAll(() => e?.cerrar());

  // ───────────────────────── registro del donante (B-33) ─────────────────────────
  describe('registro del donante', () => {
    it('económica con comprobante PDF: 201, fila con el donante del token, archivo privado, correo y avisos', async () => {
      const res = await donar(
        Ad1.access,
        { fundacionId: String(F1.id), tipo: 'economica', monto: '50000.5', usuarioId: '9999' },
        archivo(PDF, 'recibo.pdf', 'application/pdf'),
      ).expect(201);
      respuestas.push(res.body);
      expect(res.body).toMatchObject({
        fundacion: { id: F1.id, nombre: 'Refugio Cali' },
        tipo: 'economica',
        monto: '50000.50',
        descripcionEspecie: null,
        comprobante: true,
      });
      expect(Object.keys(res.body).sort()).toEqual([
        'comprobante',
        'descripcionEspecie',
        'fecha',
        'fundacion',
        'id',
        'monto',
        'tipo',
      ]);
      const fila = await registrada(res.body.id);
      expect(fila).toMatchObject({
        fundacion_id: F1.id,
        usuario_id: usuarioAd1, // el del token, no el del cuerpo
        nombre_donante: null,
        tipo: 'economica',
        monto: '50000.50',
        descripcion_especie: null,
      });
      expect(fila.comprobante_url).toMatch(/^privado\/donaciones\/[0-9a-f-]{36}\.pdf$/);
      expect(enDisco(e.uploads, fila.comprobante_url!)).toBe(true);
      // Carpeta privada: no se sirve bajo /uploads.
      await request(e.app.getHttpServer()).get(`/uploads/${fila.comprobante_url}`).expect(404);
      await request(e.app.getHttpServer())
        .get(`/uploads/privado/donaciones/${path.basename(fila.comprobante_url!)}`)
        .expect(404);
      expect(violacionesDeClaves(res.body, '$', PROHIBIDAS_V14)).toEqual([]);

      // El evento sale tras guardar, y los avisos llegan por los listeners (asíncronos).
      expect(emitidos.at(-1)).toMatchObject({
        donacionId: res.body.id,
        fundacionId: F1.id,
        usuarioId: usuarioAd1,
      });
      const [correo] = await esperarCorreos(Ad1.email, ASUNTO_CONFIRMACION, 1);
      expect(correo.texto).toContain('Refugio Cali');
      expect(correo.texto).toContain('$ 50.000,50 COP');
      expect(correo.texto).not.toContain('privado/');
      const aviso = (
        await esperarHasta(async () => {
          const l = await notificacionesConClave(
            e,
            usuarioF1,
            `donation.registered:${res.body.id}`,
          );
          return l.length ? l : null;
        }, 'notificación a la fundación')
      )[0];
      expect(aviso).toMatchObject({
        tipo: 'donacion',
        entidad: 'donacion',
        entidad_id: res.body.id,
        leida: false,
      });
      expect(aviso.mensaje).toBe('Recibiste una donación económica de $ 50.000,50 COP.');
      expect(aviso.mensaje).not.toMatch(/Ana|@/); // sin datos del donante
      // La fundación NO recibe correo por una donación; el donante sí tiene su notificación.
      expect(
        (await notificacionesConClave(e, usuarioAd1, `donation.registered:${res.body.id}`)).length,
      ).toBe(1);
      expect(await correosConAsunto(F1.email, ASUNTO_CONFIRMACION)).toEqual([]);
    });

    it.each([
      ['JPG', () => jpeg(), 'foto.jpg', 'image/jpeg', 'jpg'],
      ['PNG', () => png(), 'foto.png', 'image/png', 'png'],
    ])('en especie con comprobante %s real', async (_n, crear, nombre, tipo, ext) => {
      const res = await donar(
        Ad1.access,
        {
          fundacionId: String(F1.id),
          tipo: 'especie',
          descripcion: '  Dos bultos de croquetas  ',
          monto: 'x',
        },
        archivo(await crear(), nombre, tipo),
      ).expect(201);
      respuestas.push(res.body);
      expect(res.body).toMatchObject({
        tipo: 'especie',
        monto: null,
        descripcionEspecie: 'Dos bultos de croquetas',
        comprobante: true,
      });
      const fila = await registrada(res.body.id);
      expect(fila.monto).toBeNull();
      expect(fila.comprobante_url).toMatch(new RegExp(`^privado/donaciones/.+\\.${ext}$`));
      expect(enDisco(e.uploads, fila.comprobante_url!)).toBe(true);
    });

    it('sin comprobante es válido y no deja archivo; un usuario de fundación puede donar a otra', async () => {
      const antes = archivosDonaciones(e.uploads).length;
      const res = await donar(F2.access, {
        fundacionId: String(F1.id),
        tipo: 'economica',
        monto: '1000',
      }).expect(201);
      expect(res.body.comprobante).toBe(false);
      const fila = await registrada(res.body.id);
      expect(fila).toMatchObject({ usuario_id: usuarioF2, comprobante_url: null });
      expect(archivosDonaciones(e.uploads)).toHaveLength(antes);
    });

    it('datos inválidos: 400 por campo, sin fila, sin archivo y sin evento', async () => {
      const filasAntes = await filas();
      const archivosAntes = archivosDonaciones(e.uploads);
      const eventosAntes = emitidos.length;
      const base = { fundacionId: String(F1.id) };
      const pdf = archivo(PDF, 'r.pdf', 'application/pdf');
      const casos: [string, Record<string, string>, string | undefined][] = [
        ['monto 0', { ...base, tipo: 'economica', monto: '0' }, 'monto'],
        ['monto 0.00', { ...base, tipo: 'economica', monto: '0.00' }, 'monto'],
        ['monto negativo', { ...base, tipo: 'economica', monto: '-1' }, 'monto'],
        ['3 decimales', { ...base, tipo: 'economica', monto: '1.234' }, 'monto'],
        ['notación científica', { ...base, tipo: 'economica', monto: '1e3' }, 'monto'],
        ['sobre el tope', { ...base, tipo: 'economica', monto: '1000000000.01' }, 'monto'],
        ['sin monto', { ...base, tipo: 'economica' }, 'monto'],
        ['especie sin descripción', { ...base, tipo: 'especie' }, 'descripcion'],
        [
          'especie con descripción de 301',
          { ...base, tipo: 'especie', descripcion: 'x'.repeat(301) },
          'descripcion',
        ],
        ['tipo desconocido', { ...base, tipo: 'cripto', monto: '5' }, 'tipo'],
        [
          'fundación no numérica',
          { fundacionId: 'abc', tipo: 'economica', monto: '5' },
          'fundacionId',
        ],
      ];
      for (const [nombre, campos, campo] of casos) {
        const res = await donar(Ad1.access, campos, pdf).expect(400);
        expect(res.body.errores.map((x: { campo: string }) => x.campo)).toContain(campo);
        expect(res.body.message).toBeDefined();
        expect(nombre).toBeDefined();
      }
      expect(await filas()).toBe(filasAntes);
      expect(archivosDonaciones(e.uploads)).toEqual(archivosAntes);
      expect(emitidos).toHaveLength(eventosAntes);
    });

    it('comprobantes inválidos (SVG, ejecutable, vacío, > 5 MB, campo equivocado): sin fila ni archivo', async () => {
      const filasAntes = await filas();
      const archivosAntes = archivosDonaciones(e.uploads);
      const campos = { fundacionId: String(F1.id), tipo: 'economica', monto: '10' };
      await donar(Ad1.access, campos, archivo(SVG, 'a.svg', 'image/svg+xml')).expect(400);
      await donar(Ad1.access, campos, archivo(EJECUTABLE, 'a.pdf', 'application/pdf')).expect(400);
      await donar(Ad1.access, campos, archivo(Buffer.alloc(0), 'a.pdf', 'application/pdf')).expect(
        400,
      );
      const grande = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024, 1)]);
      const res = await donar(
        Ad1.access,
        campos,
        archivo(grande, 'a.pdf', 'application/pdf'),
      ).expect(413);
      expect(res.body.message).toContain('5 MB');
      const r = con(e.post('/donaciones'), Ad1.access);
      for (const [k, v] of Object.entries(campos)) r.field(k, v);
      await r.attach('otro', PDF, { filename: 'a.pdf' }).expect(400);
      expect(await filas()).toBe(filasAntes);
      expect(archivosDonaciones(e.uploads)).toEqual(archivosAntes);
    });

    it('fundación pendiente, rechazada o inexistente: el mismo 404, sin fila ni archivo', async () => {
      const registrar = async (nombre: string): Promise<number> => {
        const nit = `97${e.sufijo}${Math.floor(Math.random() * 1000)}`.slice(0, 20);
        await e.registrarFundacion(e.nuevoCorreo(), nit, nombre).expect(201);
        const [{ id }]: { id: number }[] = await e.ds.query(
          'SELECT id FROM fundacion WHERE nit = $1',
          [nit],
        );
        return id;
      };
      const pendiente = await registrar('Pendiente V14');
      const rechazada = await registrar('Rechazada V14');
      await e.ds.query(`UPDATE fundacion SET estado_validacion = 'rechazada' WHERE id = $1`, [
        rechazada,
      ]);
      const filasAntes = await filas();
      const archivosAntes = archivosDonaciones(e.uploads);
      const mensajes = new Set<string>();
      for (const id of [pendiente, rechazada, 987654]) {
        const res = await donar(
          Ad1.access,
          { fundacionId: String(id), tipo: 'economica', monto: '10' },
          archivo(PDF, 'r.pdf', 'application/pdf'),
        ).expect(404);
        mensajes.add(res.body.message);
      }
      expect([...mensajes]).toEqual(['La fundación no existe o no recibe donaciones']);
      expect(await filas()).toBe(filasAntes);
      expect(archivosDonaciones(e.uploads)).toEqual(archivosAntes);
    });

    it('donar a la propia fundación es 403; el administrador 403; el anónimo 401', async () => {
      const filasAntes = await filas();
      const campos = { fundacionId: String(F1.id), tipo: 'economica', monto: '10' };
      const propia = await donar(
        F1.access,
        campos,
        archivo(PDF, 'r.pdf', 'application/pdf'),
      ).expect(403);
      expect(propia.body.message).toContain('propia fundación');
      await donar(admin, campos).expect(403);
      const r = e.post('/donaciones');
      for (const [k, v] of Object.entries(campos)) r.field(k, v);
      await r.expect(401);
      expect(await filas()).toBe(filasAntes);
      expect(
        archivosDonaciones(e.uploads).every((a) => enDisco(e.uploads, `privado/donaciones/${a}`)),
      ).toBe(true);
    });

    it('6 donaciones simultáneas con comprobante: 6 filas y 6 archivos, sin huérfanos', async () => {
      const filasAntes = await filas();
      const archivosAntes = archivosDonaciones(e.uploads).length;
      const resultados = await Promise.all(
        Array.from({ length: 6 }, (_v, i) =>
          donar(
            Ad1.access,
            { fundacionId: String(F3.id), tipo: 'economica', monto: `${i + 1}.25` },
            archivo(PDF, 'r.pdf', 'application/pdf'),
          ),
        ),
      );
      for (const r of resultados) expect(r.status).toBe(201);
      expect(await filas()).toBe(filasAntes + 6);
      expect(archivosDonaciones(e.uploads)).toHaveLength(archivosAntes + 6);
      // Disco y base coinciden exactamente.
      const claves: { comprobante_url: string }[] = await e.ds.query(
        'SELECT comprobante_url FROM donacion WHERE comprobante_url IS NOT NULL',
      );
      expect(claves.map((c) => path.basename(c.comprobante_url)).sort()).toEqual(
        archivosDonaciones(e.uploads),
      );
    });

    it('límite de 10 por minuto por IP', async () => {
      const ip = e.ipNueva();
      const estados: number[] = [];
      for (let i = 0; i < 11; i++) {
        estados.push((await donar(Ad1.access, { tipo: 'economica' }, undefined, ip)).status);
      }
      expect(estados.slice(0, 10).every((s) => s === 400)).toBe(true);
      expect(estados[10]).toBe(429);
    });
  });

  // ───────────────────────── listado y totales (B-34) ─────────────────────────
  describe('listado con periodo, tipo y totales contra un oráculo SQL', () => {
    const lista = (f: FundacionPrueba, consulta = '') =>
      con(e.get(`/fundacion/donaciones${consulta}`), f.access);

    beforeAll(async () => {
      const insertar = (
        fundacion: number,
        tipo: 'economica' | 'especie',
        monto: string | null,
        fecha: string,
        usuario: number | null,
        nombre: string | null,
        descripcion: string | null = null,
      ) =>
        e.ds.query(
          `INSERT INTO donacion (fundacion_id, usuario_id, nombre_donante, tipo, monto, descripcion_especie, fecha)
           VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)`,
          [fundacion, usuario, nombre, tipo, monto, descripcion, fecha],
        );
      // Fronteras de Bogotá (UTC-5): primer y último instante de octubre y el primero de noviembre.
      await insertar(
        F3.id,
        'economica',
        '999999999.99',
        '2026-10-01 00:00:00-05',
        usuarioAd1,
        null,
      );
      await insertar(F3.id, 'economica', '0.01', '2026-09-30 23:59:59-05', null, 'Antes Del Mes');
      await insertar(F3.id, 'economica', '200.20', '2026-10-31 23:59:59-05', usuarioAd1, null);
      await insertar(F3.id, 'economica', '0.30', '2026-11-01 00:00:00-05', usuarioF2, null);
      await insertar(
        F3.id,
        'especie',
        null,
        '2026-10-31 23:59:59.999-05',
        null,
        'Pedro Paz',
        'Cobijas',
      );
      await insertar(
        F3.id,
        'especie',
        null,
        '2026-11-01 00:00:00-05',
        null,
        'Luisa Gómez',
        'Arena',
      );
      // Mismo instante: el desempate por id debe ser estable.
      for (let i = 0; i < 4; i++) {
        await insertar(F3.id, 'economica', '10.10', '2026-10-15 12:00:00-05', null, `Empate ${i}`);
      }
      for (let i = 0; i < 24; i++) {
        const dia = String((i % 28) + 1).padStart(2, '0');
        const mes = i % 3 === 0 ? '10' : i % 3 === 1 ? '11' : '12';
        if (i % 4 === 0) {
          await insertar(
            F3.id,
            'especie',
            null,
            `2026-${mes}-${dia} 08:30:00-05`,
            null,
            `Donante ${i}`,
            `Ítem ${i}`,
          );
        } else {
          const monto = `${(i + 1) * 1111}.${String((i * 7) % 100).padStart(2, '0')}`;
          await insertar(
            F3.id,
            'economica',
            monto,
            `2026-${mes}-${dia} 18:45:00-05`,
            null,
            `Donante ${i}`,
          );
        }
      }
      // Donaciones de OTRAS fundaciones (no deben aparecer en la lista de F3).
      await insertar(F2.id, 'economica', '777.00', '2026-10-15 12:00:00-05', null, 'Ajena');
    });

    /** Oráculo: SQL independiente del servicio (suma de días y de zona con aritmética de Postgres). */
    async function oraculo(desde?: string, hasta?: string, tipo?: string) {
      const where = `fundacion_id = $1
        AND ($2::text IS NULL OR fecha >= ($2 || ' 00:00:00-05')::timestamptz)
        AND ($3::text IS NULL OR fecha < ((($3::date + 1)::text) || ' 00:00:00-05')::timestamptz)
        AND ($4::text IS NULL OR tipo::text = $4)`;
      const parametros = [F3.id, desde ?? null, hasta ?? null, tipo ?? null];
      const ids: { id: number }[] = await e.ds.query(
        `SELECT id FROM donacion WHERE ${where} ORDER BY fecha DESC, id DESC`,
        parametros,
      );
      const agregado: { tipo: string; cantidad: number; monto: string }[] = await e.ds.query(
        `SELECT tipo::text AS tipo, count(*)::int AS cantidad, COALESCE(sum(monto), 0)::text AS monto
           FROM donacion WHERE ${where} GROUP BY tipo`,
        parametros,
      );
      return { ids: ids.map((x) => x.id), agregado };
    }

    /** Recorre TODAS las páginas y devuelve las filas, el total y los totales (siempre iguales). */
    async function todas(consulta: string, limit = 7) {
      const filasTodas: { id: number; tipo: string; monto: string | null }[] = [];
      let totales: unknown;
      let total = -1;
      for (let page = 1; ; page++) {
        const sep = consulta ? `${consulta}&` : '?';
        const res = await lista(F3, `${sep}page=${page}&limit=${limit}`).expect(200);
        respuestas.push(res.body);
        if (page === 1) {
          totales = res.body.totales;
          total = res.body.total;
        }
        // Los totales no cambian de página en página: son del filtro, no de la página.
        expect(res.body.totales).toEqual(totales);
        expect(res.body.total).toBe(total);
        filasTodas.push(...res.body.data);
        if (res.body.data.length < limit || filasTodas.length >= total) break;
      }
      return {
        filas: filasTodas,
        total,
        totales: totales as {
          economica: { cantidad: number; monto: string };
          especie: { cantidad: number };
        },
      };
    }

    interface Caso {
      nombre: string;
      consulta: string;
      desde?: string;
      hasta?: string;
      tipo?: string;
    }
    const CASOS: Caso[] = [
      { nombre: 'sin filtros', consulta: '' },
      {
        nombre: 'octubre completo',
        consulta: '?desde=2026-10-01&hasta=2026-10-31',
        desde: '2026-10-01',
        hasta: '2026-10-31',
      },
      { nombre: 'desde noviembre', consulta: '?desde=2026-11-01', desde: '2026-11-01' },
      { nombre: 'hasta el 31 de octubre', consulta: '?hasta=2026-10-31', hasta: '2026-10-31' },
      { nombre: 'solo económicas', consulta: '?tipo=economica', tipo: 'economica' },
      { nombre: 'solo en especie', consulta: '?tipo=especie', tipo: 'especie' },
      {
        nombre: 'periodo y tipo',
        consulta: '?desde=2026-10-01&hasta=2026-11-30&tipo=economica',
        desde: '2026-10-01',
        hasta: '2026-11-30',
        tipo: 'economica',
      },
      {
        nombre: 'un solo día (último de octubre)',
        consulta: '?desde=2026-10-31&hasta=2026-10-31',
        desde: '2026-10-31',
        hasta: '2026-10-31',
      },
      {
        nombre: 'periodo sin donaciones',
        consulta: '?desde=2027-01-01&hasta=2027-01-31',
        desde: '2027-01-01',
        hasta: '2027-01-31',
      },
    ];

    it.each(CASOS)(
      '$nombre: las páginas suman exactamente los totales y coinciden con el oráculo',
      async ({ consulta, desde, hasta, tipo }) => {
        const esperado = await oraculo(desde, hasta, tipo);
        const obtenido = await todas(consulta);
        expect(obtenido.filas.map((f) => f.id)).toEqual(esperado.ids); // mismos registros y orden
        expect(obtenido.total).toBe(esperado.ids.length);

        const de = (t: string) => esperado.agregado.find((a) => a.tipo === t);
        expect(obtenido.totales.economica.cantidad).toBe(de('economica')?.cantidad ?? 0);
        expect(obtenido.totales.especie.cantidad).toBe(de('especie')?.cantidad ?? 0);
        expect(typeof obtenido.totales.economica.monto).toBe('string');
        expect(centimos(obtenido.totales.economica.monto)).toBe(
          centimos(de('economica')?.monto ?? '0'),
        );
        // La suma de los registros devueltos (en céntimos, sin Number) es el total mostrado.
        const suma = obtenido.filas
          .filter((f) => f.tipo === 'economica')
          .reduce((acc, f) => acc + centimos(f.monto as string), 0n);
        expect(suma).toBe(centimos(obtenido.totales.economica.monto));
        expect(obtenido.totales.economica.monto).toMatch(/^\d+\.\d{2}$/);
      },
    );

    it('los bordes del periodo: el último día entra completo y el siguiente a las 00:00 no', async () => {
      const octubre = await lista(F3, '?desde=2026-10-01&hasta=2026-10-31&limit=100').expect(200);
      const montos = octubre.body.data.map((d: { monto: string | null }) => d.monto);
      expect(montos).toContain('200.20'); // 2026-10-31 23:59:59-05
      expect(montos).toContain('999999999.99'); // 2026-10-01 00:00:00-05
      expect(montos).not.toContain('0.30'); // 2026-11-01 00:00:00-05
      expect(montos).not.toContain('0.01'); // 2026-09-30 23:59:59-05
      const especies = octubre.body.data.filter((d: { tipo: string }) => d.tipo === 'especie');
      expect(especies.map((d: { descripcionEspecie: string }) => d.descripcionEspecie)).toContain(
        'Cobijas',
      );
      expect(
        especies.map((d: { descripcionEspecie: string }) => d.descripcionEspecie),
      ).not.toContain('Arena');

      const noviembre = await lista(F3, '?desde=2026-11-01&hasta=2026-11-01&limit=100').expect(200);
      const nov = noviembre.body.data.map((d: { monto: string | null }) => d.monto);
      expect(nov).toContain('0.30');
      expect(nov).not.toContain('200.20');
    });

    it('el desempate es estable: las donaciones del mismo instante se ordenan por id descendente', async () => {
      const res = await lista(F3, '?desde=2026-10-15&hasta=2026-10-15&limit=100').expect(200);
      const empate = res.body.data.filter((d: { monto: string }) => d.monto === '10.10');
      const ids = empate.map((d: { id: number }) => d.id);
      expect(ids).toHaveLength(4);
      expect(ids).toEqual([...ids].sort((a, b) => b - a));
    });

    it('el donante visible es solo nombre y origen; sin correo, teléfono ni claves', async () => {
      const res = await lista(F3, '?limit=100').expect(200);
      const donantes = new Map<string, string>();
      for (const d of res.body.data) {
        expect(Object.keys(d.donante).sort()).toEqual(['nombre', 'origen']);
        donantes.set(d.donante.nombre, d.donante.origen);
      }
      expect(donantes.get('Pedro Paz')).toBe('manual');
      expect(donantes.get('Ana Pérez')).toBe('plataforma'); // adoptante registrado
      expect(donantes.get('Refugio Cali')).toBeUndefined();
      expect(donantes.get('Refugio Bogotá')).toBe('plataforma'); // usuario de otra fundación
      const texto = JSON.stringify(res.body);
      expect(texto).not.toContain(Ad1.email);
      expect(texto).not.toMatch(/privado\/|3001234567|comprobanteUrl/);
      expect(violacionesDeClaves(res.body, '$', PROHIBIDAS_V14)).toEqual([]);
    });

    it('una fundación solo ve sus donaciones: la ajena no aparece y su propia lista es otra', async () => {
      const mia = await lista(F2, '?limit=100').expect(200);
      const montos = mia.body.data.map((d: { monto: string | null }) => d.monto);
      expect(montos).toContain('777.00');
      expect(montos).not.toContain('200.20');
      const total: number = await contar(
        e,
        'SELECT count(*) AS n FROM donacion WHERE fundacion_id = $1',
        [F2.id],
      );
      expect(mia.body.total).toBe(total);
    });

    it('una fundación sin donaciones recibe ceros como cadenas', async () => {
      const [vacia] = [await fundacionAprobada(e, 'Pasto')];
      const res = await lista(vacia).expect(200);
      expect(res.body).toMatchObject({
        data: [],
        total: 0,
        totales: { economica: { cantidad: 0, monto: '0.00' }, especie: { cantidad: 0 } },
      });
    });

    it('filtros inválidos: 400 en español; roles y estado de la fundación', async () => {
      const periodo = await lista(F3, '?desde=2026-10-05&hasta=2026-10-04').expect(400);
      expect(periodo.body.message).toBe('La fecha final no puede ser anterior a la inicial');
      await lista(F3, '?desde=2026-02-30').expect(400);
      await lista(F3, '?hasta=31-10-2026').expect(400);
      await lista(F3, '?tipo=otro').expect(400);
      await lista(F3, '?limit=101').expect(400);
      await lista(F3, '?page=0').expect(400);
      await e.get('/fundacion/donaciones').expect(401);
      await con(e.get('/fundacion/donaciones'), Ad1.access).expect(403);
      await con(e.get('/fundacion/donaciones'), admin).expect(403);
    });
  });

  // ───────────────────────── registro manual y comprobantes ─────────────────────────
  describe('registro manual y descarga del comprobante', () => {
    it('registra un aporte presencial: sin usuario, sin evento y sin correo ni aviso', async () => {
      const eventosAntes = emitidos.length;
      const avisosAntes = (await notificacionesDe(e, usuarioF3)).length;
      const res = await manual(
        F3,
        {
          nombreDonante: '  Marta Ruiz  ',
          tipo: 'economica',
          monto: '12345.6',
          fundacionId: String(F1.id),
          usuarioId: '1',
        },
        archivo(PDF, 'recibo.pdf', 'application/pdf'),
      ).expect(201);
      respuestas.push(res.body);
      expect(res.body).toMatchObject({
        fundacion: { id: F3.id },
        tipo: 'economica',
        monto: '12345.60',
        comprobante: true,
      });
      const fila = await registrada(res.body.id);
      expect(fila).toMatchObject({
        fundacion_id: F3.id, // la del token, no la del cuerpo
        usuario_id: null,
        nombre_donante: 'Marta Ruiz',
        monto: '12345.60',
      });
      expect(emitidos).toHaveLength(eventosAntes);
      expect((await notificacionesDe(e, usuarioF3)).length).toBe(avisosAntes);
      // Aparece en el listado como aporte manual.
      const listado = await con(e.get('/fundacion/donaciones?limit=100'), F3.access).expect(200);
      const mia = listado.body.data.find((d: { id: number }) => d.id === res.body.id);
      expect(mia.donante).toEqual({ nombre: 'Marta Ruiz', origen: 'manual' });
    });

    it('en especie manual sin comprobante, y validaciones: el nombre es obligatorio', async () => {
      const ok = await manual(F3, {
        nombreDonante: 'Luis',
        tipo: 'especie',
        descripcion: 'Collares',
      }).expect(201);
      expect(ok.body.comprobante).toBe(false);
      expect((await registrada(ok.body.id)).usuario_id).toBeNull();
      const filasAntes = await filas();
      const sin = await manual(F3, { tipo: 'economica', monto: '5' }).expect(400);
      expect(sin.body.errores.map((x: { campo: string }) => x.campo)).toContain('nombreDonante');
      await manual(F3, { nombreDonante: 'A', tipo: 'economica', monto: '5' }).expect(400);
      await manual(F3, { nombreDonante: 'Luis', tipo: 'economica', monto: '0' }).expect(400);
      await manual(F3, { nombreDonante: 'Luis', tipo: 'especie' }).expect(400);
      await manual(
        F3,
        { nombreDonante: 'Luis', tipo: 'economica', monto: '5' },
        archivo(SVG, 'a.svg', 'image/svg+xml'),
      ).expect(400);
      expect(await filas()).toBe(filasAntes);
      await con(e.post('/fundacion/donaciones'), Ad1.access)
        .field('nombreDonante', 'Luis')
        .expect(403);
      await con(e.post('/fundacion/donaciones'), admin).field('nombreDonante', 'Luis').expect(403);
      await e.post('/fundacion/donaciones').field('nombreDonante', 'Luis').expect(401);
    });

    it('la fundación dueña descarga su comprobante con cabeceras seguras y sin clave', async () => {
      const subido = await manual(
        F3,
        { nombreDonante: 'Elena', tipo: 'economica', monto: '20' },
        archivo(PDF, 'recibo.pdf', 'application/pdf'),
      ).expect(201);
      const res = await con(e.get(`/fundacion/donaciones/${subido.body.id}/comprobante`), F3.access)
        .buffer(true)
        .parse((r, cb) => {
          const trozos: Buffer[] = [];
          r.on('data', (t: Buffer) => trozos.push(t));
          r.on('end', () => cb(null, Buffer.concat(trozos)));
        })
        .expect(200);
      expect(Buffer.from(res.body).equals(PDF)).toBe(true);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['content-disposition']).toBe(
        `inline; filename="comprobante-donacion-${subido.body.id}.pdf"`,
      );
      expect(JSON.stringify(res.headers)).not.toMatch(/privado\/|\.pdf"?\s*,\s*"/);
    });

    it('ajena, inexistente y sin comprobante responden el mismo 404; otros roles 403/401', async () => {
      const [{ id: conComprobante }]: { id: number }[] = await e.ds.query(
        `SELECT id FROM donacion WHERE fundacion_id = $1 AND comprobante_url IS NOT NULL LIMIT 1`,
        [F3.id],
      );
      const [{ id: sinComprobante }]: { id: number }[] = await e.ds.query(
        `SELECT id FROM donacion WHERE fundacion_id = $1 AND comprobante_url IS NULL LIMIT 1`,
        [F3.id],
      );
      const mensajes = new Set<string>();
      for (const [f, id] of [
        [F2, conComprobante], // ajena
        [F3, 999999], // inexistente
        [F3, sinComprobante], // sin comprobante
      ] as const) {
        const res = await con(e.get(`/fundacion/donaciones/${id}/comprobante`), f.access).expect(
          404,
        );
        mensajes.add(res.body.message);
      }
      expect([...mensajes]).toEqual(['La donación o su comprobante no existe']);
      await con(e.get(`/fundacion/donaciones/${conComprobante}/comprobante`), Ad1.access).expect(
        403,
      );
      await con(e.get(`/fundacion/donaciones/${conComprobante}/comprobante`), admin).expect(403);
      await e.get(`/fundacion/donaciones/${conComprobante}/comprobante`).expect(401);
      await con(e.get('/fundacion/donaciones/0/comprobante'), F3.access).expect(400);
      // El donante no tiene ruta de descarga.
      await con(e.get(`/donaciones/${conComprobante}/comprobante`), Ad1.access).expect(404);
    });

    it('barrido: ninguna respuesta de la Feature trae claves de almacenamiento ni datos sensibles', () => {
      expect(respuestas.length).toBeGreaterThan(5);
      for (const cuerpo of respuestas) {
        expect(violacionesDeClaves(cuerpo, '$', PROHIBIDAS_V14)).toEqual([]);
      }
      expect(JSON.stringify(respuestas)).not.toMatch(/privado\//);
    });
  });
});
