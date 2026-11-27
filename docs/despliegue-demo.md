# Despliegue de la demo (Railway y Vercel)

Guía para publicar una **demo** de PetHogar sin dominio propio ni servidor de correo: la API y PostgreSQL en Railway y la web en Vercel. **No es un despliegue a producción** (ver las limitaciones del final); para eso falta, como mínimo, lo que lista `docs/operacion.md`.

> Esta guía no se ha ejecutado contra los proveedores. Lo que depende de su interfaz o de su infraestructura está redactado como **comprobación**: verifícalo al desplegar.

## 1. Cómo funciona

El navegador solo habla con la web. La web reenvía `/api/…` a la API (`API_PROXY_DESTINO`), así la cookie de sesión pertenece al dominio de la web y sobrevive a la recarga aunque `*.vercel.app` y `*.up.railway.app` sean sitios distintos. Las imágenes (`/uploads/…`) se cargan directamente desde Railway.

Tres variables activan el modo demo; sin ellas todo funciona como en local:

| Variable                  | Dónde | Por defecto | En la demo                         |
| ------------------------- | ----- | ----------- | ---------------------------------- |
| `API_PROXY_DESTINO`       | web   | sin definir | `https://<api>.up.railway.app/api` |
| `VERIFICACION_AUTOMATICA` | API   | `false`     | `true`                             |
| `CORREO_HABILITADO`       | API   | `true`      | `false`                            |

## 2. Orden de despliegue

1. PostgreSQL y API en Railway.
2. Comprobar que `https://<api>.up.railway.app/api/health` responde `{"status":"ok"}`.
3. Sembrar los datos dentro del contenedor de la API.
4. Web en Vercel (consulta la API al compilar o renderizar, por eso va después).
5. Fijar `FRONTEND_URL` con el origen real de la web y volver a desplegar la API.
6. Hacer las comprobaciones de la sección 6.

## 3. Railway: base de datos y API

### Servicios

- Un servicio **PostgreSQL** (en local se usa la versión 16: comprueba cuál crea Railway).
- Un servicio para la API desde el repositorio, con la **raíz del repositorio** como directorio (es un monorepo pnpm).

| Ajuste                    | Valor                                                     |
| ------------------------- | --------------------------------------------------------- |
| Compilación               | `pnpm --filter api build`                                 |
| Paso previo al despliegue | `pnpm --filter api migration:run`                         |
| Arranque                  | `pnpm --filter api start`                                 |
| Versiones                 | Node 24 y pnpm 11 (el `packageManager` de `package.json`) |
| Comprobación de salud     | `/api/health`                                             |

Comprueba en el registro de compilación que Node y pnpm son esas versiones y que **las devDependencies quedan instaladas**: la compilación usa Nest CLI, y las migraciones y el seed usan `ts-node`. Con `NODE_ENV=production` una instalación puede omitirlas; si faltan, usa como comando de instalación `pnpm install --frozen-lockfile --prod=false`.

El `/api/health` no consulta la base: las migraciones y el ingreso son la prueba de que la base responde.

### Volumen para los archivos

Fotos y documentos se guardan en disco. Crea un **volumen** en el servicio de la API (por ejemplo montado en `/data`) y define `UPLOADS_DIR=/data/uploads`. Sin volumen, los archivos se pierden en cada despliegue.

### Variables de la API

