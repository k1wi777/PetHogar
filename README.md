# PetHogar

**Plataforma web de adopción y seguimiento de mascotas en fundaciones y refugios de animales.**

> **Estado:** el backend (API REST) está completo y la web tiene su base lista: sistema de diseño, sesión, navegación por rol y paneles con páginas provisionales. Las pantallas de negocio llegan en las siguientes Features del front.

---

## Qué es

Muchas fundaciones y refugios gestionan la adopción de forma manual: publicaciones en redes sociales, conversaciones por WhatsApp, formularios en papel y hojas de cálculo. La información se dispersa, no se sabe con certeza qué animales están disponibles, las respuestas a los interesados se demoran y no existe un seguimiento sistemático después de la entrega del animal. Las donaciones también se registran de manera informal.

PetHogar centraliza en una sola plataforma web:

- la **publicación de mascotas** con fotografías, historial médico y estado de salud;
- la **gestión de solicitudes de adopción** con criterios uniformes y registro de cada decisión;
- el **seguimiento post-adopción** (visitas o reportes periódicos) con alertas de vencimiento y de riesgo;
- el **registro de donaciones** económicas o en especie;
- la **generación de reportes y estadísticas** en PDF y gráficas.

**Objetivo general:** desarrollar una plataforma web que permita gestionar el proceso de adopción de mascotas en fundaciones y refugios, desde la publicación de los animales disponibles hasta el seguimiento post-adopción, incluyendo el registro de donaciones y la generación de reportes.

Proyecto académico — Universidad de Córdoba, Facultad de Ingeniería, Departamento de Ingeniería de Sistemas (Montería, 2026). Autor del documento de requisitos: Josué David Contreras Lara.

## Usuarios

| Rol | Descripción | Funciones principales |
|-----|-------------|-----------------------|
| **Adoptante** | Persona natural sin conocimientos técnicos que busca adoptar. | Buscar y filtrar mascotas, enviar y consultar solicitudes, enviar reportes de seguimiento, registrar donaciones, consultar notificaciones. |
| **Fundación / Refugio** | Organización que publica mascotas. Uso frecuente. Debe ser validada por el administrador. | Gestionar fichas e historial médico, evaluar solicitudes, programar y registrar seguimientos, registrar donaciones recibidas, generar reportes propios. |
| **Administrador** | Supervisa la plataforma. | Validar fundaciones, gestionar cuentas de usuario, generar reportes y estadísticas globales. |

## Módulos

1. **Gestión de usuarios** — registro, autenticación y roles.
2. **Gestión de mascotas** — fichas con fotos, historial médico y estado de salud.
3. **Solicitudes de adopción** — postulación con formulario adjunto; aprobación o rechazo por la fundación.
4. **Seguimiento post-adopción** — visitas o reportes periódicos para verificar el bienestar del animal.
5. **Donaciones** — registro de aportes económicos o en especie (sin pasarela de pago).
6. **Reportes y estadísticas** — fichas y listados en PDF, reportes de seguimiento y donaciones, gráficas de adopción.

Además, un sistema de **notificaciones** (en la plataforma y por correo) atraviesa todos los módulos.

## Requisitos funcionales

| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF1 | Registro de adoptantes y fundaciones con validación de datos y asignación de rol. | Alta |
| RF2 | Inicio de sesión con control de acceso por rol y bloqueo temporal tras intentos fallidos. | Alta |
| RF3 | Recuperación de contraseña mediante código temporal enviado al correo. | Media |
| RF4 | Validación de fundaciones por el administrador (aprobar o rechazar). | Alta |
| RF5 | Gestión de usuarios: consultar, activar y desactivar cuentas. | Media |
| RF6 | Publicar, editar y dar de baja fichas de mascotas con fotos. | Alta |
| RF7 | Historial médico de cada mascota (vacunas, desparasitaciones, cirugías, consultas). | Media |
| RF8 | Búsqueda y filtrado por especie, tamaño, edad y ubicación. | Alta |
| RF9 | Solicitudes de adopción con formulario y documentos adjuntos. | Alta |
| RF10 | Evaluación de solicitudes; al aprobar se registra la adopción y la mascota pasa a *adoptada*. | Alta |
| RF11 | Programación de seguimientos post-adopción (visitas o reportes). | Alta |
| RF12 | Registro del resultado de los seguimientos y de los reportes del adoptante con evidencias. | Media |
| RF13 | Registro de donaciones económicas o en especie. | Media |
| RF14 | Notificaciones automáticas (solicitudes, validación de fundaciones, seguimientos programados o vencidos). | Media |
| RF15 | Reportes y estadísticas: ficha PDF, listado de solicitudes, seguimientos, donaciones y gráficas. | Alta |

