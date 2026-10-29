import * as bcrypt from 'bcryptjs';
import type { EntityManager } from 'typeorm';
import { COSTE_BCRYPT, type SeedConfig } from './seed.config';

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

/** Fundación aprobada con 4 mascotas y foto principal. Idempotente. Solo con `--demo`. */
export async function sembrarDemo(
  manager: EntityManager,
  config: SeedConfig,
  log: (mensaje: string) => void = () => undefined,
): Promise<void> {
  if (!config.demoPassword) {
    throw new Error('SEED_DEMO_PASSWORD es obligatoria con --demo');
  }
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
       'Fundación de ejemplo para la demostración.', '/uploads/demo/documento.pdf', 'aprobada', now())
     ON CONFLICT ("nit") DO NOTHING`,
    [usuarios[0].id, NIT_DEMO],
  );
  const [fundacion]: { id: number }[] = await manager.query(
    'SELECT "id" FROM "fundacion" WHERE "nit" = $1',
    [NIT_DEMO],
  );

  for (const m of MASCOTAS_DEMO) {
    const existe: unknown[] = await manager.query(
      'SELECT 1 FROM "mascota" WHERE "fundacion_id" = $1 AND "nombre" = $2',
      [fundacion.id, m.nombre],
    );
    if (existe.length > 0) continue;
    const [mascota]: { id: number }[] = await manager.query(
      `INSERT INTO "mascota" ("fundacion_id", "raza_id", "nombre", "sexo", "edad_meses", "tamano",
         "estado_salud", "descripcion", "estado")
       SELECT $1, r."id", $2, $3, $4, $5, 'Sano', $6, 'disponible'
       FROM "raza" r JOIN "especie" e ON e."id" = r."especie_id"
       WHERE e."nombre" = $7 AND r."nombre" = $8
       RETURNING "id"`,
      [fundacion.id, m.nombre, m.sexo, m.edadMeses, m.tamano, m.descripcion, m.especie, m.raza],
    );
    await manager.query(
      `INSERT INTO "foto_mascota" ("mascota_id", "url", "url_catalogo", "es_principal")
       VALUES ($1, $2, $2, true)`,
      [mascota.id, `/uploads/demo/${m.nombre.toLowerCase()}.jpg`],
    );
  }
  log('Datos demo listos (fundación «Patitas Felices» y 4 mascotas).');
}
