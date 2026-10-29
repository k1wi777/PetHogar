import type { MigrationInterface, QueryRunner } from 'typeorm';

const ID = 'integer GENERATED ALWAYS AS IDENTITY NOT NULL';
const AHORA = 'TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()';

// Tipos enumerados nativos: nombre del tipo -> valores (ERS §2.9 más estados de B-32).
const ENUMS: Record<string, string[]> = {
  fundacion_estado_validacion_enum: ['pendiente', 'aprobada', 'rechazada'],
  mascota_sexo_enum: ['macho', 'hembra'],
  mascota_tamano_enum: ['pequeño', 'mediano', 'grande'],
  mascota_estado_enum: ['disponible', 'en_proceso', 'adoptada', 'inactiva'],
  historial_medico_tipo_enum: ['vacuna', 'desparasitacion', 'cirugia', 'consulta'],
  solicitud_adopcion_estado_enum: ['pendiente', 'aprobada', 'rechazada', 'cancelada'],
  adopcion_estado_enum: ['activa', 'finalizada', 'revocada'],
  seguimiento_tipo_enum: ['visita', 'reporte'],
  seguimiento_estado_enum: ['programado', 'realizado', 'vencido', 'cancelado'],
  seguimiento_estado_bienestar_enum: ['bueno', 'regular', 'malo'],
  donacion_tipo_enum: ['economica', 'especie'],
};