| Variable                                                                                | Valor                                                                                                                                                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PORT`                                                                                  | El puerto en el que escucha la API (p. ej. `3001`); comprueba que coincida con el del dominio público del servicio.                                                                  |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | Los del PostgreSQL de Railway **por la red privada** (la API no configura TLS hacia la base). Usa referencias a las variables del servicio de base de datos y comprueba sus nombres. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                               | Nuevos, distintos entre sí y de al menos 32 caracteres (`openssl rand -base64 48`).                                                                                                  |
| `NODE_ENV`                                                                              | `production` (la cookie de sesión se emite con `Secure`).                                                                                                                            |
| `FRONTEND_URL`                                                                          | Origen exacto de la web, sin barra final (`https://<web>.vercel.app`). Antes de tener la web, pon un valor provisional y corrígelo en el paso 5.                                     |
| `API_PUBLIC_URL`                                                                        | `https://<api>.up.railway.app`, **sin** `/api`: de ella salen las URL de las imágenes.                                                                                               |
| `UPLOADS_DIR`                                                                           | Dentro del volumen, p. ej. `/data/uploads`.                                                                                                                                          |
| `TRUST_PROXY`                                                                           | Ver «Límite de peticiones».                                                                                                                                                          |
| `CORREO_HABILITADO`                                                                     | `false`. No hace falta ninguna variable `SMTP_*`.                                                                                                                                    |
| `VERIFICACION_AUTOMATICA`                                                               | `true`. Sin ella nadie nuevo podría verificar su cuenta (la API lo advierte al arrancar).                                                                                            |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_DEMO_PASSWORD`                         | Correo del administrador y claves **propias** de al menos 10 caracteres. Nunca las de `.env.example`: la demo es pública. `SEED_ADMIN_TELEFONO` es opcional.                         |

Las migraciones (paso previo al despliegue) usan estas mismas variables.

### Límite de peticiones (`TRUST_PROXY`)

La API limita las peticiones por IP (5 ingresos o registros de adoptante por minuto). La cadena prevista es navegador, Vercel, Railway y API, pero **el número de saltos que llega en `X-Forwarded-For` no está verificado**.

1. Empieza con `TRUST_PROXY=2`.
2. Comprueba que dos redes distintas (p. ej. wifi y datos móviles) tienen contadores separados: agota los intentos de ingreso en una (respuesta de «demasiados intentos») y verifica que la otra puede ingresar. Si no, ajusta el número y repite.

La URL de Railway es pública y una llamada directa recorre un salto menos. Elige qué riesgo aceptas:

- Con `2`, quien llame directamente a la API podría falsear su IP con `X-Forwarded-For` y esquivar el límite.
- Con `1`, no se puede falsear (siempre que Railway añada la IP real), pero todos los visitantes que llegan a través de Vercel compartirían el mismo límite.

### Datos de demostración

Con la API desplegada, ejecuta **dentro del contenedor en marcha** (p. ej. con `railway ssh`):

```bash
pnpm --filter api seed:demo
```

Crea los datos base (roles, especies, razas y administrador) y los de demostración. Tiene que ejecutarse ahí porque escribe las fotos y los PDF en el volumen: no sirve ejecutarlo desde tu máquina ni en el paso previo al despliegue. Es repetible y no modifica cuentas ya creadas (cambiar después las claves `SEED_*` no cambia las contraseñas). Las cuentas creadas se describen en `docs/operacion.md`, sección 4.

## 4. Vercel: web

| Ajuste          | Valor                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Directorio raíz | `apps/web`, con acceso a los archivos de fuera de ese directorio (el monorepo: `pnpm-lock.yaml`, `tsconfig.base.json`, ESLint). |
| Framework       | Next.js                                                                                                                         |
| Versiones       | Node 24 y el pnpm de `packageManager` (comprueba en el registro de compilación).                                                |

| Variable               | Valor                                            |
| ---------------------- | ------------------------------------------------ |
| `API_PROXY_DESTINO`    | `https://<api>.up.railway.app/api` (con `/api`). |
| `NEXT_PUBLIC_API_URL`  | `/api`, exactamente.                             |
| `NEXT_PUBLIC_SITE_URL` | `https://<web>.vercel.app`                       |

`API_URL` no hace falta: las páginas renderizadas en el servidor usan `API_PROXY_DESTINO` (si defines `API_URL`, tiene prioridad). Si las variables son incoherentes, la compilación falla indicando cuál corregir.

El reenvío y las variables `NEXT_PUBLIC_*` **se fijan al compilar**: después de cambiar cualquiera de ellas hay que volver a compilar y desplegar.

Usa el dominio estable del proyecto. Un dominio de vista previa distinto de `FRONTEND_URL` no es el origen que la API tiene configurado.

## 5. Volver a desplegar la API

Cambia `FRONTEND_URL` al origen real de la web y vuelve a desplegar la API.

## 6. Comprobaciones posteriores

- [ ] El catálogo muestra las mascotas de ejemplo con sus fotos (cargadas desde el dominio de Railway).
- [ ] Registrar un adoptante muestra «Tu cuenta está activa» y se puede ingresar de inmediato.
- [ ] **Sesión:** tras ingresar, la cookie `refresh_token` pertenece al dominio de la web, con `HttpOnly`, `Secure`, `SameSite=Lax` y ruta `/api/auth`.
- [ ] **Sesión:** recargar la página mantiene la sesión; tras más de 15 minutos (vigencia del access token) la siguiente acción funciona sin volver a ingresar; cerrar sesión la termina.
- [ ] La descarga de una ficha en PDF funciona.
- [ ] **Carga de archivos:** las peticiones con archivos pasan por Vercel y su límite efectivo para el reenvío externo **no está verificado**. Envía un seguimiento con 5 fotos de unos 5 MB cada una; si falla, anótalo como limitación de la demo (y prueba con menos o menores).
- [ ] **IP del límite de peticiones:** la comprobación de dos redes de la sección 3.
- [ ] Tras volver a desplegar la API, las fotos siguen ahí (el volumen funciona).

## 7. Limitaciones de la demo

- **No se envía ningún correo.** La recuperación de contraseña no funciona (la pantalla responde igual, pero el código nunca llega), ni los avisos por correo; las notificaciones dentro de la aplicación sí se crean. La API registra en el log un error por cada aviso que habría ido por correo.
- **Fundaciones:** el correo que avisa de la aprobación o el rechazo no llega; hay que avisarles por fuera.
- **Correos ajenos:** con la verificación automática cualquiera puede registrar una cuenta con un correo que no es suyo.
- **Cuentas anteriores sin verificar:** las creadas antes de activar la verificación automática siguen sin verificar y no pueden ingresar.
- **Límite de peticiones:** tras dos proxies puede agrupar a varios visitantes o permitir falsear la IP, según `TRUST_PROXY` (sección 3). Además, las páginas renderizadas en el servidor llegan todas con la IP del servidor de la web.
- **Datos:** no uses datos personales reales (Ley 1581 de 2012); no hay respaldos programados.
