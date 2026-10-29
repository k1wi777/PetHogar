# Requisitos — Base del monorepo y entorno local

Trazabilidad con el plan: B-01 (R1–R4), B-02 (R5–R6), B-03 (R7–R9), B-04 (R10–R14),
B-05 (R15–R16), F-01 (R17–R18), verificación del arnés (R19–R20).

## Monorepo y tooling (B-01)

- **R1** — CUANDO se ejecute `pnpm install` en la raíz de un clon limpio con Node 24 y pnpm 11, el sistema DEBE instalar las dependencias de `apps/api` y `apps/web` sin errores ni aprobaciones manuales de scripts de instalación.
- **R2** — CUANDO se ejecute `pnpm lint` en la raíz, el sistema DEBE ejecutar ESLint en `apps/api` y `apps/web` con una configuración base compartida y comprobar el formato con Prettier, y terminar con código distinto de 0 si hay errores de lint o archivos sin formatear.
- **R3** — CUANDO se ejecute `pnpm typecheck` en la raíz, el sistema DEBE comprobar los tipos de `apps/api` y `apps/web` en modo `strict` sin emitir archivos y sin requerir un `build` o `dev` previo.
- **R4** — CUANDO se ejecute `pnpm test` en la raíz, el sistema DEBE ejecutar los tests unitarios de `apps/api` (Jest) y `apps/web` (Vitest) sin necesitar base de datos, Docker ni red, y con al menos un test real por app.

## Entorno local (B-02)

- **R5** — CUANDO se ejecute `docker compose up -d` en la raíz, el sistema DEBE dejar PostgreSQL 16 aceptando conexiones en el puerto 5432 con datos persistidos en un volumen con nombre, y Mailpit con SMTP en 1025 e interfaz web en 8025.
- **R6** — El sistema DEBE versionar un `.env.example` en la raíz, en `apps/api` y en `apps/web` cuyos valores, copiados a `.env`, permitan arrancar el entorno local sin editarlos; los archivos `.env` NO DEBEN versionarse.

## API: esqueleto y configuración (B-03)

- **R7** — CUANDO se reciba `GET /api/health`, la API DEBE responder 200 con un cuerpo JSON que indique que está operativa; todas las rutas de la API DEBEN servirse bajo el prefijo `/api`.
- **R8** — SI al arrancar la API falta o es inválida una variable de entorno obligatoria (puerto, conexión a BD, secretos JWT, SMTP, ruta de uploads o URL del front), ENTONCES la API DEBE abortar el arranque indicando en español qué variables fallan.
- **R9** — CUANDO una petición provenga del origen configurado como URL del front, la API DEBE permitirla por CORS con credenciales; las peticiones de otros orígenes NO DEBEN recibir cabeceras CORS permisivas.

## API: infraestructura transversal (B-04)

- **R10** — CUANDO un cuerpo o query no cumpla su DTO, la API DEBE responder 400 con los mensajes de error agrupados por campo, y DEBE descartar las propiedades no declaradas en el DTO.
- **R11** — CUANDO cualquier petición termine en error (HTTP o no controlado), la API DEBE responder con un formato de error uniforme con mensaje en español; los errores no controlados DEBEN responder 500 con un mensaje genérico, sin exponer detalles internos, y registrarse en el log.
- **R12** — La API DEBE ofrecer un DTO de paginación (`page`, `limit`, con valores por defecto y límites) y un helper que construya respuestas paginadas con `data`, `total`, `page` y `limit`.
- **R13** — CUANDO se abra `/api/docs` en el navegador, la API DEBE mostrar la documentación Swagger de los endpoints existentes.
- **R14** — La API DEBE aplicar cabeceras de seguridad HTTP (helmet), registrar en el log el arranque y los errores, y limitar la tasa de peticiones por cliente; SI se supera el límite, ENTONCES DEBE responder 429 con el formato de error uniforme.

## API: persistencia (B-05)

- **R15** — La API DEBE conectarse a PostgreSQL usando la configuración validada, con la sincronización automática del esquema desactivada y con nombres de tablas y columnas en `snake_case` derivados de propiedades en `camelCase`.
- **R16** — CUANDO se ejecute `pnpm --filter api migration:run` con el Postgres del Compose levantado y sin migraciones pendientes, el comando DEBE terminar con éxito; los scripts `migration:generate` y `migration:revert` DEBEN existir y usar la misma configuración de conexión.

## Web (F-01)

- **R17** — La web DEBE ser una app Next.js con App Router en `apps/web`, TypeScript estricto, alias de imports `@/` hacia la raíz de la app, carpetas `app/`, `features/` y `shared/`, y un `.env.example` con `NEXT_PUBLIC_API_URL`.
- **R18** — CUANDO se ejecute `pnpm dev` en la raíz, el sistema DEBE levantar a la vez la web en el puerto 3000 y la API en el 3001, y la página inicial de la web DEBE renderizar contenido en español.

## Verificación del arnés

- **R19** — `.rei/config.json` DEBE declarar los checks `V1` (`pnpm lint`), `V2` (`pnpm typecheck`) y `V3` (`pnpm test`), y `rei check` DEBE pasar con ellos.
- **R20** — `.rei/docs/project/verification.md` NO DEBE marcar V1–V3 como pendientes de activar ni afirmar que no existe código.
