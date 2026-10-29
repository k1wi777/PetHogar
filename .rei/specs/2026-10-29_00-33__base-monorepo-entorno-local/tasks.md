# Tareas — Base del monorepo y entorno local

Ejecutar en orden. Marcar `[x]` al terminar cada tarea, antes de pasar a la siguiente.

- [ ] T1 — Raíz del workspace: `package.json` (packageManager, engines, scripts `dev`/`build`/`lint`/`typecheck`/`test`/`format`), `pnpm-workspace.yaml` con builds autorizados, `tsconfig.base.json`, `eslint.config.mjs` base, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitignore`, `packages/.gitkeep` (D1, D2, D12). (R1, R2, R6)
- [ ] T2 — `docker-compose.yml` con Postgres 16 (volumen con nombre, healthcheck) y Mailpit, y `.env.example` raíz; comprobar `docker compose up -d`, conexión a 5432 y UI en 8025 (D11). (R5, R6)
- [ ] T3 — Esqueleto NestJS en `apps/api`: `package.json` con scripts `dev` (puerto 3001), `build`, `start`, `lint`, `typecheck`, `test`; `tsconfig*.json`, `nest-cli.json`, `eslint.config.mjs`, configuración de Jest; `main.ts` con prefijo `/api` y CORS hacia `FRONTEND_URL`; `HealthModule` con `GET /api/health` (D7, D8). (R7, R9)
- [ ] T4 — Validación del `.env` de la API (`config/env.validation.ts`) con las variables de D3 y `apps/api/.env.example`; verificar que falta de variable aborta el arranque con mensaje en español. (R6, R8)
- [ ] T5 — Transversales en `src/common/`: fábrica del ValidationPipe con errores por campo y whitelist, filtro global de excepciones con formato uniforme y mensajes en español, DTO + helper de paginación; registrarlos globalmente (D4). (R10, R11, R12)
- [ ] T6 — Swagger en `/api/docs`, helmet, Logger de Nest y Throttler global con 429 por el filtro; comprobar que Swagger abre en el navegador con helmet activo (D8). (R13, R14)
- [ ] T7 — TypeORM: `SnakeNamingStrategy`, `typeorm.options.ts`, `TypeOrmModule.forRootAsync`, `data-source.ts` con `process.loadEnvFile()`, `migrations/.gitkeep`, scripts `migration:generate/run/revert`; ejecutar `pnpm --filter api migration:run` contra el Compose (D5, D6). (R15, R16)
- [ ] T8 — Tests unitarios de la API: health, filtro de excepciones, ValidationPipe con DTO de prueba, paginación, validación del `.env` y naming strategy (D10). (R4, R7, R8, R10, R11, R12, R15)
- [ ] T9 — App Next.js en `apps/web`: App Router sin `src/`, TS estricto, alias `@/*`, `app/layout.tsx` (`lang="es"`) y `app/page.tsx`, carpetas `features/` y `shared/`, `.env.example` con `NEXT_PUBLIC_API_URL`, scripts `dev` (puerto 3000), `build`, `lint`, `typecheck`, `test`; ESLint con `eslint-config-next` (D9). (R6, R17)
- [ ] T10 — Vitest + Testing Library en la web y `app/page.test.tsx` (D10). (R4, R17)
- [ ] T11 — Verificación integral desde un clon limpio: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` en verde; `pnpm dev` levanta web:3000 y api:3001 a la vez; `GET /api/health` 200 y página inicial en español; `pnpm build` (V4) en verde. Registrar evidencia y builds autorizados en `impl.md`. (R1, R2, R3, R4, R18)
- [ ] T12 — Arnés: declarar V1–V3 en `.rei/config.json` y actualizar `.rei/docs/project/verification.md` (quitar marcas de pendiente y notas de «no existe código»); ejecutar `rei check` en verde. (R19, R20)