// Orden de dependencia: cada tabla solo referencia a las anteriores.
const TABLAS: string[] = [
  `CREATE TABLE "rol" ("id" ${ID}, "nombre" character varying(20) NOT NULL,
    CONSTRAINT "pk_rol" PRIMARY KEY ("id"), CONSTRAINT "uq_rol_nombre" UNIQUE ("nombre"))`,
  `CREATE TABLE "usuario" ("id" ${ID}, "rol_id" integer NOT NULL,
    "email" character varying(100) NOT NULL, "contrasena" character varying(200) NOT NULL,
    "telefono" character varying(15) NOT NULL, "activo" boolean NOT NULL DEFAULT true,
    "fecha_creacion" ${AHORA}, "email_verificado" boolean NOT NULL DEFAULT false,
    "token_verificacion_hash" character varying(64), "token_verificacion_expira" TIMESTAMP WITH TIME ZONE,
    "intentos_fallidos" integer NOT NULL DEFAULT '0', "bloqueado_hasta" TIMESTAMP WITH TIME ZONE,
    "reset_code_hash" character varying(64), "reset_code_expira" TIMESTAMP WITH TIME ZONE,
    "reset_code_intentos" integer NOT NULL DEFAULT '0',
    "acepta_politica_datos" boolean NOT NULL DEFAULT false, "fecha_aceptacion" TIMESTAMP WITH TIME ZONE,
    CONSTRAINT "pk_usuario" PRIMARY KEY ("id"), CONSTRAINT "uq_usuario_email" UNIQUE ("email"),
    CONSTRAINT "fk_usuario_rol" FOREIGN KEY ("rol_id") REFERENCES "rol"("id"))`,
  `CREATE TABLE "adoptante" ("id" ${ID}, "usuario_id" integer NOT NULL,
    "primer_nombre" character varying(40) NOT NULL, "segundo_nombre" character varying(40),
    "primer_apellido" character varying(40) NOT NULL, "segundo_apellido" character varying(40),
    "tipo_documento" character varying(5) NOT NULL, "numero_documento" character varying(20) NOT NULL,
    "fecha_nacimiento" date NOT NULL, "direccion" character varying(150) NOT NULL,
    "ciudad" character varying(60) NOT NULL,
    CONSTRAINT "pk_adoptante" PRIMARY KEY ("id"), CONSTRAINT "uq_adoptante_usuario" UNIQUE ("usuario_id"),
    CONSTRAINT "uq_adoptante_numero_documento" UNIQUE ("numero_documento"),
    CONSTRAINT "ck_adoptante_tipo_documento" CHECK ("tipo_documento" IN ('CC', 'CE', 'PA')),
    CONSTRAINT "fk_adoptante_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id"))`,
  `CREATE TABLE "refresh_token" ("id" ${ID}, "usuario_id" integer NOT NULL,
    "token_hash" character varying(64) NOT NULL, "expira_en" TIMESTAMP WITH TIME ZONE NOT NULL,
    "revocado" boolean NOT NULL DEFAULT false, "fecha_creacion" ${AHORA},
    CONSTRAINT "pk_refresh_token" PRIMARY KEY ("id"), CONSTRAINT "uq_refresh_token_hash" UNIQUE ("token_hash"),
    CONSTRAINT "fk_refresh_token_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id"))`,
  `CREATE TABLE "fundacion" ("id" ${ID}, "usuario_id" integer NOT NULL,
    "nombre" character varying(120) NOT NULL, "nit" character varying(20) NOT NULL,
    "direccion" character varying(150) NOT NULL, "ciudad" character varying(60) NOT NULL,
    "descripcion" character varying(500), "logo" character varying(255),
    "documento_url" character varying(255) NOT NULL,
    "estado_validacion" "public"."fundacion_estado_validacion_enum" NOT NULL DEFAULT 'pendiente',
    "observacion_validacion" character varying(300), "fecha_validacion" TIMESTAMP WITH TIME ZONE,
    CONSTRAINT "pk_fundacion" PRIMARY KEY ("id"), CONSTRAINT "uq_fundacion_usuario" UNIQUE ("usuario_id"),
    CONSTRAINT "uq_fundacion_nit" UNIQUE ("nit"),
    CONSTRAINT "fk_fundacion_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id"))`,
  `CREATE TABLE "especie" ("id" ${ID}, "nombre" character varying(40) NOT NULL,
    CONSTRAINT "pk_especie" PRIMARY KEY ("id"), CONSTRAINT "uq_especie_nombre" UNIQUE ("nombre"))`,
  `CREATE TABLE "raza" ("id" ${ID}, "especie_id" integer NOT NULL, "nombre" character varying(60) NOT NULL,
    CONSTRAINT "pk_raza" PRIMARY KEY ("id"), CONSTRAINT "uq_raza_especie_nombre" UNIQUE ("especie_id", "nombre"),
    CONSTRAINT "fk_raza_especie" FOREIGN KEY ("especie_id") REFERENCES "especie"("id"))`,
  `CREATE TABLE "mascota" ("id" ${ID}, "fundacion_id" integer NOT NULL, "raza_id" integer NOT NULL,
    "nombre" character varying(60) NOT NULL, "sexo" "public"."mascota_sexo_enum" NOT NULL,
    "edad_meses" integer NOT NULL, "tamano" "public"."mascota_tamano_enum" NOT NULL,
    "color" character varying(40), "esterilizado" boolean NOT NULL DEFAULT false,
    "vacunado" boolean NOT NULL DEFAULT false, "estado_salud" character varying(200) NOT NULL,
    "descripcion" character varying(500),
    "estado" "public"."mascota_estado_enum" NOT NULL DEFAULT 'disponible', "fecha_publicacion" ${AHORA},
    CONSTRAINT "pk_mascota" PRIMARY KEY ("id"),
    CONSTRAINT "ck_mascota_edad_meses" CHECK ("edad_meses" >= 0),
    CONSTRAINT "fk_mascota_fundacion" FOREIGN KEY ("fundacion_id") REFERENCES "fundacion"("id"),
    CONSTRAINT "fk_mascota_raza" FOREIGN KEY ("raza_id") REFERENCES "raza"("id"))`,
  `CREATE TABLE "foto_mascota" ("id" ${ID}, "mascota_id" integer NOT NULL,
    "url" character varying(255) NOT NULL, "es_principal" boolean NOT NULL DEFAULT false,
    CONSTRAINT "pk_foto_mascota" PRIMARY KEY ("id"),
    CONSTRAINT "fk_foto_mascota_mascota" FOREIGN KEY ("mascota_id") REFERENCES "mascota"("id") ON DELETE CASCADE)`,
  `CREATE TABLE "historial_medico" ("id" ${ID}, "mascota_id" integer NOT NULL,
    "tipo" "public"."historial_medico_tipo_enum" NOT NULL, "fecha" date NOT NULL,
    "descripcion" character varying(300) NOT NULL, "veterinario" character varying(100),
    CONSTRAINT "pk_historial_medico" PRIMARY KEY ("id"),
    CONSTRAINT "fk_historial_medico_mascota" FOREIGN KEY ("mascota_id") REFERENCES "mascota"("id"))`,
  `CREATE TABLE "solicitud_adopcion" ("id" ${ID}, "adoptante_id" integer NOT NULL, "mascota_id" integer NOT NULL,
    "fecha_solicitud" ${AHORA}, "motivo" character varying(500) NOT NULL,
    "tipo_vivienda" character varying(30) NOT NULL, "tiene_otras_mascotas" boolean NOT NULL,
    "formulario_url" character varying(255) NOT NULL,
    "estado" "public"."solicitud_adopcion_estado_enum" NOT NULL DEFAULT 'pendiente',
    "observacion" character varying(300), "fecha_respuesta" TIMESTAMP WITH TIME ZONE,
    CONSTRAINT "pk_solicitud_adopcion" PRIMARY KEY ("id"),
    CONSTRAINT "fk_solicitud_adopcion_adoptante" FOREIGN KEY ("adoptante_id") REFERENCES "adoptante"("id"),
    CONSTRAINT "fk_solicitud_adopcion_mascota" FOREIGN KEY ("mascota_id") REFERENCES "mascota"("id"))`,
  `CREATE TABLE "adopcion" ("id" ${ID}, "solicitud_id" integer NOT NULL, "fecha_entrega" date NOT NULL,
    "acta_url" character varying(255),
    "estado" "public"."adopcion_estado_enum" NOT NULL DEFAULT 'activa',
    "motivo_cierre" character varying(300), "fecha_cierre" TIMESTAMP WITH TIME ZONE,
    CONSTRAINT "pk_adopcion" PRIMARY KEY ("id"), CONSTRAINT "uq_adopcion_solicitud" UNIQUE ("solicitud_id"),
    CONSTRAINT "fk_adopcion_solicitud" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud_adopcion"("id"))`,
  `CREATE TABLE "seguimiento" ("id" ${ID}, "adopcion_id" integer NOT NULL,
    "tipo" "public"."seguimiento_tipo_enum" NOT NULL, "fecha_programada" date NOT NULL,
    "fecha_realizada" date,
    "estado" "public"."seguimiento_estado_enum" NOT NULL DEFAULT 'programado',
    "estado_bienestar" "public"."seguimiento_estado_bienestar_enum",
    "observaciones" character varying(500), "reporte_adoptante" character varying(500),
    CONSTRAINT "pk_seguimiento" PRIMARY KEY ("id"),
    CONSTRAINT "fk_seguimiento_adopcion" FOREIGN KEY ("adopcion_id") REFERENCES "adopcion"("id"))`,
  `CREATE TABLE "seguimiento_evidencia" ("id" ${ID}, "seguimiento_id" integer NOT NULL,
    "url" character varying(255) NOT NULL,
    CONSTRAINT "pk_seguimiento_evidencia" PRIMARY KEY ("id"),
    CONSTRAINT "fk_seguimiento_evidencia_seguimiento" FOREIGN KEY ("seguimiento_id") REFERENCES "seguimiento"("id"))`,
  `CREATE TABLE "donacion" ("id" ${ID}, "fundacion_id" integer NOT NULL, "usuario_id" integer,
    "nombre_donante" character varying(100), "tipo" "public"."donacion_tipo_enum" NOT NULL,
    "monto" numeric(12,2), "descripcion_especie" character varying(300),
    "comprobante_url" character varying(255), "fecha" ${AHORA},
    CONSTRAINT "pk_donacion" PRIMARY KEY ("id"),
    CONSTRAINT "ck_donacion_monto" CHECK ("monto" IS NULL OR "monto" >= 0),
    CONSTRAINT "fk_donacion_fundacion" FOREIGN KEY ("fundacion_id") REFERENCES "fundacion"("id"),
    CONSTRAINT "fk_donacion_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id"))`,
  `CREATE TABLE "notificacion" ("id" ${ID}, "usuario_id" integer NOT NULL,
    "tipo" character varying(30) NOT NULL, "titulo" character varying(100) NOT NULL,
    "mensaje" character varying(300) NOT NULL, "leida" boolean NOT NULL DEFAULT false,
    "fecha_creacion" ${AHORA},
    CONSTRAINT "pk_notificacion" PRIMARY KEY ("id"),
    CONSTRAINT "fk_notificacion_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id"))`,
];

