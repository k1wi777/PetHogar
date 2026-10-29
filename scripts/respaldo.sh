#!/usr/bin/env bash
# Respaldo de PetHogar: volcado de PostgreSQL (pg_dump -Fc) y copia de uploads/, con marca de tiempo UTC.
#
#   scripts/respaldo.sh
#
# Variables (del entorno o de apps/api/.env): DATABASE_HOST, DATABASE_PORT, DATABASE_USER,
# DATABASE_PASSWORD, DATABASE_NAME, UPLOADS_DIR, BACKUP_DIR (por defecto ./respaldos),
# BACKUP_RETENCION_DIAS (14) y PG_MODO (auto | host | docker). Ver docs/operacion.md.
set -euo pipefail
# shellcheck source=scripts/entorno.sh
source "$(dirname "${BASH_SOURCE[0]}")/entorno.sh"

mkdir -p "$BACKUP_DIR"
sello="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$BACKUP_DIR/pethogar-$sello.dump"
uploads="$BACKUP_DIR/uploads-$sello.tar.gz"

# Se escribe en un archivo temporal y se renombra al terminar: nunca queda un respaldo a medias.
limpiar() { rm -f "$dump.tmp" "$uploads.tmp"; }
trap limpiar EXIT

pg pg_dump -Fc "$DATABASE_NAME" > "$dump.tmp"
[ -s "$dump.tmp" ] || { echo "Error: el volcado de la base está vacío." >&2; exit 1; }
mv "$dump.tmp" "$dump"
echo "Base de datos respaldada en $dump"

if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "$uploads.tmp" -C "$UPLOADS_DIR" .
  mv "$uploads.tmp" "$uploads"
  echo "Archivos respaldados en $uploads"
else
  echo "Aviso: no existe $UPLOADS_DIR; solo se respaldó la base de datos." >&2
fi

# Rotación: borra los respaldos más antiguos que la retención.
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'pethogar-*.dump' -o -name 'uploads-*.tar.gz' \) \
  -mtime "+$BACKUP_RETENCION_DIAS" -print -delete | sed 's/^/Rotado: /'
