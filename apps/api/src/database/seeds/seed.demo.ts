import * as bcrypt from 'bcryptjs';
import type { EntityManager } from 'typeorm';
import {
  alertaBienestarFundacion,
  donacionRecibida,
  donacionRegistrada,
  reporteRecibido,
  seguimientoVencidoAdoptante,
  seguimientoVencidoFundacion,
  solicitudAprobada,
  solicitudRechazada,
  solicitudRecibida,
  type Aviso,
} from '../../modules/avisos/textos-aviso';
import {
  claveActa,
  claveComprobante,
  claveDocumentoFundacion,
  claveFoto,
  claveFormulario,
  crearEscritorDisco,
  fotosDemo,
  pdfDemo,
  type ArchivosDemo,
} from './archivos-demo';
import { COSTE_BCRYPT, type SeedConfig } from './seed.config';
import {
  ADOPCIONES_DEMO,
  ADOPTANTE_DEMO,
  ADOPTANTE_DEMO_EMAIL,
  DONACIONES_DEMO,
  hace,
  MASCOTAS_ADOPTADAS_DEMO,
  SEGUIMIENTOS_DEMO,
  SOLICITUDES_DEMO,
  type Desfase,
} from './seed.demo.data';

export const DEMO_EMAIL = 'fundacion.demo@pethogar.local';
const NIT_DEMO = '900000000-1';

interface MascotaDemo {
  nombre: string;
  especie: string;
  raza: string;
  sexo: 'macho' | 'hembra';
  edadMeses: number;
  tamano: 'pequeño' | 'mediano' | 'grande';
  descripcion: string;
  /** Por defecto `disponible`. */
  estado?: 'disponible' | 'adoptada';
}

export const MASCOTAS_DEMO: MascotaDemo[] = [
  {
    nombre: 'Firulais',
    especie: 'perro',
    raza: 'Mestizo',
    sexo: 'macho',
    edadMeses: 24,
    tamano: 'mediano',
    descripcion: 'Juguetón y cariñoso.',
  },
  {
    nombre: 'Luna',
    especie: 'perro',
    raza: 'Labrador',
    sexo: 'hembra',
    edadMeses: 12,
    tamano: 'grande',
    descripcion: 'Tranquila y sociable.',
  },
  {
    nombre: 'Michi',
    especie: 'gato',
    raza: 'Mestizo',
    sexo: 'macho',
    edadMeses: 8,
    tamano: 'pequeño',
    descripcion: 'Curioso y activo.',
  },
  {
    nombre: 'Nieve',
    especie: 'gato',
    raza: 'Angora',
    sexo: 'hembra',
    edadMeses: 36,
    tamano: 'pequeño',
    descripcion: 'Dócil y muy limpia.',
  },
];

/** Todas las mascotas del demo, disponibles y adoptadas. */
const todasLasMascotas = (): MascotaDemo[] => [
  ...MASCOTAS_DEMO,
  ...MASCOTAS_ADOPTADAS_DEMO.map((m) => ({ ...m, estado: 'adoptada' as const })),
];

const comprobantesDemo = () =>
  DONACIONES_DEMO.flatMap((d, i) => (d.tipo === 'economica' ? [{ d, numero: i + 1 }] : []));

/**
 * Deja en el almacenamiento todos los archivos que referencian las filas del demo (fotos de las
 * mascotas y PDF). Se ejecuta siempre: los nombres son deterministas y el escritor no pisa lo existente.
 */
async function asegurarArchivos(archivos: ArchivosDemo): Promise<void> {
  for (const m of todasLasMascotas()) {
    const { grande, catalogo } = await fotosDemo(m.nombre);
    await archivos.escribir(claveFoto(m.nombre, 'grande'), grande);
    await archivos.escribir(claveFoto(m.nombre, 'catalogo'), catalogo);
  }
  await archivos.escribir(
    claveDocumentoFundacion(),
    await pdfDemo('Documento de la fundación', ['Fundación: Patitas Felices', `NIT: ${NIT_DEMO}`]),
  );
  for (const s of SOLICITUDES_DEMO) {
    await archivos.escribir(
      claveFormulario(s.clave),
      await pdfDemo('Formulario de adopción', [`Mascota: ${s.mascota}`, `Solicitud: ${s.clave}`]),
    );
  }
  for (const ad of ADOPCIONES_DEMO) {
    const mascota = SOLICITUDES_DEMO.find((s) => s.clave === ad.solicitud)?.mascota;
    await archivos.escribir(
      claveActa(ad.solicitud),
      await pdfDemo('Acta de entrega', [`Mascota: ${mascota}`, `Solicitud: ${ad.solicitud}`]),
    );
  }
  for (const { d, numero } of comprobantesDemo()) {
    await archivos.escribir(
      claveComprobante(numero),
      await pdfDemo('Comprobante de donación', [`Donación n.º ${numero}`, `Monto: ${d.monto}`]),
    );
  }
}

