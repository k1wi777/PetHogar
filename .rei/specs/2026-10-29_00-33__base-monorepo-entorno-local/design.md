# Diseño — Base del monorepo y entorno local

## Estrategia

Montar el monorepo en cinco capas, cada una verificable antes de la siguiente:

1. Raíz del workspace (pnpm, TypeScript base, ESLint/Prettier, scripts agregados).
2. Entorno local con Docker Compose (solo Postgres y Mailpit).
3. API NestJS: esqueleto + configuración validada → infraestructura transversal → TypeORM.
4. Web Next.js mínima.
5. Activación de V1–V3 en el arnés cuando los tres scripts pasan.

No se crean entidades, migraciones, seeds, adaptadores de almacenamiento/correo
ni eventos (B-06 a B-09). No se instala Tailwind/shadcn (F-02).

## Versiones y dependencias

Se usa la última versión estable de cada paquete en el momento de implementar
(fijada en `pnpm-lock.yaml`): NestJS 11, Next.js estable vigente con React 19,
TypeORM 0.3.x, ESLint 9 (flat config), TypeScript 5.x. Toda dependencia
pertenece al stack acordado (`AGENTS.md` §3, `architecture.md`); las únicas no
mencionadas explícitamente allí se justifican abajo.

| Dependencia | Dónde | Justificación |
|-------------|-------|---------------|
| `typescript`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `prettier`, `globals` | raíz (dev) | Tooling compartido (B-01). |
| `@nestjs/{common,core,platform-express,config,swagger,throttler,typeorm}`, `reflect-metadata`, `rxjs` | api | Esqueleto y transversales (B-03/B-04/B-05). |
| `class-validator`, `class-transformer` | api | ValidationPipe y validación del `.env` (ver D3). |
| `helmet` | api | Cabeceras de seguridad (B-04). |
| `typeorm`, `pg` | api | Persistencia (B-05). |
| `@nestjs/cli`, `@nestjs/testing`, `jest`, `ts-jest`, `@types/jest`, `@types/node`, `@types/express`, `ts-node`, `tsconfig-paths` | api (dev) | Build, tests y CLI de TypeORM con TS. |
| `next`, `react`, `react-dom` | web | F-01. |
| `eslint-config-next`, `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@types/react`, `@types/react-dom` | web (dev) | Lint y tests de la web (stack: Vitest + Testing Library). |

Descartados: `turborepo` (dos apps; los scripts recursivos de pnpm bastan,
el plan lo marca opcional), `concurrently` (ver D2), `joi` (ver D3),
`typeorm-naming-strategies` (ver D6), `@nestjs/terminus` (health sin
dependencias externas basta en esta fase), `nestjs-pino`/`winston` (el `Logger`
de Nest cubre "logger" en B-04; se puede sustituir más adelante sin tocar dominio).

## Archivos

### Raíz

- `package.json` — `private`, `packageManager: pnpm@11.18.0`, `engines.node >=24`.
  Scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `format`.
- `pnpm-workspace.yaml` — paquetes `apps/*` y `packages/*`; aquí también la
  lista de dependencias autorizadas a ejecutar scripts de instalación (D1).
- `tsconfig.base.json` — opciones comunes: `strict`, `noImplicitOverride`,
  `forceConsistentCasingInFileNames`, `skipLibCheck`, `esModuleInterop`.
  Cada app lo extiende y define `module`/`moduleResolution` propios.
- `eslint.config.mjs` — configuración base exportable (js recommended +
  typescript-eslint recommended + `eslint-config-prettier`), consumida por las apps.
- `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitignore`.
- `docker-compose.yml`, `.env.example`.
- `packages/.gitkeep` (carpeta vacía versionada).

### `apps/api`

```text
apps/api/
  package.json, nest-cli.json, tsconfig.json, tsconfig.build.json,
  eslint.config.mjs, jest.config.ts (o bloque jest en package.json), .env.example
  src/
    main.ts                     bootstrap: prefijo, CORS, helmet, Swagger, pipe, filtro, logger
    app.module.ts               ConfigModule, TypeOrmModule, ThrottlerModule, HealthModule
    config/
      env.validation.ts         clase de variables + función validate (D3)
    common/
      pipes/validation.pipe.ts  fábrica del ValidationPipe con exceptionFactory por campo
      filters/http-exception.filter.ts
      pagination/               PaginacionQueryDto, tipo Paginado<T>, helper paginar()
    database/
      typeorm.options.ts        fábrica de opciones compartida por Nest y CLI (D5)
      data-source.ts            DataSource para la CLI de TypeORM
      snake-naming.strategy.ts  (D6)
      migrations/.gitkeep
    modules/
      health/                   health.module.ts, health.controller.ts (+ spec)
```

La carpeta transversal se llama `common/` (no `shared/` como dice B-03): prevalecen
`architecture.md` y `conventions.md`, que fijan `src/common/`.