## Requisitos no funcionales

- **Rendimiento:** respuesta promedio ≤ 2 s; 200 usuarios concurrentes; catálogo paginado con imágenes optimizadas.
- **Seguridad:** contraseñas con bcrypt, HTTPS, autenticación JWT con control de acceso por rol, tratamiento de datos conforme a la **Ley 1581 de 2012** (Colombia).
- **Disponibilidad:** 99 % excluyendo mantenimientos; copias de seguridad diarias de la base de datos y de las imágenes.
- **Usabilidad:** interfaz pensada para usuarios sin conocimientos técnicos; mensajes de confirmación y error claros, en español.
- **Compatibilidad:** Chrome, Firefox, Edge y Safari; diseño responsivo.
- **Escalabilidad:** arquitectura cliente-servidor con API REST.
- **Mantenibilidad:** código organizado por módulos y documentado; pruebas unitarias automáticas.
- **Almacenamiento:** imágenes JPG o PNG de máximo 5 MB, hasta 6 fotos por mascota.
- **Accesibilidad:** WCAG 2.1 (contraste, textos alternativos, navegación por teclado).
- **Integración:** correo vía SMTP; servicios expuestos como API REST.

## Stack técnico (acordado)

| Tema | Decisión |
|------|----------|
| Monorepo | pnpm workspaces: `apps/api`, `apps/web`, `packages/shared` (Turborepo opcional) |
| Backend | NestJS + TypeScript, monolito modular, patrón repository por módulo, eventos con `@nestjs/event-emitter`, cron con `@nestjs/schedule` |
| Base de datos | PostgreSQL 16 con TypeORM y migraciones (`synchronize` desactivado), enums nativos, IDs `GENERATED ALWAYS AS IDENTITY` |
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, estructura feature-first; catálogo y ficha con SSR, paneles con TanStack Query; formularios con React Hook Form + Zod; gráficas con Recharts |
| Autenticación | JWT de acceso (15 min, en memoria) + refresh token (7 días, cookie `httpOnly`, rotado y guardado con hash) |
| Archivos | Disco local (`uploads/`) detrás de una interfaz de almacenamiento, sustituible por S3 o Cloudinary |
| Correo | Nodemailer (SMTP) con Mailpit en local |
| PDF | pdfmake en el backend |
| Pruebas | Jest (api), Vitest + Testing Library (web), Playwright (e2e) |
| Entorno local | Docker Compose con PostgreSQL y Mailpit; el navegador llama directamente a la API (`NEXT_PUBLIC_API_URL`, con CORS y cookies con credenciales) |

## Estructura

```
apps/
  api/        # NestJS (puerto 3001)
  web/        # Next.js (puerto 3000)
packages/
  shared/     # Tipos y esquemas compartidos (opcional)
docker-compose.yml
```

## Puesta en marcha

### Requisitos

- **Node.js 24 o superior** y **pnpm 11** (`corepack enable` lo activa).
- **Docker** con Docker Compose (para PostgreSQL 16 y Mailpit).
- Git.

### Pasos

1. Clona el repositorio y entra en la carpeta.
2. Copia los archivos de entorno (los valores de ejemplo sirven para trabajar en local):

   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

3. Instala las dependencias: `pnpm install`.
4. Levanta PostgreSQL y Mailpit: `pnpm db:up` (equivale a `docker compose up -d --wait`).
5. Crea las tablas: `pnpm --filter api migration:run`.
6. Carga los datos base (roles, especies, razas y el administrador): `pnpm seed`. Para añadir además una fundación, un adoptante y mascotas de ejemplo: `pnpm --filter api seed:demo`.
7. Arranca la API y la web a la vez: `pnpm dev`.

