# AGENTS.md — REI Harness

> Este archivo es el **punto de entrada universal** para cualquier agente de IA que trabaje en este repositorio.
>
> Su objetivo es proporcionar únicamente el contexto esencial para orientarse dentro del proyecto y saber dónde encontrar información adicional. **No debe contener toda la documentación del proyecto.**
>Carga únicamente el contexto necesario para la tarea actual.
> Las responsabilidades específicas de cada rol se encuentran en `.rei/agents/`.
> Cada rol se define en `.rei/agents/<rol>.md` con frontmatter, un `## Contrato`
> autosuficiente y una `## Referencia` opcional; a los subagentes se les
> transmite únicamente el `## Contrato`. Consulta `.rei/docs/harness/adapters.md`.

**No ignores estas reglas.**

---

# 1. Antes de comenzar

Antes de realizar cualquier modificación en el proyecto:

1. Ejecuta `rei check --quiet`.
2. Si falla, DETENTE e informa el problema.
3. Carga únicamente la documentación necesaria para la tarea actual siguiendo el orden de la Sección 8.

No continúes hasta completar estos pasos.

---

# 2. Propósito del proyecto

## Qué construimos

PetHogar es una plataforma web que centraliza la adopción de mascotas en fundaciones y refugios: publicación de animales con historial médico, solicitudes de adopción con criterios uniformes, seguimiento post-adopción con alertas, registro de donaciones y reportes en PDF/gráficas. Sustituye la gestión dispersa en redes sociales, WhatsApp, papel y hojas de cálculo.

## Para quién

- **Fundaciones / refugios** (usuario principal, uso frecuente): gestionan fichas e historial médico, evalúan solicitudes, programan y registran seguimientos, registran donaciones y generan sus reportes.
- **Adoptantes** (usuarios secundarios): personas sin conocimientos técnicos que buscan mascotas, envían solicitudes y reportes de seguimiento, registran donaciones y consultan notificaciones.
- **Otros:** el administrador de la plataforma (valida fundaciones, gestiona cuentas y consulta estadísticas globales) y el contexto académico del proyecto (Universidad de Córdoba, 2026).

## Principios

*Todas las decisiones deben respetar estos principios.*

- **Simplicidad para no técnicos** — Mensajes claros en español, confirmaciones explícitas y accesibilidad WCAG 2.1.
- **Trazabilidad de decisiones** — Cada aprobación o rechazo queda registrado con su observación; las operaciones críticas (p. ej. aprobar una adopción) son atómicas.
- **Privacidad y seguridad** — Tratamiento de datos conforme a la Ley 1581 de 2012, contraseñas con bcrypt, JWT con control de acceso por rol; nunca se exponen entidades crudas ni contraseñas.
- **Funciona en local primero** — Todo arranca con Docker Compose y el flujo completo es demostrable de punta a punta en local.
- **Modularidad** — Monolito modular: cada módulo es cohesivo y no se acopla a los detalles internos de otros.

## Qué NO es

*Acota explícitamente el alcance del proyecto para evitar feature creep.*

- No es una pasarela de pagos: las donaciones solo se registran con su comprobante.
- No incluye contenerización de las apps ni despliegue a producción en esta etapa: solo funcionamiento en local.

---

# 3. Stack técnico

## Tecnologías principales

