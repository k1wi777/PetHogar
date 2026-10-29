# Arquitectura

> **Documento del proyecto** — PetHogar.
>
> Este documento define las decisiones arquitectónicas del proyecto.
> El Implementer debe respetarlas durante la implementación y el Reviewer las utilizará como criterio de validación.

---

# Objetivo

Describe cómo está organizado el proyecto y las reglas arquitectónicas que deben mantenerse durante su evolución.

No documenta requisitos funcionales ni decisiones específicas de una Feature.

> Estado: todavía no existe código. La organización descrita es la prevista y debe respetarse desde la primera implementación.

---

# Principios

- **Monolito modular** — un módulo NestJS por dominio, cohesivo y con bajo acoplamiento.
- **Separación cliente-servidor** — la web solo se comunica con la API REST.
- **Contratos explícitos** — DTOs validados en la entrada y mapeo explícito en la salida.
- **Infraestructura detrás de interfaces** — almacenamiento y correo se acceden mediante interfaces, sustituibles sin tocar el dominio.
- **Simplicidad antes que complejidad; reutilizar antes que duplicar.**

---

# Organización del proyecto

```text
apps/api/           NestJS: un módulo por dominio (auth, usuarios, fundaciones, mascotas,
                    solicitudes/adopciones, seguimientos, donaciones, notificaciones, reportes)
                    + common/ (pipes, filtros, paginación) + migraciones
apps/web/           Next.js App Router: app/ (rutas),
                    features/<nombre>/{api,components,hooks,schemas,types},
                    shared/ (UI y utilidades comunes)
packages/shared/    Tipos y esquemas compartidos (opcional)
docker-compose.yml  PostgreSQL 16 + Mailpit
```

---

# Flujo general

```text
Usuario
    ↓
Next.js (SSR en catálogo y ficha; paneles por rol con TanStack Query)
    ↓  rewrites /api/*
Controller (NestJS)
    ↓
Service
    ↓
Repository
    ↓
PostgreSQL
```

Los efectos secundarios (notificaciones y correo) se disparan mediante eventos (`@nestjs/event-emitter`); las tareas periódicas (p. ej. vencimiento de seguimientos) se ejecutan con cron (`@nestjs/schedule`).

---

# Restricciones arquitectónicas

- Un módulo no usa el repository de otro: llama a su service o reacciona a un evento.
- Flujo obligatorio Controller → Service → Repository: sin lógica de negocio en los controllers ni acceso a la base de datos fuera de los repositories.
- Nunca se devuelven entidades crudas ni campos sensibles (p. ej. `contrasena`).
- El esquema solo cambia mediante migraciones TypeORM; `synchronize` siempre desactivado.
- En la web, las features no se importan entre sí; lo compartido va en `shared/`.
- Un fallo de correo o notificación no rompe la operación principal.
- Las operaciones que modifican varios agregados (p. ej. aprobar una adopción) se ejecutan en una sola transacción.
- Sin dependencias circulares entre módulos.

---

# Decisiones importantes

- **Autenticación:** JWT de acceso (15 min, en memoria) + refresh token (7 días, cookie `httpOnly`, rotado y guardado con hash). Control de acceso por rol: adoptante, fundación, administrador.
- **Comunicación:** API REST documentada con Swagger (`/api/docs`); same-origin en local mediante rewrites de Next.js; formato de error uniforme con filtro global de excepciones y paginación estándar (`page`, `limit`, respuesta con `total`).
- **Persistencia:** PostgreSQL 16 con TypeORM, enums nativos de Postgres e IDs `GENERATED ALWAYS AS IDENTITY`.
- **Estado en la web:** estado de servidor con TanStack Query; formularios con React Hook Form + Zod.
- **Archivos:** disco local (`uploads/`) detrás de `IStorageService`, sustituible por S3 o Cloudinary.
- **Correo:** Nodemailer (SMTP), con Mailpit en local.
- **PDF:** generación con pdfmake en el backend.

---

# Qué NO documentar

Este archivo NO debe contener:

- requisitos funcionales;
- decisiones temporales;
- planificación de Features;
- detalles de implementación concretos;
- cambios específicos de un Work Item.
