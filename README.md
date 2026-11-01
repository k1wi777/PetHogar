# PetHogar

**Plataforma web de adopción y seguimiento de mascotas en fundaciones y refugios.**

Centraliza en un solo lugar lo que hoy se reparte entre redes sociales, WhatsApp, papel y hojas de cálculo: publicación de mascotas con su historial médico, solicitudes de adopción, seguimiento posterior a la entrega con alertas, registro de donaciones (sin pasarela de pago) y reportes en PDF y gráficas. Tiene tres perfiles: adoptantes, fundaciones y administrador de la plataforma.

Proyecto académico — Universidad de Córdoba, Facultad de Ingeniería (Montería, 2026).

> **Estado:** API y web funcionales de punta a punta en local. No incluye despliegue a producción.

## Estructura del monorepo

Monorepo con **pnpm workspaces**; los comandos de la raíz delegan en cada paquete.

```
apps/api/         API REST en NestJS (puerto 3001; Swagger en /api/docs)
apps/web/         Web en Next.js, App Router (puerto 3000)
packages/shared/  Tipos compartidos (opcional; hoy vacío)
docs/             Operación: HTTPS, respaldos, riesgos aceptados y datos de demostración
scripts/          Respaldo y restauración de la base y de los archivos
docker-compose.yml  PostgreSQL 16 + Mailpit para desarrollo local
```

| Paquete | Qué contiene |
|---------|--------------|
| `apps/api` | Un módulo por dominio en `src/modules/`, más `database/` (migraciones y seeds). |
| `apps/web` | Estructura por funcionalidades (`features/`), rutas en `app/` y utilidades comunes en `shared/`. |

`apps/web` nunca importa código de `apps/api`: se comunican solo por la API REST.

## Requisitos

- **Node.js 24 o superior** y **pnpm 11** (`corepack enable` lo activa).
- **Docker** con Docker Compose (PostgreSQL y Mailpit).
- Git.

## Inicio rápido

