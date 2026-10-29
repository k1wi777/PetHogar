#!/usr/bin/env bash
# Utilidades comunes de los scripts de respaldo y restauración (se incluye con `source`).
# Lee apps/api/.env sin pisar las variables que ya estén definidas en el entorno.

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cargar_env() {
  local archivo="$RAIZ/apps/api/.env" linea clave valor
  [ -f "$archivo" ] || return 0
  while IFS= read -r linea || [ -n "$linea" ]; do
    [[ "$linea" =~ ^[[:space:]]*([A-Z][A-Z0-9_]*)=(.*)$ ]] || continue
    clave="${BASH_REMATCH[1]}"
    valor="${BASH_REMATCH[2]}"
    valor="${valor%\"}"; valor="${valor#\"}"
    [ -z "${!clave+x}" ] && export "$clave=$valor"
  done < "$archivo"
  return 0
}

cargar_env

: "${DATABASE_HOST:=localhost}"
: "${DATABASE_PORT:=5432}"
: "${DATABASE_USER:=pethogar}"
: "${DATABASE_PASSWORD:=pethogar}"
: "${DATABASE_NAME:=pethogar}"
: "${UPLOADS_DIR:=./uploads}"
: "${BACKUP_DIR:=./respaldos}"
: "${BACKUP_RETENCION_DIAS:=14}"
# auto: herramientas del equipo si coinciden con la versión del servidor y, si no, las del contenedor de
# Docker Compose (servicio postgres); host | docker fuerzan uno.
: "${PG_MODO:=auto}"

# `UPLOADS_DIR` relativo se interpreta desde apps/api (como la API).
case "$UPLOADS_DIR" in
  /*) ;;
  *) UPLOADS_DIR="$RAIZ/apps/api/${UPLOADS_DIR#./}" ;;
esac

# Versión mayor del servidor al que apunta la conexión (vacío si no se puede consultar con el psql del equipo).
version_servidor() {
  local num
  num="$(PGPASSWORD="$DATABASE_PASSWORD" psql -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" \
    -d postgres -tAc 'SHOW server_version_num' 2> /dev/null || true)"
  [[ "$num" =~ ^[0-9]+$ ]] && echo "$((num / 10000))"
  return 0
}

# Un volcado solo es restaurable con herramientas de la MISMA versión mayor que el servidor (un
# pg_restore más nuevo emite parámetros que un servidor anterior no conoce). Por eso, en modo auto, se
# usan las del equipo solo si coinciden con el servidor y, si no, las del contenedor de Docker Compose.
USAR_DOCKER=""
usar_docker() {
  if [ -z "$USAR_DOCKER" ]; then
    case "$PG_MODO" in
      docker) USAR_DOCKER=si ;;
      host) USAR_DOCKER=no ;;
      *)
        USAR_DOCKER=si
        if command -v pg_dump > /dev/null 2>&1 && command -v psql > /dev/null 2>&1; then
          local cliente servidor
          cliente="$(pg_dump --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
          servidor="$(version_servidor)"
          [ -n "$servidor" ] && [ "$cliente" = "$servidor" ] && USAR_DOCKER=no
        fi
        ;;
    esac
  fi
  [ "$USAR_DOCKER" = si ]
}

# Ejecuta una herramienta de PostgreSQL (pg_dump, pg_restore, psql) con la conexión configurada.
# La contraseña viaja solo por PGPASSWORD del proceso hijo: nunca se imprime ni va en argumentos.
pg() {
  local herramienta="$1"; shift
  if usar_docker; then
    docker compose -f "$RAIZ/docker-compose.yml" exec -T postgres "$herramienta" -U "$DATABASE_USER" "$@"
  else
    PGPASSWORD="$DATABASE_PASSWORD" "$herramienta" -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" "$@"
  fi
}