`pnpm dev` **no** levanta Docker ni la base de datos: se hace aparte (paso 4) para que puedas apagar la API o la base y comprobar cómo responde la web (muestra «No pudimos conectar con el servidor» con un botón para reintentar).

### Direcciones

| Servicio | URL |
|----------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001/api |
| Swagger (documentación de la API) | http://localhost:3001/api/docs |
| Mailpit (correos de prueba) | http://localhost:8025 |

En desarrollo, http://localhost:3000/_kit muestra todos los componentes del sistema de diseño (en producción responde 404).

### Usuarios de prueba

Los crea el seed; las contraseñas son las que definas en `apps/api/.env` (no se publican aquí).

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| Administrador | `admin@pethogar.local` | `SEED_ADMIN_PASSWORD` |
| Fundación (seed demo) | `fundacion.demo@pethogar.local` | `SEED_DEMO_PASSWORD` |
| Adoptante (seed demo) | `adoptante.demo@pethogar.local` | `SEED_DEMO_PASSWORD` |

La pantalla de inicio de sesión llega en una Feature posterior; hasta entonces, el inicio de sesión real se comprueba con las pruebas (`pnpm --filter web test:api`).

### Comandos útiles

| Comando | Qué hace |
|---------|----------|
| `pnpm db:up` | Levanta PostgreSQL y Mailpit y espera a que estén listos. |
| `pnpm db:reset` | **Destructivo:** borra la base de datos, la recrea, aplica las migraciones y carga el seed base. |
| `pnpm seed` | Carga los datos base (idempotente). |
| `pnpm dev` | API (3001) y web (3000) con recarga automática. |
| `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | Verificación rápida y build. |

### Problemas comunes

- **Un puerto está ocupado** (3000, 3001, 5432, 1025 u 8025). Cambia el puerto y avisa a las demás piezas:
  - PostgreSQL: `POSTGRES_PORT` en `.env` de la raíz y el mismo valor en `DATABASE_PORT` de `apps/api/.env`.
  - Mailpit: `MAILPIT_SMTP_PORT` y `MAILPIT_UI_PORT` en `.env`; `SMTP_PORT` de `apps/api/.env` debe coincidir con el primero.
  - API: `PORT` en `apps/api/.env` y `NEXT_PUBLIC_API_URL` en `apps/web/.env.local` (por ejemplo `http://localhost:3002/api`).
  - Web: arranca con `pnpm --filter web exec next dev --port 3010` y pon esa URL en `FRONTEND_URL` de `apps/api/.env`.
- **Docker no está encendido** (`Cannot connect to the Docker daemon`): inicia Docker Desktop o el servicio y repite `pnpm db:up`.
- **La web dice «No pudimos conectar con el servidor»:** la API no está en marcha o `NEXT_PUBLIC_API_URL` apunta a otra dirección. Revisa la terminal de `pnpm dev` y recarga la web.
- **Error de CORS en la consola del navegador:** `FRONTEND_URL` de `apps/api/.env` debe ser exactamente el origen de la web (por ejemplo `http://localhost:3000`). Reinicia la API tras cambiarlo.
- **Quiero empezar de cero:** `pnpm db:reset` (borra todos los datos locales) y, si quieres los datos de ejemplo, `pnpm --filter api seed:demo`.
- **Las migraciones fallan por conexión:** comprueba que PostgreSQL esté «healthy» (`docker compose ps`) y que `DATABASE_PORT` coincida con `POSTGRES_PORT`.

## Documentación

| Documento | Contenido |
|-----------|-----------|
| `ERSOFT_PetHogar.docx` | Especificación de requisitos: problema, objetivos, roles, RF/RNF, casos de uso, modelo entidad-relación, diagramas de secuencia y diccionario de datos. |
| `PetHogar — Plan de tareas (monorepo).md` | Plan de tareas propuesto (backend, frontend e integración), ajustes al modelo de datos, hitos y decisiones abiertas. **Todavía no adoptado** como Work Items. |
| `AGENTS.md` y `.rei/` | REI Harness: workflow, roles de agentes, specs y progreso del desarrollo asistido por IA. |

## Fuera del alcance

- Pasarela de pagos: las donaciones solo se registran con su comprobante.
- Contenerización de las apps y despliegue a producción en la primera etapa (solo funcionamiento en local).