Antes de empezar, `apps/api/.env` necesita `SEED_ADMIN_PASSWORD` y `SEED_DEMO_PASSWORD` (mínimo 10 caracteres). Los valores de `.env.example` (`cambiar-esta-clave-admin` y `cambiar-clave-demo`) ya cumplen la validación, así que funcionan tal cual en local; cámbialos si compartes la máquina o la base.

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm install
pnpm db:up                           # PostgreSQL + Mailpit
pnpm --filter api migration:run      # crea las tablas
pnpm seed                            # roles, especies, razas y administrador
pnpm --filter api seed:demo          # fundación, adoptante, 7 mascotas con fotos y PDF de ejemplo
pnpm dev                             # API (3001) y web (3000)
```

`pnpm dev` no levanta Docker: la base se enciende aparte (`pnpm db:up`), así puedes apagarla y ver cómo responde la web sin conexión. `seed:demo` guarda las fotos y los PDF de ejemplo en `UPLOADS_DIR` (`apps/api/uploads` por defecto) y es repetible: no duplica nada.

| Servicio | URL |
|----------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001/api |
| Swagger | http://localhost:3001/api/docs |
| Mailpit (correos de prueba) | http://localhost:8025 |

## Perfiles de prueba

Los crea el seed. Se entra en http://localhost:3000/ingresar y cada rol aterriza en su panel.

| Perfil | Correo | Contraseña | Panel |
|--------|--------|------------|-------|
| Administrador | `admin@pethogar.local` | `SEED_ADMIN_PASSWORD` | `/administrador` |
| Fundación demo | `fundacion.demo@pethogar.local` | `SEED_DEMO_PASSWORD` | `/fundacion` |
| Adoptante demo | `adoptante.demo@pethogar.local` | `SEED_DEMO_PASSWORD` | `/adoptante` |

La contraseña es la que haya en `apps/api/.env` **al sembrar**: el seed no modifica cuentas ya creadas. Con el `.env` copiado de `.env.example` son `cambiar-esta-clave-admin` y `cambiar-clave-demo`. Son solo credenciales de desarrollo.

## Verificaciones

| Comando | Qué comprueba |
|---------|---------------|
| `pnpm lint` | ESLint de todos los paquetes y formato con Prettier. |
| `pnpm typecheck` | Tipos de api y web. |
| `pnpm test` | Pruebas rápidas de api y web (Jest y Vitest). |
| `pnpm build` | Build de api y web. |
| `pnpm --filter api test:db` (también `test:infra`, `test:auth`, `test:mascotas`, `test:adopciones`, `test:seguimientos`, `test:notificaciones`, `test:e2e`, `test:calidad`) | Pruebas lentas contra PostgreSQL, Mailpit y disco reales; necesitan `pnpm db:up`. |
| `pnpm --filter web test:api` | Sesión del front contra la API real. Requiere la API en marcha con `seed:demo` y las variables `TEST_API_URL`, `TEST_ADMIN_PASSWORD` y `TEST_DEMO_PASSWORD` (más `TEST_MAILPIT_URL` en los archivos de registro); tarda varios minutos. |
| `pnpm --filter web e2e` | Playwright con Chrome del sistema. No levanta nada: exige el stack en marcha (PostgreSQL, Mailpit, API con `seed:demo` y `next start`) y las variables `E2E_BASE_URL`, `E2E_API_URL`, `E2E_MAILPIT_URL`, `E2E_DEMO_PASSWORD` y `E2E_ADMIN_PASSWORD`. |

## Otros comandos útiles

| Comando | Qué hace |
|---------|----------|
| `pnpm db:reset` | **Destructivo:** borra la base y su volumen, la recrea, migra y carga el seed base. |
| `pnpm format` | Aplica Prettier a todo el repositorio. |
| `pnpm --filter api migration:generate` / `migration:revert` | Gestión de migraciones. |
| `pnpm --filter api demo:pdfs` | Descarga PDF de ejemplo de la API en marcha para revisarlos a mano. |
| `scripts/respaldo.sh` y `scripts/restaurar.sh` | Respaldo y restauración de la base y de los archivos (ver `docs/operacion.md`). |

## Problemas comunes

- **Un puerto está ocupado** (3000, 3001, 5432, 1025 u 8025). Cambia `POSTGRES_PORT`, `MAILPIT_SMTP_PORT` o `MAILPIT_UI_PORT` en `.env` y los valores equivalentes en `apps/api/.env` (`DATABASE_PORT`, `SMTP_PORT`). Si cambias `PORT` de la API, actualiza `NEXT_PUBLIC_API_URL` en `apps/web/.env.local`; si cambias el puerto de la web, actualiza `FRONTEND_URL` en `apps/api/.env`.
- **Docker no está encendido** (`Cannot connect to the Docker daemon`): inicia Docker y repite `pnpm db:up`.
- **Tras reiniciar Docker, la API da `ECONNREFUSED` a la base** aunque el contenedor figure «Up»: el contenedor de PostgreSQL pudo quedar sin el puerto publicado (`docker compose ps` no muestra `0.0.0.0:5432->5432`). Recréalo; los datos persisten en el volumen: `docker compose up -d --force-recreate postgres`.
- **La web dice «No pudimos conectar con el servidor»:** la API no está en marcha o `NEXT_PUBLIC_API_URL` apunta a otra dirección. Revisa la terminal de `pnpm dev` y recarga.
- **Error de CORS en el navegador:** `FRONTEND_URL` de `apps/api/.env` debe ser exactamente el origen de la web (`http://localhost:3000`). Reinicia la API tras cambiarlo.
- **Las migraciones fallan por conexión:** comprueba que PostgreSQL esté «healthy» (`docker compose ps`) y que `DATABASE_PORT` coincida con `POSTGRES_PORT`.
- **Las mascotas demo salen sin foto o los PDF dan 404** en una base sembrada hace tiempo: vuelve a ejecutar `pnpm --filter api seed:demo`; repara las rutas antiguas y escribe los archivos que falten.
- **Quiero empezar de cero:** `pnpm db:reset` (borra todos los datos locales) y después `pnpm --filter api seed:demo` si quieres los datos de ejemplo. Los archivos de `UPLOADS_DIR` no se borran con el reset.

## Documentación

| Documento | Contenido |
|-----------|-----------|
| `docs/operacion.md` | HTTPS, respaldo y restauración, riesgos aceptados, datos de demostración y notas para el front. |
| Swagger (`/api/docs`) | Contrato de la API, siempre al día con el código. |
| `ERSOFT_PetHogar.docx`, `PetHogar — Plan de tareas (monorepo).md` | Especificación de requisitos y plan de tareas del proyecto. No se versionan en Git: los guarda el equipo. |
| `AGENTS.md` y `.rei/` | Guía y registro del desarrollo asistido por IA (REI Harness). Tampoco se versionan: son locales de quien trabaja con el arnés. |

## Fuera del alcance

- Pasarela de pagos: las donaciones solo se registran con su comprobante.
- Contenerización de las apps y despliegue a producción en esta etapa.