### `apps/web`

```text
apps/web/
  package.json, tsconfig.json, next.config.ts, eslint.config.mjs,
  vitest.config.ts, vitest.setup.ts, .env.example
  app/layout.tsx (lang="es", metadata), app/page.tsx (+ page.test.tsx)
  features/.gitkeep
  shared/.gitkeep
```

Sin `src/`: `architecture.md` ubica `app/`, `features/`, `shared/` en la raíz de
la app. Alias `@/*` → `./*`.

### Arnés

- `.rei/config.json` — `checks` con V1–V3 (`command` como array, sin shell).
- `.rei/docs/project/verification.md` — quitar las marcas «pendiente de activar»,
  la nota de estado «todavía no existe código» y la viñeta «Mientras no exista el
  monorepo».

## Decisiones

### D1 — Scripts raíz con pnpm recursivo; build scripts autorizados

- `dev`: `pnpm --parallel -r dev` (cada app define su `dev` con su puerto).
- `build`, `typecheck`, `test`: `pnpm -r <script>`.
- `lint`: `pnpm -r lint && prettier --check .` — ESLint por app (cada una con su
  config), Prettier una sola vez en la raíz.
- `format`: `prettier --write .`.

pnpm 10+ bloquea los scripts de instalación de dependencias no aprobadas; pnpm 11
puede hacer fallar la instalación por ello. Se declaran en `pnpm-workspace.yaml`
solo los paquetes que lo necesiten (p. ej. `@nestjs/core`, `sharp`,
`unrs-resolver`, según lo que reporte `pnpm install`) para cumplir R1 sin
intervención manual. El Implementer lista los finalmente aprobados en `impl.md`.

### D2 — Sin `concurrently`

`pnpm --parallel -r dev` levanta ambas apps con salida prefijada. Alternativa
descartada: `concurrently` (dependencia extra sin beneficio con dos procesos).

### D3 — Validación del `.env` con class-validator

`ConfigModule.forRoot({ isGlobal: true, validate })`, donde `validate` transforma
`process.env` a una clase con `plainToInstance` y la valida con `validateSync`; si
hay errores lanza un `Error` con la lista de variables en español (R8). Se
reutiliza class-validator (ya requerido por el ValidationPipe) y se descarta
`joi` para no tener dos librerías de validación.

Variables obligatorias de la API (nombres definitivos, también en
`apps/api/.env.example`):

| Variable | Tipo | Valor en `.env.example` |
|----------|------|-------------------------|
| `PORT` | número | `3001` |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | texto/número | `localhost`, `5432`, `pethogar`, `pethogar`, `pethogar` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | texto no vacío | valores de desarrollo evidentes |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | texto/número | `localhost`, `1025`, `PetHogar <no-reply@pethogar.local>` |
| `UPLOADS_DIR` | texto | `./uploads` |
| `FRONTEND_URL` | URL | `http://localhost:3000` |

Los valores de BD coinciden con los defaults de `docker-compose.yml` (R6).
`uploads/` se añade a `.gitignore`; esta Feature no crea la carpeta (B-08).

### D4 — Formato de error uniforme

Un único filtro global (`@Catch()`) produce siempre:

```text
{ statusCode, error, message, errores?, path, timestamp }
```

- `message`: texto en español. Para `HttpException` se usa el mensaje propio si
  el desarrollador lo dio; si es el mensaje por defecto de Nest (en inglés), se
  sustituye por uno en español según el código (400, 401, 403, 404, 409, 429, 500).
- `errores`: solo en validación, `[{ campo, mensajes[] }]`, producido por el
  `exceptionFactory` del ValidationPipe (anidados con ruta `padre.hijo`).
- Errores no `HttpException`: 500, `message` genérico («Error interno del
  servidor»), y se registra la traza con `Logger.error`.

ValidationPipe: `whitelist: true`, `forbidNonWhitelisted: false` (descartar sin
fallar, como pide B-04), `transform: true` con conversión implícita para que
`page`/`limit` lleguen como números. Los mensajes por campo de los DTOs se
escriben en español en cada decorador (los defaults de class-validator están en
inglés); el pipe se crea desde una fábrica para poder probarlo en unitario con
un DTO de prueba (B-04 no tiene endpoints con body todavía).

### D5 — Opciones de TypeORM compartidas

`typeorm.options.ts` exporta una función pura que recibe la configuración y
devuelve las opciones de Postgres: `synchronize: false`, `migrationsRun: false`,
`namingStrategy: SnakeNamingStrategy`, migraciones en
`src/database/migrations/*` y entidades por glob `src/modules/**/*.entity.ts`.

- Nest: `TypeOrmModule.forRootAsync` con `ConfigService` y `autoLoadEntities: true`.
- CLI: `data-source.ts` carga `apps/api/.env` con `process.loadEnvFile()` (Node 24,
  sin `dotenv`), valida con la misma función `validate` de D3 y construye el
  `DataSource`.
