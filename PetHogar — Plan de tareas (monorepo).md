# PetHogar — Plan de tareas del monorepo

*Backend primero, frontend después. Cubre todo lo necesario para correr la app completa en local.*

decisiones tecnicas 
Tema	Decisión
Monorepo	pnpm workspaces: apps/api, apps/web, packages/shared (Turborepo opcional)
Base de datos	PostgreSQL 16 con TypeORM y migraciones (synchronize desactivado). Enums nativos de Postgres. IDs integer generated always as identity
Backend	NestJS, monolito modular, patrón repository por módulo, eventos con @nestjs/event-emitter, cron con @nestjs/schedule
Frontend	Next.js (App Router) con estructura feature-first. Páginas públicas (catálogo y ficha) con SSR; paneles privados con TanStack Query
Autenticación	JWT de acceso (15 min, en memoria) + refresh token (7 días, cookie httpOnly, rotado y guardado con hash). bcrypt para contraseñas
Same-origin en local	Next.js hace rewrites de /api/* hacia la API para evitar problemas de CORS y cookies
Archivos	Disco local (uploads/) detrás de una interfaz IStorageService, para cambiarlo luego a S3 o Cloudinary
Correo	Nodemailer (SMTP) con Mailpit en local
PDF	pdfmake en el backend
Pruebas	Jest (api), Vitest + Testing Library (web), Playwright (flujo e2e)


## 1. Cómo leer este plan

**Stack acordado:** monorepo con `apps/api` (NestJS + TypeScript + TypeORM + **PostgreSQL**) y `apps/web` (**Next.js** + TypeScript + Tailwind + shadcn/ui). Local con Docker Compose (Postgres + Mailpit como SMTP de pruebas). Pruebas con Jest en el backend.

**Formato de cada tarea:** ID · título · prioridad (`P1` imprescindible, `P2` importante, `P3` opcional) · tamaño (`S` menos de medio día, `M` cerca de un día, `L` dos días o más) · dependencias · requisitos del documento que cubre (RF). Cada una trae **Alcance** (qué se hace y qué no) y **Hecho cuando** (criterio de aceptación verificable).

**Reglas del repo que aplican a todas las tareas:**

- Un módulo no usa el repository de otro: llama a su service o reacciona a un evento.
- Flujo por módulo: Controller → Service → Repository → BD. DTOs con `class-validator` en la entrada y mapeo explícito en la salida (nunca devolver entidades crudas ni `contrasena`).
- Toda tarea de backend con lógica de negocio incluye sus pruebas unitarias (el documento las exige).
- Mensajes de error claros y en español (requisito de usabilidad).

## 2. Ajustes al modelo de datos (leer antes de B-06)

El modelo del documento está pensado para MySQL y le faltan algunas piezas para que los casos de uso funcionen. Propongo resolverlos en la migración inicial:

**Traducción a PostgreSQL**

- `ENUM` → enums nativos de Postgres (o `varchar` + `CHECK`). `tinyint(1)` → `boolean`. `datetime` → `timestamptz`. `INT AUTO_INCREMENT` → `GENERATED ALWAYS AS IDENTITY`. `DECIMAL(12,2)` → `numeric(12,2)`.
- Columnas en `snake_case` en la BD y `camelCase` en el código (naming strategy de TypeORM).

**Piezas que el documento pide pero el modelo no tiene**

- **Verificación de correo del adoptante:** `usuario.email_verificado` (boolean) y token de verificación con expiración.
- **Bloqueo temporal tras intentos fallidos (RF2):** `usuario.intentos_fallidos` y `usuario.bloqueado_hasta`.
- **Cierre de sesión que invalida la sesión:** tabla `refresh_token` (hash, usuario, expiración, revocado).
- **Código de recuperación (RF3):** guardar `resetCode` hasheado, no en claro, y limitar intentos.
- **Ley 1581 de 2012:** campos `acepta_politica_datos` y `fecha_aceptacion` en `usuario`.
- **Solicitud duplicada:** índice único parcial sobre `solicitud_adopcion (adoptante_id, mascota_id)` donde `estado = 'pendiente'`.
- **Una sola foto principal por mascota:** índice único parcial sobre `foto_mascota (mascota_id)` donde `es_principal = true`.
- **Filtro por ubicación (RF8):** `mascota` no tiene ciudad; se filtra por `fundacion.ciudad` con join.
- **Evidencias de seguimiento:** `seguimiento.evidenciaUrl` admite una sola URL pero el documento habla de varias fotos. Recomiendo tabla `seguimiento_evidencia (id, seguimiento_id, url)`. *Decisión tuya.*
- **Reporte del adoptante vs. resultado de la fundación:** comparten la fila de `seguimiento`. Recomiendo columna `reporte_adoptante` (texto) separada de `observaciones` para no pisarse. *Decisión tuya.*
- **Estados `finalizada` y `revocada` de `adopcion`:** existen en el modelo pero ningún caso de uso los dispara. Queda como tarea opcional (B-32).

---

## 3. BACKEND (`apps/api`)

### Fase 0 — Base del monorepo y entorno local

**B-01 · Monorepo y tooling** `P1` `S` · Depende: — · RF: —

- **Alcance:** repo con pnpm workspaces (`apps/api`, `apps/web`, `packages/` vacío por ahora), `.gitignore`, `.editorconfig`, ESLint + Prettier compartidos, TypeScript base, scripts raíz (`dev`, `build`, `lint`, `test`).
- **Hecho cuando:** `pnpm install` en la raíz funciona y `pnpm lint` corre en ambos proyectos.

**B-02 · Docker Compose para local** `P1` `S` · Depende: B-01 · RF: —

- **Alcance:** `docker-compose.yml` con PostgreSQL (volumen persistente) y Mailpit (SMTP en 1025, interfaz web en 8025). `.env.example` en la raíz y en cada app. Sin contenerizar las apps todavía.
- **Hecho cuando:** `docker compose up -d` deja Postgres accesible y Mailpit mostrando su interfaz.

**B-03 · Esqueleto NestJS y configuración** `P1` `S` · Depende: B-01 · RF: —

- **Alcance:** proyecto NestJS en `apps/api`, `@nestjs/config` con validación del `.env` (puerto, BD, JWT, SMTP, ruta de uploads, URL del front), prefijo `/api`, CORS hacia el front, carpeta `modules/` y `shared/` según la estructura acordada.
- **Hecho cuando:** `GET /api/health` responde 200 y la app falla al arrancar si falta una variable obligatoria.

**B-04 · Infraestructura transversal** `P1` `M` · Depende: B-03 · RF: NF seguridad, usabilidad

- **Alcance:** `ValidationPipe` global (whitelist), filtro global de excepciones con formato de error uniforme, DTO y helper de paginación (`page`, `limit`, respuesta con `total`), Swagger en `/api/docs`, logger, `helmet`, rate limit global (`@nestjs/throttler`).
- **Hecho cuando:** un body inválido devuelve 400 con mensajes por campo y Swagger abre en el navegador.

**B-05 · TypeORM y migraciones** `P1` `S` · Depende: B-02, B-03 · RF: —

- **Alcance:** conexión a Postgres, `DataSource` para CLI, scripts `migration:generate/run/revert`, `synchronize` apagado, naming strategy snake\_case.
- **Hecho cuando:** `pnpm --filter api migration:run` se ejecuta contra el Postgres del Compose.

**B-06 · Entidades y migración inicial** `P1` `L` · Depende: B-05 · RF: todos

- **Alcance:** las 14 tablas del diccionario de datos (`rol`, `usuario`, `adoptante`, `fundacion`, `especie`, `raza`, `mascota`, `foto_mascota`, `historial_medico`, `solicitud_adopcion`, `adopcion`, `seguimiento`, `donacion`, `notificacion`) con sus restricciones (Not Null, Unique, FK, defaults, `edad_meses >= 0`, `monto >= 0`, cascada en fotos) **más los ajustes de la sección 2**. Una entidad por archivo dentro de su módulo.
- **Hecho cuando:** la migración crea el esquema completo desde cero y `migration:revert` lo deshace sin errores.

**B-07 · Seeds** `P1` `S` · Depende: B-06 · RF: —

- **Alcance:** script idempotente que inserta los 3 roles, un administrador inicial (credenciales por `.env`), especies (perro, gato) y razas base incluyendo "Mestizo" por especie. Opcional: datos demo (una fundación aprobada, algunas mascotas) detrás de un flag `--demo`.
- **Hecho cuando:** correr el seed dos veces no duplica datos y el admin puede existir en la BD con contraseña hasheada.

**B-08 · Adaptadores de almacenamiento y correo** `P1` `M` · Depende: B-03 · RF: NF almacenamiento, integración

- **Alcance:** interfaz `StorageService` con implementación local en disco (carpeta `uploads/`, servida de forma estática), validación de tipo (JPG/PNG para imágenes; PDF permitido para documentos de fundación, formulario y comprobantes), máximo 5 MB, nombres aleatorios. Interfaz `MailService` sobre Nodemailer/SMTP con plantillas simples en español. Ambos intercambiables sin tocar el dominio.
- **Hecho cuando:** un endpoint de prueba sube un archivo y lo devuelve por URL, y un correo de prueba aparece en Mailpit.

**B-09 · Bus de eventos de dominio** `P1` `S` · Depende: B-03 · RF: RF14

- **Alcance:** `@nestjs/event-emitter` configurado, y el catálogo de eventos como clases tipadas en `shared/events` (`FoundationValidated`, `AdoptionRequestCreated`, `AdoptionApproved`, `AdoptionRejected`, `FollowUpScheduled`, `FollowUpReportReceived`, `FollowUpOverdue`, `WellbeingAlertRaised`, `DonationRegistered`). Los listeners se implementan en B-36.
- **Hecho cuando:** existe el catálogo y un test emite un evento y un listener de prueba lo recibe.

### Fase 1 — Autenticación y usuarios

**B-10 · Registro de adoptante con verificación de correo** `P1` `M` · Depende: B-06, B-08 · RF1

- **Alcance:** `POST /auth/register/adoptante`. Valida correo y documento únicos, mayoría de edad, fortaleza de contraseña, aceptación de política de datos. Crea `usuario` (rol adoptante) y `adoptante` en una transacción, hashea con bcrypt, envía correo con enlace de verificación (token con expiración). `GET /auth/verify-email?token=` activa la cuenta. Reenvío de verificación.
- **Hecho cuando:** el correo llega a Mailpit, el enlace activa la cuenta y un usuario no verificado no puede iniciar sesión.

**B-11 · Registro de fundación** `P1` `M` · Depende: B-08, B-10 · RF1

- **Alcance:** `POST /auth/register/fundacion` (multipart: datos + documento legal). Valida NIT y correo únicos. Crea usuario (rol fundación) y fundación con `estado_validacion = pendiente`. Correo de recepción. Sin permisos operativos hasta ser aprobada.
- **Hecho cuando:** una fundación se registra, queda pendiente y el mensaje de respuesta le explica que será revisada.

**B-12 · Login, JWT y bloqueo temporal** `P1` `L` · Depende: B-10, B-11 · RF2

- **Alcance:** `POST /auth/login` con bcrypt. Access token JWT de vida corta y refresh token (en cookie httpOnly o en body, a definir con B-13). Tras 5 intentos fallidos bloquea 15 min (valores configurables). Rechaza cuentas inactivas o sin verificar. Si es fundación pendiente o rechazada devuelve el estado para que el front muestre el mensaje correcto. `POST /auth/refresh` y `GET /auth/me`.
- **Hecho cuando:** las pruebas unitarias cubren credenciales buenas, malas, bloqueo y desbloqueo por tiempo.

**B-13 · Cierre de sesión e invalidación** `P1` `S` · Depende: B-12 · RF2 (casos de uso Cerrar sesión)

- **Alcance:** `POST /auth/logout` revoca el refresh token guardado. Rotación del refresh en cada uso.
- **Hecho cuando:** un refresh token revocado ya no sirve y el access vence solo.

**B-14 · Recuperación de contraseña** `P2` `M` · Depende: B-08, B-12 · RF3

- **Alcance:** `POST /auth/forgot-password` (siempre responde igual exista o no el correo), genera código de 6 dígitos con expiración (ej. 15 min), lo guarda hasheado y lo envía por correo. `POST /auth/reset-password` con correo, código y nueva contraseña; limita intentos; revoca los refresh tokens existentes.
- **Hecho cuando:** el flujo completo funciona con Mailpit y un código vencido o reutilizado es rechazado.

**B-15 · Control de acceso por rol** `P1` `S` · Depende: B-12 · RF2

- **Alcance:** `JwtAuthGuard`, decorador `@Roles()` + `RolesGuard`, decorador `@CurrentUser()`, y `ApprovedFoundationGuard` que bloquea las rutas de fundación si no está aprobada. Rutas públicas marcadas con `@Public()`.
- **Hecho cuando:** pruebas demuestran 401 sin token, 403 con rol incorrecto y 403 para fundación pendiente.

**B-16 · Admin: validar fundaciones** `P1` `M` · Depende: B-15 · RF4

- **Alcance:** `GET /admin/fundaciones?estado=` (pendientes por defecto), `GET /admin/fundaciones/:id` (datos, NIT, URL del documento), `PATCH /admin/fundaciones/:id/validacion` con decisión y observación (obligatoria al rechazar). Registra `fecha_validacion` y emite `FoundationValidated`.
- **Hecho cuando:** aprobar habilita el inicio de sesión operativo de la fundación y rechazar guarda el motivo.

**B-17 · Admin: gestión de usuarios** `P2` `S` · Depende: B-15 · RF5

- **Alcance:** `GET /admin/usuarios` con filtro por nombre, correo y rol, paginado. `PATCH /admin/usuarios/:id/estado` activar/desactivar. Un administrador no puede desactivarse a sí mismo. Desactivar revoca sus refresh tokens.
- **Hecho cuando:** un usuario desactivado no puede entrar ni refrescar sesión.

### Fase 2 — Mascotas

**B-18 · Catálogos de especie y raza** `P1` `S` · Depende: B-07, B-15 · RF6

- **Alcance:** `GET /especies` y `GET /especies/:id/razas` públicos (alimentan formularios y filtros). Sin CRUD para usuarios finales.
- **Hecho cuando:** devuelven los datos del seed.

**B-19 · CRUD de mascotas (fundación)** `P1` `L` · Depende: B-15, B-18 · RF6

- **Alcance:** `POST/PATCH /mascotas`, `GET /fundacion/mascotas` (solo las suyas, filtrable por estado), `PATCH /mascotas/:id/baja` (pasa a `inactiva` y sale del catálogo). Una fundación solo toca sus mascotas. Estado inicial `disponible`. Transiciones de estado centralizadas en una clase de estado (`disponible → en_proceso → adoptada`, `inactiva` desde disponible).
- **Hecho cuando:** pruebas verifican propiedad, validaciones y que una mascota adoptada no se puede editar a `disponible` por esta ruta.

**B-20 · Fotos de mascota** `P1` `M` · Depende: B-08, B-19 · RF6, NF almacenamiento

- **Alcance:** subir hasta 6 fotos JPG/PNG de máximo 5 MB, redimensionar con `sharp` (versión catálogo y versión grande), marcar foto principal (solo una), eliminar foto, reordenar es opcional. Al borrar la principal, promover otra.
- **Hecho cuando:** la séptima foto es rechazada y el catálogo siempre dispone de una principal si existen fotos.

**B-21 · Historial médico** `P2` `S` · Depende: B-19 · RF7

- **Alcance:** `POST/GET /mascotas/:id/historial` (tipo, fecha no futura, descripción, veterinario). Lectura pública dentro de la ficha; escritura solo de la fundación dueña. Edición y borrado de un registro es opcional.
- **Hecho cuando:** el historial aparece ordenado por fecha descendente en la ficha.

**B-22 · Catálogo público: búsqueda, filtros y ficha** `P1` `M` · Depende: B-19, B-20 · RF8

- **Alcance:** `GET /mascotas` público, solo `disponible`, con filtros por especie, tamaño, rango de edad (en meses) y ciudad de la fundación; paginado y ordenado por fecha de publicación; devuelve foto principal. `GET /mascotas/:id` con ficha completa (fotos, salud, historial, datos de la fundación). Índices para los filtros.
- **Hecho cuando:** responde en menos de 2 s con datos de prueba y sin resultados devuelve lista vacía con el total en 0.

### Fase 3 — Solicitudes y adopciones

**B-23 · Crear solicitud de adopción** `P1` `M` · Depende: B-22, B-08 · RF9

- **Alcance:** `POST /solicitudes` (multipart: motivo, tipo de vivienda, otras mascotas, formulario firmado obligatorio). Verifica que la mascota esté `disponible`, impide duplicado activo (índice único parcial + validación con mensaje claro) y que el adoptante no sea de la propia fundación. Emite `AdoptionRequestCreated`.
- **Hecho cuando:** la segunda solicitud activa a la misma mascota devuelve 409 con mensaje claro.

**B-24 · Solicitudes del adoptante** `P1` `S` · Depende: B-23 · RF9, casos "Consultar estado"

- **Alcance:** `GET /mis-solicitudes` (estado, filtro) y detalle con la observación de la fundación; `PATCH /solicitudes/:id/cancelar` solo si está `pendiente` y es suya.
- **Hecho cuando:** cancelar una aprobada devuelve error de negocio.

**B-25 · Solicitudes recibidas por la fundación** `P1` `S` · Depende: B-23 · RF10

- **Alcance:** `GET /fundacion/solicitudes` filtrable por estado y mascota, paginado; detalle con datos del adoptante, formulario y adjuntos (URL protegida, solo accesible a la fundación dueña).
- **Hecho cuando:** una fundación no puede ver solicitudes de mascotas ajenas.

**B-26 · Aprobar y rechazar solicitud** `P1` `L` · Depende: B-25, B-09 · RF10

- **Alcance:** `PATCH /solicitudes/:id/decision`. **Rechazar:** observación obligatoria, estado `rechazada`. **Aprobar:** fecha de entrega obligatoria; en **una sola transacción** marca la solicitud `aprobada`, crea `adopcion` (estado `activa`), pasa la mascota a `adoptada` y rechaza automáticamente las otras solicitudes pendientes de esa mascota. Emite `AdoptionApproved` / `AdoptionRejected`. Máquina de estados que impide decidir dos veces.
- **Hecho cuando:** pruebas unitarias y una prueba con BD real verifican la atomicidad (si algo falla, nada queda a medias).

**B-27 · Consulta de adopciones y acta** `P2` `S` · Depende: B-26 · RF10, RF11

- **Alcance:** `GET /fundacion/adopciones` y `GET /mis-adopciones` (con mascota, fecha de entrega y seguimientos), subida opcional del acta firmada (`actaUrl`).
- **Hecho cuando:** cada rol ve únicamente sus adopciones.

### Fase 4 — Seguimiento post-adopción

**B-28 · Programar seguimiento** `P1` `M` · Depende: B-26 · RF11

- **Alcance:** `POST /adopciones/:id/seguimientos` (tipo visita/reporte, fecha programada). Valida que la adopción esté `activa` y que la fecha sea posterior a la entrega y no pasada. Estado `programado`. Emite `FollowUpScheduled`.
- **Hecho cuando:** una fecha anterior a la entrega devuelve 400 con mensaje claro.

**B-29 · Registrar resultado (fundación) y alerta de riesgo** `P1` `M` · Depende: B-28 · RF12

- **Alcance:** `PATCH /seguimientos/:id/resultado` con fecha realizada, estado de bienestar (bueno/regular/malo), observaciones y evidencias. Pasa a `realizado`. Si el bienestar es `malo`, emite `WellbeingAlertRaised` (para la fundación y el administrador).
- **Hecho cuando:** un seguimiento ya realizado no se puede volver a cerrar y la alerta se genera solo con `malo`.

**B-30 · Reporte del adoptante** `P1` `M` · Depende: B-28, B-08 · RF12

- **Alcance:** `POST /seguimientos/:id/reporte` (comentarios + hasta N fotos) solo para el adoptante de esa adopción, solo si el seguimiento es de tipo `reporte` y está `programado` o `vencido`. Emite `FollowUpReportReceived`. La fundación luego lo revisa y lo cierra con B-29.
- **Hecho cuando:** un adoptante ajeno recibe 403 y el reporte queda visible para la fundación.

**B-31 · Cron de vencidos y recordatorios** `P1` `M` · Depende: B-28, B-09 · RF14

- **Alcance:** `@nestjs/schedule`: tarea diaria que marca `vencido` los seguimientos `programado` con fecha pasada y emite `FollowUpOverdue`; otra que emite recordatorio de los que vencen en los próximos 3 días (configurable). Idempotente: no repite notificaciones.
- **Hecho cuando:** una prueba con fechas simuladas cambia estados una sola vez.

**B-32 · Finalizar o revocar adopción** `P3` `S` · Depende: B-27 · RF —

- **Alcance:** opcional. `PATCH /adopciones/:id/estado` (`finalizada` / `revocada`) con motivo. Revocada: la mascota vuelve a `disponible` o `inactiva` según decisión de la fundación y cancela seguimientos pendientes. *Solo si decides cubrir devoluciones; el documento las menciona pero no define el caso de uso.*
- **Hecho cuando:** los seguimientos pendientes dejan de generar alertas.

### Fase 5 — Donaciones

**B-33 · Registrar donación (donante)** `P2` `M` · Depende: B-08, B-15 · RF13

- **Alcance:** `POST /donaciones` para usuario autenticado: fundación (solo aprobadas), tipo económica/en especie, monto (> 0) o descripción según el tipo, comprobante opcional. Aclaración de alcance: **no hay pasarela de pago**; el sistema solo registra el aporte y su comprobante. Confirmación por correo al donante y evento `DonationRegistered`.
- **Hecho cuando:** una donación económica sin monto o en especie sin descripción es rechazada.

**B-34 · Donaciones de la fundación** `P2` `S` · Depende: B-33 · RF13

- **Alcance:** `GET /fundacion/donaciones` (filtro por periodo y tipo, con totales por tipo), `POST /fundacion/donaciones` para registro manual de aportes presenciales (nombre del donante, sin usuario).
- **Hecho cuando:** los totales coinciden con la suma de los registros del periodo.

### Fase 6 — Notificaciones

**B-35 · Notificaciones dentro de la plataforma** `P1` `S` · Depende: B-15 · RF14

- **Alcance:** `GET /notificaciones` (paginado, filtro leídas), `GET /notificaciones/no-leidas/count`, `PATCH /notificaciones/:id/leida`, `PATCH /notificaciones/leer-todas`. Cada usuario solo ve las suyas. El servicio interno `NotificationsService.create()` lo usan los listeners.
- **Hecho cuando:** marcar como leída actualiza el contador.

**B-36 · Listeners de eventos: notificación + correo** `P1` `M` · Depende: B-09, B-35, B-08 · RF14

- **Alcance:** un listener por evento del catálogo (B-09) que crea la notificación del destinatario correcto y envía correo cuando el documento lo pide (validación de fundación, resultado de solicitud, seguimiento programado/vencido, confirmación de donación). Nuevas fundaciones por validar y alertas de bienestar notifican al administrador. Un fallo de correo no debe romper la operación principal.
- **Hecho cuando:** aprobar una solicitud genera notificación y correo en Mailpit para el adoptante.

### Fase 7 — Reportes y estadísticas

**B-37 · Estadísticas y listados** `P1` `L` · Depende: B-26, B-29, B-34 · RF15

- **Alcance:** endpoints de solo lectura (consultas directas, sin depender de repositories de otros módulos): adopciones por mes y por especie, solicitudes por estado, seguimientos por estado y bienestar, donaciones por periodo y tipo. Rol fundación ve solo lo suyo; administrador ve lo global y puede filtrar por fundación y rango de fechas.
- **Hecho cuando:** los números coinciden con los datos del seed demo y respetan filtros.

**B-38 · Generación de PDF** `P1` `L` · Depende: B-22, B-37 · RF15

- **Alcance:** con `pdfmake`: ficha de mascota (pública, "Descargar ficha"), listado de solicitudes, reporte de seguimientos y reporte de donaciones, con logo, fecha y filtros aplicados. Endpoints que devuelven `application/pdf`.
- **Hecho cuando:** los cuatro PDF se descargan, abren bien y tienen los acentos correctos.

### Fase 8 — Calidad y cierre del backend

**B-39 · Pruebas unitarias** `P1` `L` · Depende: fases 1–7 · RF: NF mantenibilidad

- **Alcance:** Jest sobre los services críticos: auth (login, bloqueo, recuperación), aprobación de solicitud (transacción y reglas), máquina de estados de mascota y solicitud, programación y vencimiento de seguimientos, donaciones. Repositories simulados.
- **Hecho cuando:** `pnpm --filter api test` pasa y cubre los casos de borde listados.

**B-40 · Prueba e2e del flujo principal** `P2` `M` · Depende: B-39 · RF: —

- **Alcance:** Supertest contra una BD de pruebas: registro de fundación → aprobación por admin → publicar mascota → registro de adoptante → solicitud → aprobación → seguimiento → reporte.
- **Hecho cuando:** el flujo completo pasa en un solo comando.

**B-41 · Seguridad, rendimiento y respaldo** `P2` `M` · Depende: fases 1–7 · RF: NF seguridad, rendimiento, disponibilidad

- **Alcance:** revisión de que ningún endpoint filtre `contrasena` o códigos, límites de subida, rate limit más estricto en login y recuperación, índices (catálogo, solicitudes por estado, seguimientos por fecha), script de respaldo diario de la BD y de `uploads/` (`pg_dump` + copia), lista de comprobación de HTTPS para producción.
- **Hecho cuando:** el script de respaldo genera un archivo restaurable y una prueba de carga ligera con 200 usuarios simulados mantiene el promedio por debajo de 2 s en el catálogo.

---

## 4. FRONTEND (`apps/web`)

**Decisiones base del front:** Next.js con App Router y TypeScript. Las páginas públicas (catálogo y ficha) se renderizan en el servidor para que Google y WhatsApp muestren vista previa; los paneles por rol son interactivos en cliente con TanStack Query. Formularios con React Hook Form + Zod, UI con Tailwind + shadcn/ui, gráficas con Recharts. Estructura feature-first (`features/<nombre>/{api,components,hooks,schemas,types}`); las features no se importan entre sí, lo compartido va en `shared/`.

Las tareas de front dependen de que exista el endpoint del backend que consumen; se indica cuál.

### Fase F0 — Base

**F-01 · Proyecto Next.js** `P1` `S` · Depende: B-01 · RF: —

- **Alcance:** app en `apps/web`, TypeScript estricto, alias de imports, `.env.example` con `NEXT_PUBLIC_API_URL`, estructura de carpetas `app/`, `features/`, `shared/`, scripts en el monorepo.
- **Hecho cuando:** `pnpm dev` levanta el front en el puerto 3000 y el back en el 3001 al mismo tiempo desde la raíz.

**F-02 · Sistema de diseño base** `P1` `M` · Depende: F-01 · RF: NF usabilidad, accesibilidad

- **Alcance:** Tailwind + shadcn/ui, tokens de color y tipografía con contraste suficiente (WCAG 2.1 AA), componentes base reutilizables (botones, inputs con etiqueta y error, select, diálogo de confirmación, toasts, tabla, paginación, badge de estado, tarjeta de mascota, carga con *skeleton*, estado vacío). Foco visible en todo elemento interactivo.
- **Hecho cuando:** una página de muestra (`/_kit`, solo en desarrollo) renderiza todos los componentes y se navega bien con teclado.

**F-03 · Cliente HTTP y sesión** `P1` `L` · Depende: F-01, B-12, B-13 · RF2

- **Alcance:** cliente `fetch`/axios único con la URL base, manejo de errores uniforme (mensajes del backend), renovación automática con el refresh token cuando el access vence (una sola petición de refresh a la vez), contexto de sesión con `GET /auth/me`, cierre de sesión, y `middleware.ts` de Next que redirige según rol. *Recomendación:* el backend entrega el refresh en cookie `httpOnly`; en local funciona entre `localhost:3000` y `:3001` con CORS con credenciales. Confirmar con B-12/B-13.
- **Hecho cuando:** iniciar sesión, recargar la página y seguir con sesión funciona; tras cerrar sesión las rutas protegidas redirigen al login.

**F-04 · Layouts y navegación por rol** `P1` `M` · Depende: F-02, F-03 · RF2

- **Alcance:** cuatro *route groups* con su layout: público (cabecera con Adoptar, Donar, Ingresar), adoptante, fundación y administrador (menú lateral con las opciones de cada rol según los casos de uso, ícono de notificaciones con contador, botón de cerrar sesión con confirmación). Guardas de ruta por rol y páginas 403 y 404. Diseño responsivo (menú colapsable en móvil).
- **Hecho cuando:** un adoptante que escribe la URL del panel de fundación es redirigido o ve 403.

### Fase F1 — Público y autenticación

**F-05 · Inicio y catálogo público** `P1` `L` · Depende: F-04, B-22 · RF8

- **Alcance:** página de inicio breve y `/adoptar` con cuadrícula de tarjetas, filtros (especie, tamaño, edad, ciudad) reflejados en la URL (`?especie=&tamano=`), paginación, imágenes optimizadas con `next/image`, estado vacío con sugerencia de ampliar la búsqueda. Renderizado en servidor.
- **Hecho cuando:** compartir una URL filtrada abre el mismo resultado y sin resultados se muestra el mensaje del caso de uso.

**F-06 · Ficha de mascota** `P1` `M` · Depende: F-05, B-21, B-38 · RF8, RF15

- **Alcance:** `/mascotas/[id]` en servidor con galería, datos, estado de salud, historial médico, fundación responsable, metadatos Open Graph (título, descripción, foto principal), botón "Descargar ficha" (PDF) y botón "Quiero adoptar" (lleva a login si no hay sesión y regresa).
- **Hecho cuando:** pegar el enlace en un validador de Open Graph muestra foto y nombre, y "Quiero adoptar" no aparece para fundaciones o administradores.

**F-07 · Registro de adoptante y verificación** `P1` `M` · Depende: F-04, B-10 · RF1

- **Alcance:** formulario con todos los campos del caso de uso (nombres, apellidos, documento, teléfono, correo, dirección, ciudad, fecha de nacimiento, contraseña con indicador de fortaleza, aceptación de política de datos), validación Zod espejo del backend, página de "revisa tu correo" y página de verificación que lee el token de la URL.
- **Hecho cuando:** el flujo completo con Mailpit termina en cuenta activa y los errores del backend (correo duplicado) aparecen junto al campo.

**F-08 · Registro de fundación** `P1` `M` · Depende: F-04, B-11 · RF1

- **Alcance:** formulario de organización (nombre, NIT, dirección, ciudad, teléfono, correo, contraseña, descripción) con carga del documento legal, previsualización del archivo y mensaje final de que el registro será revisado.
- **Hecho cuando:** un archivo no permitido o mayor a 5 MB se rechaza antes de enviar.

**F-09 · Inicio de sesión y recuperación de contraseña** `P1` `M` · Depende: F-03, B-12, B-14 · RF2, RF3

- **Alcance:** pantallas de login (mensajes diferenciados: credenciales inválidas, cuenta bloqueada con tiempo restante, fundación pendiente o rechazada con la observación, correo sin verificar), "¿Olvidó su contraseña?" en tres pasos (correo → código → nueva contraseña). Redirección al panel según rol.
- **Hecho cuando:** cada estado de cuenta muestra su mensaje propio y el código vencido da un error claro.

### Fase F2 — Adoptante

**F-10 · Formulario de solicitud de adopción** `P1` `M` · Depende: F-06, B-23 · RF9

- **Alcance:** página o diálogo "Quiero adoptar" con motivo, tipo de vivienda, otras mascotas y carga del formulario firmado (con enlace para descargar la plantilla si la fundación la provee, a definir), resumen previo al envío y confirmación. Maneja el 409 de solicitud duplicada.
- **Hecho cuando:** enviar una segunda solicitud activa muestra el mensaje y enlaza a "Mis solicitudes".

**F-11 · Mis solicitudes** `P1` `M` · Depende: F-04, B-24 · RF9

- **Alcance:** lista con badge de estado (pendiente, aprobada, rechazada, cancelada), detalle con observación de la fundación y botón "Cancelar" (solo pendientes) con confirmación.
- **Hecho cuando:** al cancelar, el estado cambia sin recargar la página.

**F-12 · Mis adopciones y reporte de seguimiento** `P1` `M` · Depende: F-04, B-27, B-30 · RF12

- **Alcance:** lista de adopciones con sus seguimientos (fecha límite, tipo, estado, vencido resaltado) y formulario de reporte con comentarios y fotos (previsualización, máximo de archivos y 5 MB).
- **Hecho cuando:** el reporte enviado aparece como recibido y el formulario se bloquea.

**F-13 · Donar** `P2` `S` · Depende: F-04, B-33 · RF13

- **Alcance:** `/donar` con selector de fundación aprobada, tipo de donación (campos condicionales: monto o descripción), comprobante opcional y confirmación. Aviso visible de que PetHogar no procesa pagos, solo registra el aporte.
- **Hecho cuando:** los campos cambian según el tipo y la validación impide montos cero o negativos.

### Fase F3 — Fundación

**F-14 · Mis mascotas** `P1` `L` · Depende: F-04, B-19, B-18 · RF6

- **Alcance:** lista con filtro por estado, formulario de publicar y editar (especie con razas dependientes, edad en meses o en años y meses, tamaño, sexo, esterilizado, vacunado, estado de salud, descripción) y acción "Dar de baja" con confirmación.
- **Hecho cuando:** publicar una mascota la muestra en el catálogo público y darla de baja la retira.

**F-15 · Gestor de fotos** `P1` `M` · Depende: F-14, B-20 · RF6

- **Alcance:** carga múltiple con arrastrar y soltar, contador de 6 como máximo, validación de tipo y peso, marcar como principal, eliminar con confirmación, progreso de subida y texto alternativo.
- **Hecho cuando:** la séptima foto se rechaza con mensaje y cambiar la principal se refleja en el catálogo.

**F-16 · Historial médico** `P2` `S` · Depende: F-14, B-21 · RF7

- **Alcance:** pestaña en la ficha de gestión con lista cronológica y formulario de nuevo registro (tipo, fecha, descripción, veterinario).
- **Hecho cuando:** el nuevo registro aparece también en la ficha pública.

**F-17 · Solicitudes recibidas y decisión** `P1` `L` · Depende: F-04, B-25, B-26 · RF10

- **Alcance:** lista filtrable por estado y mascota; vista de revisión con datos del adoptante, formulario y adjuntos; acciones "Aprobar" (pide fecha de entrega) y "Rechazar" (motivo obligatorio) con diálogo que advierte que aprobar rechaza las demás solicitudes de esa mascota.
- **Hecho cuando:** tras aprobar, la mascota figura como adoptada y la adopción aparece en la lista de adopciones.

**F-18 · Adopciones y seguimientos** `P1` `L` · Depende: F-17, B-27, B-28, B-29 · RF11, RF12

- **Alcance:** lista de adopciones activas, detalle con línea de tiempo de seguimientos, formulario "Programar seguimiento" (tipo y fecha con validación posterior a la entrega), formulario de registro del resultado (fecha, bienestar bueno/regular/malo, observaciones, evidencias), visualización del reporte enviado por el adoptante, alerta visual cuando el bienestar es malo y marca de vencido.
- **Hecho cuando:** el ciclo programar → recibir reporte → registrar resultado queda reflejado en el historial.

**F-19 · Donaciones de la fundación** `P2` `S` · Depende: F-04, B-34 · RF13

- **Alcance:** lista con filtro por periodo y tipo, totales por tipo, formulario de registro manual y acceso al comprobante.
- **Hecho cuando:** los totales cambian al cambiar el periodo.

**F-20 · Reportes y gráficas de la fundación** `P1` `M` · Depende: F-04, B-37, B-38 · RF15

- **Alcance:** pantalla con selector de tipo de reporte, filtros (rango de fechas), gráficas Recharts (adopciones por mes, solicitudes por estado, seguimientos por bienestar, donaciones por periodo) y botón "Descargar PDF" por cada reporte.
- **Hecho cuando:** las gráficas tienen texto alternativo o tabla equivalente y los PDF se descargan.

### Fase F4 — Administrador

**F-21 · Fundaciones por validar** `P1` `M` · Depende: F-04, B-16 · RF4

- **Alcance:** lista de pendientes, detalle con datos, NIT y visor o descarga del documento, acciones aprobar y rechazar (observación obligatoria al rechazar) con confirmación.
- **Hecho cuando:** la fundación aprobada puede entrar a su panel completo en su siguiente inicio de sesión.

**F-22 · Gestión de usuarios** `P2` `S` · Depende: F-04, B-17 · RF5

- **Alcance:** tabla paginada con búsqueda por nombre, correo y rol, badge de estado y acción activar o desactivar con confirmación (sin opción sobre la propia cuenta).
- **Hecho cuando:** el cambio se refleja de inmediato y queda mensaje de éxito.

**F-23 · Reportes globales** `P2` `M` · Depende: F-20, B-37, B-38 · RF15

- **Alcance:** reutiliza los componentes de F-20 con filtro adicional por fundación y datos de toda la plataforma.
- **Hecho cuando:** filtrar por una fundación coincide con el reporte de esa fundación.

### Fase F5 — Transversales y calidad

**F-24 · Notificaciones** `P1` `M` · Depende: F-04, B-35 · RF14

- **Alcance:** campana con contador (consulta periódica cada 30 a 60 s con TanStack Query), menú desplegable con las recientes, página de lista completa, detalle que marca como leída y lleva a la pantalla relacionada (solicitud, seguimiento, fundación), "marcar todas como leídas".
- **Hecho cuando:** aprobar una solicitud como fundación hace aparecer la notificación al adoptante sin recargar.

**F-25 · Mensajes, estados vacíos y errores** `P2` `M` · Depende: fases F2–F4 · RF: NF usabilidad

- **Alcance:** revisión transversal: confirmaciones de éxito y errores claros en cada operación, páginas de error del App Router (`error.tsx`, `not-found.tsx`), estados de carga y vacíos coherentes, textos finales en español.
- **Hecho cuando:** ninguna pantalla queda en blanco ni muestra un error técnico crudo.

**F-26 · Accesibilidad y responsive** `P1` `M` · Depende: F-25 · RF: NF accesibilidad, compatibilidad

- **Alcance:** pasada WCAG 2.1: contraste, textos alternativos, etiquetas de formulario, orden de foco, navegación completa por teclado, `aria-live` en toasts, revisión en 360 px, 768 px y escritorio, y en Chrome, Firefox, Edge y Safari.
- **Hecho cuando:** Lighthouse de accesibilidad marca 90 o más en las pantallas principales y el flujo de adopción se completa solo con teclado.

**F-27 · Pruebas del front** `P2` `L` · Depende: F-25 · RF: NF mantenibilidad

- **Alcance:** pruebas de componentes con Vitest y Testing Library para formularios y guardas de ruta; un e2e con Playwright del flujo principal (adoptante busca, solicita; fundación aprueba) contra el backend local con datos de seed.
- **Hecho cuando:** `pnpm --filter web test` y `pnpm --filter web e2e` pasan.

---

## 5. INTEGRACIÓN Y ARRANQUE LOCAL

**I-01 · README raíz y scripts de arranque** `P1` `S` · Depende: B-07, F-01

- **Alcance:** README con requisitos (Node, pnpm, Docker), pasos para clonar y levantar (`cp .env.example`, `docker compose up -d`, migraciones, seed, `pnpm dev`), URLs (front, API, Swagger, Mailpit), usuarios de prueba y solución a problemas comunes. Scripts raíz: `db:up`, `db:reset`, `seed`, `dev`.
- **Hecho cuando:** una persona nueva levanta todo siguiendo solo el README, en menos de 15 minutos.

**I-02 · Tipos y esquemas compartidos** `P3` `M` · Depende: B-39, F-27

- **Alcance:** opcional. Paquete `packages/shared` con enums de estados y esquemas Zod de los DTO para no duplicarlos entre back y front.
- **Hecho cuando:** un cambio en un enum se refleja en ambos proyectos sin copiar a mano.

**I-03 · Prueba de humo completa** `P1` `S` · Depende: todo lo anterior

- **Alcance:** lista de verificación manual con los 3 roles recorriendo todos los casos de uso del documento (registro, validación, publicación, solicitud, aprobación, seguimiento, donación, reportes, notificaciones, cierre de sesión).
- **Hecho cuando:** la lista queda marcada sin fallos bloqueantes.

**I-04 · Contenerizar las apps (después)** `P3` `M` · Depende: I-03

- **Alcance:** Dockerfiles de `api` y `web` y ampliación del Compose para levantar todo con un solo comando. Fuera del alcance de "funciona en local"; se deja para el despliegue.
- **Hecho cuando:** `docker compose up` levanta el sistema completo.

---

## 6. Orden recomendado (hitos)

| Hito | Contenido | Resultado visible |
| --- | --- | --- |
| **H1 · Base** | B-01 a B-09, F-01, F-02 | Entorno local, BD con seeds, correo de prueba y front vacío funcionando |
| **H2 · Cuentas** | B-10 a B-17, F-03, F-04, F-07 a F-09, F-21, F-22 | Registro, login, recuperación, validación de fundaciones y gestión de usuarios |
| **H3 · Catálogo** | B-18 a B-22, F-05, F-06, F-14 a F-16 | La fundación publica mascotas con fotos e historial y el público las ve y filtra |
| **H4 · Adopción** | B-23 a B-27, F-10, F-11, F-17 | Solicitud, aprobación atómica y adopción registrada |
| **H5 · Seguimiento y avisos** | B-28 a B-31, B-35, B-36, F-12, F-18, F-24 | Seguimientos, reportes del adoptante, vencidos y notificaciones por pantalla y correo |
| **H6 · Donaciones y reportes** | B-33, B-34, B-37, B-38, F-13, F-19, F-20, F-23 | Donaciones, estadísticas, gráficas y PDF |
| **H7 · Cierre** | B-39 a B-41, F-25 a F-27, I-01 a I-03 (y B-32 / I-02 si decides) | Pruebas, accesibilidad, README y prueba de humo completa |

Cada hito deja algo que se puede demostrar de punta a punta, así que si el tiempo se acorta puedes cortar después de H5 sin quedarte con piezas sueltas (H6 y H7 son el pulido y lo que cierra los requisitos de reportes y calidad).

## 7. Decisiones que quedan abiertas

1. **Evidencias de seguimiento:** una URL (como el diccionario de datos) o tabla `seguimiento_evidencia` con varias fotos (recomendado).
2. **Reporte del adoptante:** columna propia `reporte_adoptante` (recomendado) o reutilizar `observaciones`.
3. **Plantilla del formulario de adopción:** el documento pide adjuntar un formulario firmado, pero no dice de dónde se descarga. ¿La fundación sube su plantilla o PetHogar ofrece una general?
4. **Devoluciones (B-32):** ¿las incluyes en esta versión o quedan fuera del alcance?
5. **Sesión:** refresh token en cookie `httpOnly` (recomendado) o en el cuerpo de la respuesta.