- **Lenguaje:** TypeScript, en un monorepo con pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`).
- **Framework:** NestJS para la API (`apps/api`, puerto 3001); Next.js (App Router) con Tailwind y shadcn/ui para la web (`apps/web`, puerto 3000).
- **Base de datos:** PostgreSQL 16 con TypeORM y migraciones (`synchronize` desactivado).
- **Testing:** Jest (api), Vitest + Testing Library (web), Playwright (e2e).
- **Despliegue:** solo local con Docker Compose (PostgreSQL + Mailpit); sin despliegue a producción en esta etapa.

## Comandos principales

*Comandos que cualquier agente utilizará con frecuencia. Todavía no existe código: los comandos son los previstos por el plan.*

- `docker compose up -d` y `pnpm dev` — Desarrollo: levanta PostgreSQL + Mailpit, y front y back a la vez (previsto, aún no existe).
- `pnpm test` / `pnpm --filter api test` / `pnpm --filter web test` — Tests (previsto, aún no existe).
- `pnpm lint` — Linter, ESLint + Prettier compartidos (previsto, aún no existe).
- `pnpm build` — Build (previsto, aún no existe).
- `pnpm --filter api migration:run` — Migraciones de base de datos (previsto, aún no existe).

---

# 4. Estructura del repositorio

*Utiliza este mapa para orientarte dentro del proyecto.*

| Ruta | Propósito |
|------|-----------|
| `apps/api/` | API REST en NestJS: un módulo por dominio, migraciones y pruebas (Jest). *Previsto, aún no existe.* |
| `apps/web/` | Web en Next.js (App Router), estructura feature-first y pruebas (Vitest, Playwright). *Previsto, aún no existe.* |
| `packages/shared/` | Tipos y esquemas compartidos entre api y web (opcional). *Previsto, aún no existe.* |
| `docker-compose.yml` | Entorno local: PostgreSQL 16 + Mailpit. *Previsto, aún no existe.* |
| `.rei/specs/` | Work Items y planificación del REI Harness. |
| `.rei/progress/` | Estado actual (`current.md`), historial general (`history.md`) y detalle de Work Items. |
| `.rei/progress/work-items/` | Registros detallados de cada Work Item, organizados cronológicamente. |
| `.rei/docs/harness/` | Documentación del arnés (workflow, specs, progreso). |
| `.rei/docs/project/` | Documentación específica del proyecto. |
| `.rei/agents/` | Roles y comportamiento de los subagentes (frontmatter + `## Contrato` + `## Referencia`). |
| `.rei/adapters/` | Adaptadores de runtime (plantilla + mapa de herramientas); p. ej. `opencode/`. |
| `.rei/templates/` | Plantillas canónicas (`current.md`, `history.md`, `meta.json`). Fuente única de verdad. |

---

# 5. Workflow

Todo Work Item debe seguir el workflow definido por el proyecto.

Antes de comenzar cualquier trabajo consulta:

`.rei/docs/harness/workflow.md`

**No omitas ninguna etapa del workflow.**

### Modo directo autorizado

El **modo directo** es una vía fuera del workflow de Work Items —no un tipo ni un
estado— para que el Leader aplique un cambio trivial solicitado explícitamente.
Solo se activa si el usuario pide un «cambio directo» o «sin Work Item»; el
Leader nunca lo inicia por iniciativa propia.

- **Elegible:** documentación, erratas, formato, comentarios o ajustes triviales
  sin cambio de comportamiento.
- **Negativa:** si afecta comportamiento, seguridad, datos, dependencias, API
  pública, arquitectura, más de un archivo o necesita especificación o revisión,
  el Leader se niega y ofrece Task o Feature. La insistencia del usuario no es
  autorización: no hay override.
- **Autorización:** aun siendo elegible, el Leader pide confirmación explícita e
  informa de que no habrá planificación, rama ni registro. Si duda, avisa y exige
  esa confirmación; el defecto es **no** aplicar el modo directo.
- **Sin registro:** no crea Work Item, spec, `meta.json`, `current.md`,
  `history.md`, `direct.md`, sesión, issue ni rama, ni altera Work Items
  existentes; opera sobre la rama y el árbol actuales y su única traza es el
  diff/commit y la conversación.
- **Verificación:** siempre `rei check` y, según el cambio, los checks del
  proyecto declarados en `.rei/config.json`/`verification.md`; el Leader reporta
  comandos y resultado. Sin Reviewer salvo petición explícita del usuario.
- **Entrega:** sin una orden explícita no hay commit, push, PR ni merge.

Esta es la única excepción a «no omitas etapas» y a la prohibición de implementar
del rol Leader; el resto de reglas duras sigue vigente. Ver
`.rei/docs/harness/workflow.md`.