- Scripts (`apps/api/package.json`), vía `typeorm-ts-node-commonjs -d
  src/database/data-source.ts`: `migration:generate` (recibe la ruta/nombre
  como argumento), `migration:run`, `migration:revert`.

**Verificación sin entidades (R16):** no se crea ninguna migración. Con el
Compose levantado, `migration:run` crea la tabla de control de migraciones y
termina con «No migrations are pending». Descartado: una migración vacía, que
dejaría una entrada sin valor en el historial antes de la migración inicial de B-06.

### D6 — Naming strategy propia

`SnakeNamingStrategy` extiende `DefaultNamingStrategy` de TypeORM y convierte a
`snake_case` tablas, columnas, relaciones, join columns y tablas de unión. Unas
decenas de líneas, cubierta por test unitario. Descartado
`typeorm-naming-strategies`: dependencia poco mantenida para algo trivial.

### D7 — Health sin base de datos

`GET /api/health` devuelve `{ status: 'ok' }` sin consultar la BD, para que su
test sea unitario (V3) y la ruta responda aunque Postgres tarde. Documentado en
Swagger. Un health con comprobación de BD queda para cuando haga falta.

### D8 — Transversales en `main.ts` / `AppModule`

- Prefijo global `api`; Swagger con `DocumentBuilder` en `api/docs`.
- CORS: `origin: FRONTEND_URL`, `credentials: true` (R9).
- `helmet()`: si su CSP impide cargar Swagger UI, se relaja la CSP solo lo
  necesario y se anota en `impl.md`; no se desactiva helmet.
- Throttler: `ThrottlerModule` con un límite global (100 peticiones / 60 s por
  IP) y `ThrottlerGuard` como `APP_GUARD`; el 429 pasa por el filtro (D4).
- Logger: `Logger` de Nest; mensaje de arranque con la URL de la API y de Swagger.

### D9 — Web mínima

- `next dev --port 3000` en `dev`, `next build` en `build`.
- `app/page.tsx`: página simple en español (nombre del producto y una frase);
  sin estilos de diseño (F-02).
- `.env.example`: `NEXT_PUBLIC_API_URL=http://localhost:3001/api`.
- Los rewrites `/api/*` de `architecture.md` NO se añaden aquí: no hay cliente
  HTTP hasta F-03, que decidirá entre rewrites y CORS con credenciales.
- `typecheck`: `tsc --noEmit` debe funcionar en un clon limpio (R3). Si depende
  de `next-env.d.ts`, se versiona o se genera antes del `tsc` en el propio script.
- Lint con `eslint .` y `eslint-config-next` (flat config) sobre la base de la raíz.

### D10 — Tests de V3

Rápidos, sin BD ni red (R4):

- api (Jest + ts-jest, `*.spec.ts` junto al archivo, `testRegex` limitado a
  `src/`): health controller, filtro de excepciones (HttpException con mensaje
  propio, por defecto traducido, error desconocido → 500), fábrica del
  ValidationPipe con un DTO de prueba (400 con `errores` por campo y propiedad
  extra descartada), helper de paginación, `validate` del `.env` (falta una
  variable → error) y naming strategy.
- web (Vitest + jsdom + Testing Library, `*.test.tsx`): `app/page.test.tsx`
  verifica que la página renderiza su encabezado en español.
- `apps/api/test/` (e2e, V5) no se crea en esta Feature.

### D11 — Docker Compose

Servicios `postgres` (`postgres:16-alpine`, puerto 5432, volumen con nombre,
`healthcheck` con `pg_isready`) y `mailpit` (`axllent/mailpit`, 1025 y 8025).
Credenciales con `${POSTGRES_USER:-pethogar}` etc., de modo que funciona sin
`.env` y el `.env.example` raíz solo documenta y permite cambiarlas. Sin
servicios para las apps (I-04).

### D12 — Prettier y archivos ignorados

`.prettierignore` excluye artefactos (`dist/`, `.next/`, `coverage/`,
`node_modules/`, `pnpm-lock.yaml`), la documentación del arnés y del usuario que
no es código (`.rei/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, `README.md`, el plan
`.md` y el `.docx` de la raíz) para que `prettier --check .` solo juzgue código y
configuración del monorepo.

`.gitignore`: `node_modules/`, `dist/`, `.next/`, `coverage/`, `.env`,
`.env.*` salvo `!.env.example`, `uploads/`, `*.tsbuildinfo`, logs.

## Riesgos

- Los defaults de Nest/Next/pnpm cambian entre versiones; si un generador
  (`nest new`, `create-next-app`) se usa como atajo, su salida se recorta a lo
  descrito aquí (sin Tailwind, sin `src/` en web, sin e2e de ejemplo).
- `AGENTS.md` §3 y `architecture.md` siguen diciendo que no existe código;
  actualizarlos queda fuera del alcance de `meta.json` y se señala al Leader.