/**
 * Las bases sembradas antes de guardar archivos reales tienen rutas `/uploads/demo/…` que no existen.
 * Cada UPDATE se acota por igualdad exacta con la ruta vieja (exclusiva del seed) y es idempotente.
 */
async function repararRutasHeredadas(manager: EntityManager): Promise<void> {
  const demo = (nombre: string) => `/uploads/demo/${nombre}`;
  for (const m of todasLasMascotas()) {
    await manager.query(
      'UPDATE "foto_mascota" SET "url" = $2, "url_catalogo" = $3 WHERE "url" = $1',
      [
        demo(`${m.nombre.toLowerCase()}.jpg`),
        claveFoto(m.nombre, 'grande'),
        claveFoto(m.nombre, 'catalogo'),
      ],
    );
  }
  const actualizar = (tabla: string, columna: string, vieja: string, nueva: string) =>
    manager.query(`UPDATE "${tabla}" SET "${columna}" = $2 WHERE "${columna}" = $1`, [
      vieja,
      nueva,
    ]);
  await actualizar('fundacion', 'documento_url', demo('documento.pdf'), claveDocumentoFundacion());
  for (const s of SOLICITUDES_DEMO) {
    await actualizar(
      'solicitud_adopcion',
      'formulario_url',
      demo(`formulario-${s.clave}.pdf`),
      claveFormulario(s.clave),
    );
  }
  for (const ad of ADOPCIONES_DEMO) {
    await actualizar(
      'adopcion',
      'acta_url',
      demo(`acta-${ad.solicitud}.pdf`),
      claveActa(ad.solicitud),
    );
  }
  for (const { numero } of comprobantesDemo()) {
    await actualizar(
      'donacion',
      'comprobante_url',
      demo(`comprobante-${numero}.pdf`),
      claveComprobante(numero),
    );
  }
}

/**
 * Fundación aprobada con 7 mascotas, su foto principal y su actividad. Idempotente. Solo con `--demo`.
 * Escribe fotos y PDF reales en `archivos` (por defecto `UPLOADS_DIR`).
 */
export async function sembrarDemo(
  manager: EntityManager,
  config: SeedConfig,
  log: (mensaje: string) => void = () => undefined,
  archivos: ArchivosDemo = crearEscritorDisco(process.env.UPLOADS_DIR ?? './uploads'),
): Promise<void> {
  if (!config.demoPassword) {
    throw new Error('SEED_DEMO_PASSWORD es obligatoria con --demo');
  }
  await asegurarArchivos(archivos);
  let usuarios: { id: number }[] = await manager.query(
    'SELECT "id" FROM "usuario" WHERE "email" = $1',
    [DEMO_EMAIL],
  );
  if (usuarios.length === 0) {
    const hash = await bcrypt.hash(config.demoPassword, COSTE_BCRYPT);
    usuarios = await manager.query(
      `INSERT INTO "usuario" ("rol_id", "email", "contrasena", "telefono", "activo",
         "email_verificado", "acepta_politica_datos", "fecha_aceptacion")
       SELECT "id", $1, $2, '3001112233', true, true, true, now() FROM "rol" WHERE "nombre" = 'fundacion'
       RETURNING "id"`,
      [DEMO_EMAIL, hash],
    );
  }
  await manager.query(
    `INSERT INTO "fundacion" ("usuario_id", "nombre", "nit", "direccion", "ciudad", "descripcion",
       "documento_url", "estado_validacion", "fecha_validacion")
     VALUES ($1, 'Patitas Felices', $2, 'Calle 1 # 2-3', 'Bogotá',
       'Fundación de ejemplo para la demostración.', $3, 'aprobada', now())
     ON CONFLICT ("nit") DO NOTHING`,
    [usuarios[0].id, NIT_DEMO, claveDocumentoFundacion()],
  );
  const [fundacion]: { id: number }[] = await manager.query(
    'SELECT "id" FROM "fundacion" WHERE "nit" = $1',
    [NIT_DEMO],
  );

  for (const m of todasLasMascotas()) {
    const existe: unknown[] = await manager.query(
      'SELECT 1 FROM "mascota" WHERE "fundacion_id" = $1 AND "nombre" = $2',
      [fundacion.id, m.nombre],
    );
    if (existe.length > 0) continue;
    const [mascota]: { id: number }[] = await manager.query(
      `INSERT INTO "mascota" ("fundacion_id", "raza_id", "nombre", "sexo", "edad_meses", "tamano",
         "estado_salud", "descripcion", "estado")
       SELECT $1, r."id", $2, $3, $4, $5, 'Sano', $6, $9
       FROM "raza" r JOIN "especie" e ON e."id" = r."especie_id"
       WHERE e."nombre" = $7 AND r."nombre" = $8
       RETURNING "id"`,
      [
        fundacion.id,
        m.nombre,
        m.sexo,
        m.edadMeses,
        m.tamano,
        m.descripcion,
        m.especie,
        m.raza,
        m.estado ?? 'disponible',
      ],
    );
    await manager.query(
      `INSERT INTO "foto_mascota" ("mascota_id", "url", "url_catalogo", "es_principal")
       VALUES ($1, $2, $3, true)`,
      [mascota.id, claveFoto(m.nombre, 'grande'), claveFoto(m.nombre, 'catalogo')],
    );
  }
  await sembrarActividad(manager, config.demoPassword, usuarios[0].id, fundacion.id);
  await repararRutasHeredadas(manager);
  log('Datos demo listos (fundación «Patitas Felices», 7 mascotas con foto, PDF y su actividad).');
}

