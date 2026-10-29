# Convenciones

> **Documento del proyecto** — PetHogar.
>
> Este documento define las convenciones de desarrollo del proyecto.
> El Implementer debe seguirlas durante la implementación y el Reviewer las utilizará para validar la calidad del código.

---

# Objetivo

Mantener un estilo de desarrollo consistente en todo el proyecto.

Las convenciones describen **cómo escribir el código**, no cómo está organizada la arquitectura del sistema (ver `architecture.md`).

---

# Organización del código

- **API:** cada módulo en `apps/api/src/modules/<modulo>/` con `<modulo>.module.ts`, controllers, services, repositories, `entities`, `dto/` y, si aplica, `events/` y `listeners/`. Lo transversal (pipes, filtros, paginación) va en `src/common/`; las migraciones en `src/database/migrations/`.
- **Web:** cada feature en `features/<nombre>/{api,components,hooks,schemas,types}`; lo compartido en `shared/`; las rutas en `app/`.
- **Tests:** unitarios junto al archivo que prueban (`*.spec.ts` en api, `*.test.tsx` en web); e2e en `apps/api/test/` y `apps/web/e2e/`.

---

# Nombres

- **Idioma:** el dominio y los textos visibles van en **español**, siguiendo el ERS (`mascota`, `solicitud`, `contrasena`). Lo técnico va en inglés: sufijos de framework (`Controller`, `Service`, `Repository`, `Dto`) y nombres de eventos en pasado (`AdoptionApproved`).
- **Archivos:** kebab-case con sufijo de tipo (`solicitudes.service.ts`); componentes React en PascalCase (`MascotaCard.tsx`).
- **Código:** clases, componentes y tipos en PascalCase; funciones y variables en camelCase; constantes en UPPER_SNAKE_CASE.
- **Base de datos:** tablas y columnas en `snake_case`; propiedades en `camelCase` mediante la naming strategy de TypeORM.
- **Interfaces:** prefijo `I` solo en las interfaces de infraestructura intercambiables (p. ej. `IStorageService`); el resto sin prefijo.

---

# Estilo de implementación

- TypeScript en modo `strict`; sin `any` salvo justificación explícita.
- ESLint + Prettier compartidos desde la raíz y `.editorconfig`; el formato no se discute a mano.
- Funciones pequeñas y con una única responsabilidad; la lógica de negocio vive en los services, nunca en controllers ni componentes.
- Validación de entrada con `class-validator` en los DTOs de la API (`ValidationPipe` global con whitelist) y con Zod en los formularios de la web.
- Toda tarea de backend con lógica de negocio incluye sus pruebas unitarias.

---

# Manejo de errores

- API: excepciones HTTP de NestJS con mensajes claros **en español**; un filtro global de excepciones garantiza un formato uniforme, y los errores de validación devuelven mensajes por campo.
- No tragar excepciones ni dejar `catch` vacíos. Los fallos de correo o notificación se registran en el log sin romper la operación principal.
- Web: mensajes de éxito y error visibles para el usuario, páginas `error.tsx` y `not-found.tsx`, y estados de carga y vacío coherentes.

---

# Dependencias

- Usar primero el stack acordado (ver `AGENTS.md` §3 y `architecture.md`).
- Toda dependencia nueva se justifica en el `design.md` del Work Item.
- Se añade con `pnpm --filter <app> add` en el workspace que la usa; en la raíz solo herramientas compartidas.

---

# Comentarios

- En español.
- Solo para explicar decisiones no evidentes o reglas de negocio (p. ej. «al aprobar se rechazan las demás solicitudes pendientes»).
- No describir código evidente; eliminar los comentarios obsoletos.
- Los endpoints se documentan con Swagger y sus decoradores.

---

# Qué NO hacer

- Devolver entidades crudas o campos sensibles (p. ej. `contrasena`).
- Usar el repository de otro módulo o importar una feature desde otra.
- Activar `synchronize` o cambiar el esquema sin migración.
- Dejar código muerto o comentado, o `console.log` de depuración.
- Versionar secretos: se usa `.env`, con `.env.example` versionado.
- Mostrar al usuario mensajes en inglés o técnicos.
- Añadir dependencias sin justificación.