const INDICES: string[] = [
  `CREATE INDEX "idx_refresh_token_usuario" ON "refresh_token" ("usuario_id")`,
  `CREATE INDEX "idx_fundacion_ciudad" ON "fundacion" ("ciudad")`,
  `CREATE INDEX "idx_mascota_estado" ON "mascota" ("estado")`,
  `CREATE INDEX "idx_mascota_fundacion" ON "mascota" ("fundacion_id")`,
  `CREATE INDEX "idx_mascota_raza" ON "mascota" ("raza_id")`,
  `CREATE UNIQUE INDEX "uq_foto_principal" ON "foto_mascota" ("mascota_id") WHERE "es_principal" = true`,
  `CREATE INDEX "idx_solicitud_adopcion_mascota" ON "solicitud_adopcion" ("mascota_id")`,
  `CREATE UNIQUE INDEX "uq_solicitud_pendiente" ON "solicitud_adopcion" ("adoptante_id", "mascota_id") WHERE "estado" = 'pendiente'`,
  `CREATE INDEX "idx_seguimiento_adopcion_estado" ON "seguimiento" ("adopcion_id", "estado")`,
  `CREATE INDEX "idx_notificacion_usuario_leida" ON "notificacion" ("usuario_id", "leida")`,
];

const NOMBRES_TABLAS = [
  'notificacion',
  'donacion',
  'seguimiento_evidencia',
  'seguimiento',
  'adopcion',
  'solicitud_adopcion',
  'historial_medico',
  'foto_mascota',
  'mascota',
  'raza',
  'especie',
  'fundacion',
  'refresh_token',
  'adoptante',
  'usuario',
  'rol',
];

export class EsquemaInicial1761700000000 implements MigrationInterface {
  name = 'EsquemaInicial1761700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tipo, valores] of Object.entries(ENUMS)) {
      const lista = valores.map((v) => `'${v}'`).join(', ');
      await queryRunner.query(`CREATE TYPE "public"."${tipo}" AS ENUM(${lista})`);
    }
    for (const sql of TABLAS) await queryRunner.query(sql);
    for (const sql of INDICES) await queryRunner.query(sql);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of NOMBRES_TABLAS) await queryRunner.query(`DROP TABLE "${tabla}"`);
    for (const tipo of Object.keys(ENUMS)) await queryRunner.query(`DROP TYPE "public"."${tipo}"`);
  }
}