interface Instante {
  ts: Date;
  dia: string;
}

/** Resuelve un desfase con el reloj de la base (`now()` es constante dentro de la transacción). */
async function instante(manager: EntityManager, d: Desfase): Promise<Instante> {
  const [fila]: { ts: Date; dia: string }[] = await manager.query(
    `SELECT ts, to_char((ts AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD') AS "dia"
     FROM (SELECT now() - make_interval(months => $1, days => $2) AS ts) t`,
    [d.meses, d.dias],
  );
  return fila;
}

const insertar = async (manager: EntityManager, sql: string, parametros: unknown[]) => {
  const [fila]: { id: number }[] = await manager.query(sql, parametros);
  return fila.id;
};

/**
 * Adoptante, solicitudes (los cuatro estados), adopciones, seguimientos, donaciones y avisos de la
 * fundación demo. Se omite si el adoptante demo ya tiene solicitudes: el seed corre en una sola
 * transacción, así que o queda completo o no queda. Inserta por SQL solo estados alcanzables
 * (solicitud aprobada ⇒ adopción + mascota adoptada; seguimiento cancelado ⇒ adopción cerrada).
 */
async function sembrarActividad(
  manager: EntityManager,
  contrasena: string,
  fundacionUsuarioId: number,
  fundacionId: number,
): Promise<void> {
  const yaSembrado: unknown[] = await manager.query(
    `SELECT 1 FROM "solicitud_adopcion" s
       JOIN "adoptante" a ON a."id" = s."adoptante_id"
       JOIN "usuario" u ON u."id" = a."usuario_id"
      WHERE u."email" = $1`,
    [ADOPTANTE_DEMO_EMAIL],
  );
  if (yaSembrado.length > 0) return;

  let [adoptanteUsuario]: { id: number }[] = await manager.query(
    'SELECT "id" FROM "usuario" WHERE "email" = $1',
    [ADOPTANTE_DEMO_EMAIL],
  );
  if (!adoptanteUsuario) {
    const hash = await bcrypt.hash(contrasena, COSTE_BCRYPT);
    [adoptanteUsuario] = await manager.query(
      `INSERT INTO "usuario" ("rol_id", "email", "contrasena", "telefono", "activo",
         "email_verificado", "acepta_politica_datos", "fecha_aceptacion")
       SELECT "id", $1, $2, '3009998877', true, true, true, now() FROM "rol" WHERE "nombre" = 'adoptante'
       RETURNING "id"`,
      [ADOPTANTE_DEMO_EMAIL, hash],
    );
  }
  const a = ADOPTANTE_DEMO;
  const adoptanteId = await insertar(
    manager,
    `INSERT INTO "adoptante" ("usuario_id", "primer_nombre", "primer_apellido", "tipo_documento",
       "numero_documento", "fecha_nacimiento", "direccion", "ciudad")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT ("usuario_id") DO UPDATE SET "usuario_id" = EXCLUDED."usuario_id"
     RETURNING "id"`,
    [
      adoptanteUsuario.id,
      a.primerNombre,
      a.primerApellido,
      a.tipoDocumento,
      a.numeroDocumento,
      a.fechaNacimiento,
      a.direccion,
      a.ciudad,
    ],
  );
  const mascotas: { id: number; nombre: string }[] = await manager.query(
    'SELECT "id", "nombre" FROM "mascota" WHERE "fundacion_id" = $1',
    [fundacionId],
  );
  const mascotaId = (nombre: string): number => {
    const m = mascotas.find((x) => x.nombre === nombre);
    if (!m) throw new Error(`Falta la mascota demo ${nombre}`);
    return m.id;
  };

  const solicitudes = new Map<string, number>();
  for (const s of SOLICITUDES_DEMO) {
    const fecha = await instante(manager, s.solicitud);
    const respuesta = s.respuesta ? await instante(manager, s.respuesta) : null;
    solicitudes.set(
      s.clave,
      await insertar(
        manager,
        `INSERT INTO "solicitud_adopcion" ("adoptante_id", "mascota_id", "fecha_solicitud", "motivo",
           "tipo_vivienda", "tiene_otras_mascotas", "formulario_url", "estado", "observacion",
           "fecha_respuesta")
         VALUES ($1, $2, $3, 'Quiero darle un hogar lleno de cariño.', 'casa', false, $4, $5, $6, $7)
         RETURNING "id"`,
        [
          adoptanteId,
          mascotaId(s.mascota),
          fecha.ts,
          claveFormulario(s.clave),
          s.estado,
          s.observacion ?? null,
          respuesta?.ts ?? null,
        ],
      ),
    );
  }

  const adopciones = new Map<string, number>();
  for (const ad of ADOPCIONES_DEMO) {
    const entrega = await instante(manager, ad.entrega);
    const cierre = ad.cierre ? await instante(manager, ad.cierre) : null;
    adopciones.set(
      ad.solicitud,
      await insertar(
        manager,
        `INSERT INTO "adopcion" ("solicitud_id", "fecha_entrega", "acta_url", "estado", "motivo_cierre",
           "fecha_cierre")
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING "id"`,
        [
          solicitudes.get(ad.solicitud),
          entrega.dia,
          claveActa(ad.solicitud),
          ad.estado,
          ad.motivoCierre ?? null,
          cierre?.ts ?? null,
        ],
      ),
    );
  }

  const seguimientos: number[] = [];
  for (const sg of SEGUIMIENTOS_DEMO) {
    const fecha = await instante(manager, sg.fecha);
    const realizado = sg.estado === 'realizado';
    seguimientos.push(
      await insertar(
        manager,
        `INSERT INTO "seguimiento" ("adopcion_id", "tipo", "fecha_programada", "fecha_realizada",
           "estado", "estado_bienestar", "observaciones", "reporte_adoptante", "reporte_enviado_en")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING "id"`,
        [
          adopciones.get(sg.adopcion),
          sg.tipo,
          fecha.dia,
          realizado ? fecha.dia : null,
          sg.estado,
          sg.bienestar ?? null,
          sg.observaciones ?? null,
          sg.reporte ?? null,
          sg.reporte ? fecha.ts : null,
        ],
      ),
    );
  }

  const donaciones: number[] = [];
  for (const d of DONACIONES_DEMO) {
    const fecha = await instante(manager, d.fecha);
    donaciones.push(
      await insertar(
        manager,
        `INSERT INTO "donacion" ("fundacion_id", "usuario_id", "nombre_donante", "tipo", "monto",
           "descripcion_especie", "comprobante_url", "fecha")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING "id"`,
        [
          fundacionId,
          d.delAdoptante ? adoptanteUsuario.id : null,
          d.delAdoptante ? null : (d.nombreDonante ?? null),
          d.tipo,
          d.monto ?? null,
          d.descripcionEspecie ?? null,
          d.tipo === 'economica' ? claveComprobante(donaciones.length + 1) : null,
          fecha.ts,
        ],
      ),
    );
  }

  const avisos = avisosDemo({
    solicitudes,
    seguimientos,
    donaciones,
    fundacionUsuarioId,
    adoptanteUsuarioId: adoptanteUsuario.id,
  });
  for (const { usuarioId, aviso, leida, creada } of avisos) {
    const fecha = await instante(manager, creada);
    await manager.query(
      `INSERT INTO "notificacion" ("usuario_id", "tipo", "titulo", "mensaje", "leida", "fecha_creacion",
         "entidad", "entidad_id", "clave")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ("usuario_id", "clave") WHERE "clave" IS NOT NULL DO NOTHING`,
      [
        usuarioId,
        aviso.tipo,
        aviso.titulo,
        aviso.mensaje,
        leida,
        fecha.ts,
        aviso.referencia.tipo,
        aviso.referencia.id,
        aviso.clave,
      ],
    );
  }
}

