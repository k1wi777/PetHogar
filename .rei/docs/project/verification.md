# Verification

> **Documento del proyecto** — PetHogar.
>
> Este documento define cómo se verifica que un Work Item ha sido implementado correctamente.
>
> El objetivo no es indicar **qué** se implementó, sino **cómo demostrar que funciona**.

## Estrategia de verificación

- **Verificación rápida:** linter, type-check y tests unitarios de los workspaces afectados.
- **Verificación lenta:** build completo, tests e2e (API y web) y prueba de humo manual en local.
- **Alcance por app:** si un Work Item afecta a una sola app, se verifica solo esa app con `pnpm --filter api ...` o `pnpm --filter web ...`; si afecta a ambas o a `packages/shared`, se verifica todo el monorepo.
- **Mientras no exista el monorepo:** los Work Items de planificación o documentación se verifican únicamente con `rei check` y así se anota en la evidencia.

> **Estado:** todavía no existe código. Los checkpoints V1–V3 están **pendientes de activar**: se declararán en `.rei/config.json` en el Work Item de bootstrap del monorepo, que también debe crear los scripts correspondientes (incluido `typecheck`). Hasta entonces `.rei/config.json` mantiene `"checks": []`.

---

## Checkpoints de verificación

Cada checkpoint posee un identificador estable (`V1`, `V2`, ...). El Implementer y el Reviewer deben referenciar estos IDs en sus reportes en vez de describir la verificación de forma libre.

Los checkpoints se dividen en **rápidos** y **lentos** según su costo.

### Checkpoints rápidos (se declaran en `.rei/config.json`)

Verificaciones de bajo costo que pueden ejecutarse muchas veces al día. `rei check` se ejecuta de forma constante —al iniciar sesión, al implementar y al revisar—, así que **aquí no deben ir checks lentos**.

| ID | Comando | Descripción |
|----|---------|-------------|
| `V1` | `pnpm lint` | ESLint + Prettier en todos los workspaces. *Pendiente de activar (bootstrap del monorepo).* |
| `V2` | `pnpm typecheck` | Type-check (`tsc --noEmit`) de api y web. *Pendiente de activar; el script se crea en el bootstrap.* |
| `V3` | `pnpm test` | Tests unitarios (Jest en api, Vitest en web) **sin base de datos** (repositories simulados). Los tests que tocan la BD van a los checkpoints lentos. *Pendiente de activar (bootstrap del monorepo).* |

### Checkpoints lentos (NO van en `.rei/config.json`)

Se ejecutan manualmente (o en CI si existiera), se documentan aquí y se referencian en la evidencia.

| ID | Comando | Descripción |
|----|---------|-------------|
| `V4` | `pnpm build` | Build completo de api y web. |
| `V5` | `pnpm --filter api test:e2e` | E2E de la API con Supertest contra una BD de pruebas (Docker Compose levantado). |
| `V6` | `pnpm --filter web e2e` | E2E con Playwright del flujo principal contra el backend local con datos de seed. |
| `V7` | Manual | Prueba de humo en local: `docker compose up -d`, migraciones, seed y `pnpm dev`; recorrer en el navegador el flujo afectado y revisar los correos en Mailpit. |

> Los checkpoints rápidos se declaran en `.rei/config.json`:
>
> ```json
> {
>   "checks": [
>     { "id": "V1", "description": "ESLint + Prettier", "command": ["pnpm", "lint"] }
>   ]
> }
> ```
>
> `rei check` ejecuta cada `command` (sin shell intermedio) y refleja su resultado en el código de salida. Si añades o modificas un checkpoint, actualiza también `.rei/config.json`.

---

## Evidencia

Por cada checkpoint ejecutado:

- ID del checkpoint (`V1`, `V2`, ...);
- resultado (pasa / falla);
- comando ejecutado;
- observaciones relevantes (logs, capturas, validaciones manuales). En `V7`, describir el recorrido manual realizado y adjuntar capturas cuando aplique.

La evidencia debe documentarse en:

```
.rei/progress/work-items/<work-item-id>/impl.md
```

---

## Bloqueos

Un Work Item pasa a `blocked` cuando alguna verificación falla y no puede resolverse dentro del alcance de la sesión.

El protocolo exacto para declarar un bloqueo (qué documentar, dónde, y cómo detenerse) está definido en el archivo de rol correspondiente (`.rei/agents/implementer.md`, `.rei/agents/reviewer.md`).

Nunca continúes la implementación ni solicites revisión ignorando una verificación fallida.

---

## Qué NO hacer

- No asumir que un cambio funciona sin verificarlo contra los checkpoints definidos.
- No omitir checkpoints definidos para el proyecto.
- No solicitar revisión sin evidencia suficiente por cada checkpoint.
- No describir una verificación de forma libre si ya existe un ID (`V1`, `V2`, ...) para ella.
- No declarar en `.rei/config.json` checkpoints cuyos comandos aún no existan.
