#!/usr/bin/env bash
# Restaura un respaldo de PetHogar en una base NUEVA (nunca sobrescribe una existente).
#
#   scripts/restaurar.sh <volcado.dump> <base-destino> [<uploads.tar.gz> <directorio-destino>]
#
# Usa las mismas variables de conexión que respaldo.sh. Ver docs/operacion.md.
set -euo pipefail
# shellcheck source=scripts/entorno.sh
source "$(dirname "${BASH_SOURCE[0]}")/entorno.sh"

if [ "$#" -ne 2 ] && [ "$#" -ne 4 ]; then
  echo "Uso: $0 <volcado.dump> <base-destino> [<uploads.tar.gz> <directorio-destino>]" >&2
  exit 2
fi
dump="$1"
destino="$2"

[ -f "$dump" ] || { echo "Error: no existe el volcado $dump" >&2; exit 2; }
[[ "$destino" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || {
  echo "Error: el nombre de la base solo admite letras, números y guion bajo." >&2
  exit 2
}

existe="$(pg psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$destino'")"
if [ "$existe" = "1" ]; then
  echo "Error: la base $destino ya existe; elige otro nombre o bórrala antes." >&2
  exit 1
fi

pg psql -d postgres -v ON_ERROR_STOP=1 -qc "CREATE DATABASE \"$destino\""
if ! pg pg_restore --no-owner --no-privileges --exit-on-error -d "$destino" < "$dump"; then
  echo "Error: falló la restauración; se elimina la base $destino incompleta." >&2
  pg psql -d postgres -qc "DROP DATABASE IF EXISTS \"$destino\" WITH (FORCE)" || true
  exit 1
fi
echo "Base de datos restaurada en $destino"

if [ "$#" -eq 4 ]; then
  mkdir -p "$4"
  tar -xzf "$3" -C "$4"
  echo "Archivos restaurados en $4"
fi