interface AvisoDemo {
  usuarioId: number;
  aviso: Aviso;
  leida: boolean;
  creada: Desfase;
}

/** Avisos coherentes con lo sembrado, con los textos reales de la aplicación. */
function avisosDemo(ids: {
  solicitudes: Map<string, number>;
  seguimientos: number[];
  donaciones: number[];
  fundacionUsuarioId: number;
  adoptanteUsuarioId: number;
}): AvisoDemo[] {
  const sol = (clave: string): number => ids.solicitudes.get(clave) as number;
  const seg = (adopcion: string, tipo: string, estado: string): number =>
    ids.seguimientos[
      SEGUIMIENTOS_DEMO.findIndex(
        (s) => s.adopcion === adopcion && s.tipo === tipo && s.estado === estado,
      )
    ];
  const segBienestar = (bienestar: string): number =>
    ids.seguimientos[SEGUIMIENTOS_DEMO.findIndex((s) => s.bienestar === bienestar)];
  const f = ids.fundacionUsuarioId;
  const ad = ids.adoptanteUsuarioId;
  const donacionEconomica = (indice: number) => ({
    donacionId: ids.donaciones[indice],
    tipo: DONACIONES_DEMO[indice].tipo,
    monto: DONACIONES_DEMO[indice].monto ?? null,
  });
  return [
    {
      usuarioId: f,
      aviso: solicitudRecibida({ solicitudId: sol('firulais'), mascota: 'Firulais' }),
      leida: false,
      creada: hace(0, 5),
    },
    {
      usuarioId: f,
      aviso: solicitudRecibida({ solicitudId: sol('luna'), mascota: 'Luna' }),
      leida: false,
      creada: hace(0, 2),
    },
    {
      usuarioId: f,
      aviso: solicitudRecibida({ solicitudId: sol('pelusa'), mascota: 'Pelusa' }),
      leida: true,
      creada: hace(2),
    },
    {
      usuarioId: f,
      aviso: reporteRecibido({
        seguimientoId: seg('rocky', 'reporte', 'realizado'),
        mascota: 'Rocky',
      }),
      leida: true,
      creada: hace(2),
    },
    {
      usuarioId: f,
      aviso: alertaBienestarFundacion({
        seguimientoId: segBienestar('malo'),
        mascota: 'Rocky',
      }),
      leida: false,
      creada: hace(1),
    },
    {
      usuarioId: f,
      aviso: seguimientoVencidoFundacion({
        seguimientoId: seg('rocky', 'visita', 'vencido'),
        mascota: 'Rocky',
      }),
      leida: false,
      creada: hace(0, 10),
    },
    {
      usuarioId: f,
      aviso: donacionRecibida(donacionEconomica(2)),
      leida: true,
      creada: hace(3, 5),
    },
    {
      usuarioId: f,
      aviso: donacionRecibida(donacionEconomica(7)),
      leida: false,
      creada: hace(0, 1),
    },
    {
      usuarioId: ad,
      aviso: solicitudAprobada({ solicitudId: sol('rocky'), mascota: 'Rocky' }),
      leida: true,
      creada: hace(4, -2),
    },
    {
      usuarioId: ad,
      aviso: solicitudAprobada({ solicitudId: sol('pelusa'), mascota: 'Pelusa' }),
      leida: true,
      creada: hace(2, -2),
    },
    {
      usuarioId: ad,
      aviso: solicitudRechazada({
        solicitudId: sol('michi-rechazada'),
        mascota: 'Michi',
        observacion: 'Michi necesita un hogar sin otros gatos.',
        automatica: false,
      }),
      leida: true,
      creada: hace(3, -3),
    },
    {
      usuarioId: ad,
      aviso: seguimientoVencidoAdoptante({
        seguimientoId: seg('pelusa', 'reporte', 'vencido'),
        mascota: 'Pelusa',
      }),
      leida: false,
      creada: hace(0, 3),
    },
    {
      usuarioId: ad,
      aviso: donacionRegistrada({
        ...donacionEconomica(3),
        fundacion: 'Patitas Felices',
      }),
      leida: true,
      creada: hace(2, 12),
    },
    {
      usuarioId: ad,
      aviso: donacionRegistrada({
        ...donacionEconomica(4),
        fundacion: 'Patitas Felices',
      }),
      leida: false,
      creada: hace(2, 3),
    },
  ];
}
