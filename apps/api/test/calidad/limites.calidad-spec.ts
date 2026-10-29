import 'reflect-metadata';
import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import type request from 'supertest';
import { MAX_BYTES } from '../../src/modules/storage/storage.constants';
import { ADMIN, arrancarEntorno, type Entorno } from '../auth/helpers';
import {
  adoptanteConSesion,
  type AdoptantePrueba,
  con,
  fundacionAprobada,
  type FundacionPrueba,
  jpeg,
  PDF,
} from '../seguimientos/helpers';

// V15 (límites de subida): cada endpoint con subida rechaza un archivo de MAX_BYTES + 1 (413) y más
// archivos de los permitidos (400), sin dejar archivos en disco. Los límites se aplican en el
// interceptor, antes de la lógica de cada ruta.
// Requiere Postgres (DATABASE_*) y Mailpit (SMTP_HOST/SMTP_PORT y MAILPIT_UI_PORT).

const grande = (): Buffer => Buffer.concat([PDF, Buffer.alloc(MAX_BYTES + 1 - PDF.length, 0x20)]);

interface Subida {
  nombre: string;
  /** Rol que la usa; las rutas se guardan con la lógica de cada ruta sin tocar. */
  rol: 'adoptante' | 'fundacion' | 'publico';
  metodo: 'post' | 'patch';
  ruta: () => string;
  campo: string;
  /** Máximo de archivos que admite el campo. */
  maximo: number;
  /** Campos de texto que la ruta pide (no cambian el resultado del límite). */
  campos?: Record<string, string>;
}

describe('V15 — límites de subida en todos los endpoints con archivos', () => {
  let e: Entorno;
  let F: FundacionPrueba;
  let Ad: AdoptantePrueba;
  let admin: string;

  beforeAll(async () => {
    process.env.SEGUIMIENTOS_CRON_HABILITADO = 'false';
    e = await arrancarEntorno();
    admin = (await e.sesion(ADMIN.email, ADMIN.clave)).access;
    F = await fundacionAprobada(e, 'Montería', 'api', admin);
    Ad = await adoptanteConSesion(e);
  });
  afterAll(async () => {
    await e.cerrar();
  });

  const SUBIDAS: Subida[] = [
    {
      nombre: 'registro de fundación (documento)',
      rol: 'publico',
      metodo: 'post',
      ruta: () => '/auth/register/fundacion',
      campo: 'documento',
      maximo: 1,
      campos: { nombre: 'X', nit: '1', email: 'x@x.co' },
    },
    {
      nombre: 'foto de mascota',
      rol: 'fundacion',
      metodo: 'post',
      ruta: () => '/mascotas/1/fotos',
      campo: 'foto',
      maximo: 1,
    },
    {
      nombre: 'formulario de solicitud',
      rol: 'adoptante',
      metodo: 'post',
      ruta: () => '/solicitudes',
      campo: 'formulario',
      maximo: 1,
      campos: { mascotaId: '1' },
    },
    {
      nombre: 'acta de adopción',
      rol: 'fundacion',
      metodo: 'post',
      ruta: () => '/fundacion/adopciones/1/acta',
      campo: 'acta',
      maximo: 1,
    },
    {
      nombre: 'reporte de seguimiento (fotos)',
      rol: 'adoptante',
      metodo: 'post',
      ruta: () => '/seguimientos/1/reporte',
      campo: 'fotos',
      maximo: 5,
    },
    {
      nombre: 'resultado de seguimiento (evidencias)',
      rol: 'fundacion',
      metodo: 'patch',
      ruta: () => '/seguimientos/1/resultado',
      campo: 'evidencias',
      maximo: 5,
    },
    {
      nombre: 'donación (comprobante)',
      rol: 'adoptante',
      metodo: 'post',
      ruta: () => '/donaciones',
      campo: 'comprobante',
      maximo: 1,
      campos: { fundacionId: '1', tipo: 'economica', monto: '1000' },
    },
    {
      nombre: 'donación manual (comprobante)',
      rol: 'fundacion',
      metodo: 'post',
      ruta: () => '/fundacion/donaciones',
      campo: 'comprobante',
      maximo: 1,
      campos: { nombreDonante: 'Pedro', tipo: 'economica', monto: '1000' },
    },
  ];

  const archivosEnDisco = (): string[] => {
    const lista: string[] = [];
    const recorrer = (dir: string): void => {
      if (!existsSync(dir)) return;
      for (const nombre of readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, nombre.name);
        if (nombre.isDirectory()) recorrer(ruta);
        else lista.push(path.relative(e.uploads, ruta));
      }
    };
    recorrer(e.uploads);
    return lista.sort();
  };

  const peticion = (s: Subida): request.Test => {
    const base = s.metodo === 'post' ? e.post(s.ruta()) : e.patch(s.ruta());
    const token = s.rol === 'fundacion' ? F.access : s.rol === 'adoptante' ? Ad.access : null;
    const r = token ? con(base, token) : base;
    for (const [k, v] of Object.entries(s.campos ?? {})) r.field(k, v);
    return r;
  };

  it.each(SUBIDAS)(
    '$nombre: un archivo de MAX_BYTES + 1 es 413 y no queda nada en disco',
    async (s) => {
      const antes = archivosEnDisco();
      const res = await peticion(s).attach(s.campo, grande(), {
        filename: 'grande.pdf',
        contentType: 'application/pdf',
      });
      expect(res.status).toBe(413);
      expect(JSON.stringify(res.body)).toMatch(/5 ?MB|supera|tamaño|grande/i);
      expect(archivosEnDisco()).toEqual(antes);
    },
  );

  it.each(SUBIDAS)(
    '$nombre: un archivo de exactamente MAX_BYTES NO es rechazado por tamaño',
    async (s) => {
      const exacto = Buffer.concat([PDF, Buffer.alloc(MAX_BYTES - PDF.length, 0x20)]);
      const res = await peticion(s).attach(s.campo, exacto, {
        filename: 'exacto.pdf',
        contentType: 'application/pdf',
      });
      // Puede fallar por otra regla (mascota inexistente, tipo no admitido…), pero nunca por tamaño.
      expect(res.status).not.toBe(413);
    },
  );

  it.each(SUBIDAS)(
    '$nombre: más archivos que el máximo es 400 y no queda nada en disco',
    async (s) => {
      const antes = archivosEnDisco();
      const pequeno = await jpeg();
      const r = peticion(s);
      for (let i = 0; i <= s.maximo; i++) {
        r.attach(s.campo, pequeno, { filename: `f${i}.jpg`, contentType: 'image/jpeg' });
      }
      const res = await r;
      expect(res.status).toBe(400);
      expect(archivosEnDisco()).toEqual(antes);
    },
  );

  it.each(SUBIDAS)('$nombre: un archivo en un campo con otro nombre es 400', async (s) => {
    const res = await peticion(s).attach('otro-campo', await jpeg(), {
      filename: 'f.jpg',
      contentType: 'image/jpeg',
    });
    expect(res.status).toBe(400);
  });
});