---

# 6. Rol del agente principal

El agente que recibe directamente las solicitudes del usuario actúa siempre como **Leader**.

Antes de comenzar cualquier tarea DEBE consultar:

`.rei/agents/leader.md`

El Leader es el único responsable de:

- comprender la solicitud del usuario;
- seleccionar el workflow adecuado;
- coordinar a los demás subagentes.

Ningún otro agente debe asumir estas responsabilidades.

Al delegar en un subagente, el Leader transmite únicamente la sección `## Contrato`
del rol correspondiente, nunca el archivo completo (`## Referencia` es detalle
opcional y no se envía). Si el runtime dispone de un adaptador nativo
(`rei init opencode`), el subagente recibe ese mismo Contrato como system prompt.

Si el usuario pide personalizar el proyecto (por ejemplo, «personaliza mi
proyecto»), el Leader NO crea un Work Item: delega directamente en el rol
`initializer` (`.rei/agents/initializer.md`) transmitiéndole su `## Contrato` y
espera a que finalice. En un runtime con adaptador nativo, el comando
`/personalize` ejecuta este mismo camino.

---

# 7. Documentación

Consulta únicamente la documentación necesaria para la tarea actual.

## Documentación de REI Harness

Define cómo funciona el arnés. No requiere personalización por proyecto.

| Si necesitas... | Consulta... |
|-----------------|-------------|
| Workflow | `.rei/docs/harness/workflow.md` |
| Spec Driven Development | `.rei/docs/harness/specs.md` |
| Sistema de progreso | `.rei/docs/harness/progress.md` |
| Estructura de `meta.json` | `.rei/docs/harness/meta.md` |
| Roles y adaptadores | `.rei/docs/harness/adapters.md` |
| El comportamiento de un agente | `.rei/agents/<role>.md` |

## Documentación del proyecto

Describe las reglas de **este repositorio**. Debe personalizarse al implementar REI Harness.

| Si necesitas... | Consulta... | Quién lo lee por defecto |
|-----------------|-------------|--------------------------|
| Arquitectura | `.rei/docs/project/architecture.md` | Implementer, Spec Author (diseño) |
| Convenciones | `.rei/docs/project/conventions.md` | Implementer |
| Verificación | `.rei/docs/project/verification.md` | Reviewer |

## Work Items

| Si necesitas... | Consulta... |
|-----------------|-------------|
| Un Work Item concreto | `.rei/specs/<work-item-id>/` |
| El comportamiento de un agente | `.rei/agents/<role>.md` |
No cargues documentación que no aporte contexto a la tarea actual.

---

# 8. Carga de contexto

Prioriza siempre la carga de información en el siguiente orden:

1. `AGENTS.md`
2. `.rei/agents/<role>.md`
3. `docs/...`
4. `.rei/specs/<work-item-id>/`

Carga únicamente el contexto necesario para completar la tarea actual.

---

# 9. Principios generales

Estas reglas aplican a cualquier agente del repositorio.

- La documentación es la fuente de verdad.
- Trabaja sobre un único Work Item por sesión. El **modo directo autorizado**
  (§5) es la excepción: no abre ni modifica Work Items ni sesión, y solo se usa
  con disparador y confirmación explícitos.
- No omitas etapas del workflow.
- Consulta la documentación antes de asumir comportamientos no especificados.
- Si encuentras documentación contradictoria, DETENTE y repórtala.
- Para conocer el estado de la sesión o de los Work Items, usa el CLI (`rei session`, `rei items status`); no escanees `meta.json` manualmente.
- No releas un archivo que ya esté en tu contexto; para localizar un dato concreto usa búsquedas en lugar de releer el archivo completo.
- En caso de conflicto entre documentos, prevalece el orden inverso de la Sección 8:
  `.rei/specs/<work-item-id>/` > `.rei/docs/...` > `.rei/agents/<role>.md` > `AGENTS.md`.
