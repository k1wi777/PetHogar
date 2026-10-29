# Operación de PetHogar

Guía de operación para quien lleve PetHogar más allá del entorno local. Hoy el proyecto solo se despliega en local (Docker Compose); esta guía deja listo lo que habría que hacer para publicarlo.

## 1. Lista de verificación para HTTPS

- [ ] Terminar TLS en un proxy inverso (Nginx, Caddy o el balanceador del proveedor); la API y la web escuchan solo en la red interna.
- [ ] Redirigir todo el tráfico del puerto 80 al 443.
- [ ] Activar HSTS en el proxy (`Strict-Transport-Security: max-age=31536000; includeSubDomains`) una vez comprobado que todo funciona por HTTPS.
- [ ] Con `NODE_ENV=production` la cookie del refresh token se emite con `Secure`; comprobarlo en el navegador.
- [ ] Definir `TRUST_PROXY` con el número de proxies delante de la API (por ejemplo `1`). Sin él, el límite de peticiones ve la IP del proxy y no la del cliente; con un valor mayor al real, un cliente puede falsear su IP con `X-Forwarded-For`.
- [ ] `FRONTEND_URL` con `https://` y el dominio real: de él salen el origen CORS y los enlaces de los correos.
- [ ] Secretos nuevos y largos (mínimo 32 caracteres, distintos entre sí) para `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET`. Rotarlos invalida todas las sesiones, y es lo esperado.
- [ ] Base de datos y SMTP reales (no Mailpit), con credenciales propias y la base sin exponer a Internet.
- [ ] Cambiar la contraseña del administrador del seed y no ejecutar `seed:demo`.
- [ ] Rotación periódica de secretos y de las credenciales de base de datos y SMTP.

## 2. Respaldo y restauración

Los scripts viven en `scripts/` y leen `DATABASE_*`, `UPLOADS_DIR` y `BACKUP_DIR` del entorno o de `apps/api/.env`.

- Respaldo: `scripts/respaldo.sh`. Genera `respaldos/pethogar-<UTC>.dump` (`pg_dump -Fc`) y `respaldos/uploads-<UTC>.tar.gz`, escritos de forma atómica, y borra los de más de `BACKUP_RETENCION_DIAS` días (14 por defecto).
- Restauración: `scripts/restaurar.sh <volcado.dump> <base-destino> [<uploads.tar.gz> <directorio-destino>]`. Restaura sobre una base destino que debe indicarse de forma explícita.
- `PG_MODO=auto` (por defecto) usa `pg_dump` del anfitrión solo si su versión mayor coincide con la del servidor y, si no, ejecuta las herramientas dentro del contenedor `postgres` de Compose. Se fuerza con `PG_MODO=host` o `PG_MODO=docker`.
- Programación diaria (cron, 02:30):

  ```
  30 2 * * * cd /ruta/a/PetHogar && scripts/respaldo.sh >> respaldos/respaldo.log 2>&1
  ```

- Copiar `respaldos/` fuera del servidor. Probar la restauración en una base distinta con regularidad: un respaldo sin restaurar no está probado.
- Los volcados contienen datos personales (Ley 1581 de 2012): guardarlos cifrados y con acceso restringido.

## 3. Riesgos aceptados

- **Eventos at-most-once, sin outbox.** Los eventos de dominio se emiten tras el `COMMIT`; si el proceso cae justo en medio, la notificación o el correo se pierden. La operación de negocio sí queda consistente. Mitigación futura: patrón outbox.
- **Notificaciones sin retención.** La tabla `notificacion` crece sin límite. Política candidata, no implementada: borrar las leídas con más de 90 días y las no leídas con más de un año, con una tarea diaria por lotes.
- **Listeners sin límite de concurrencia.** Una ráfaga de eventos lanza sus listeners a la vez. Con el volumen previsto es aceptable.
- **Dependencias.** `pnpm audit --prod` informa de un `js-yaml` (moderado) y un `deepmerge` (bajo), ambos transitivos de herramientas de documentación y fuera de la ruta de ejecución de peticiones; se descartan. Revisar en cada actualización.
- **Limitador en memoria.** El `ThrottlerGuard` guarda contadores en el proceso: con varias instancias cada una cuenta aparte. Para escalar horizontalmente habría que pasar a un almacén compartido (Redis).
- **PDF en el proceso principal.** pdfmake renderiza de forma síncrona y bloquea el bucle de eventos (unos 1,6 s para 1000 filas, el máximo permitido). Los endpoints de PDF tienen un límite de 10 peticiones por minuto por IP. Mitigación futura: un worker.
