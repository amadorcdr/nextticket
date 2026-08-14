#!/usr/bin/env bash
#
# seed-alexa.sh — Da de alta las palabras clave para entrar desde Alexa
# =============================================================================
# Usa los mismos usuarios que crea scripts/seed-users.sh.
#
#   ./seed-alexa.sh          asigna las palabras y las muestra
#   ./seed-alexa.sh --list   solo muestra las que ya existen
#
# Requisitos: el contenedor nextticket-postgres corriendo y la migración
# add_alexa_seed ya aplicada.
# =============================================================================

set -euo pipefail

CONTAINER="nextticket-postgres"
DB="auth_db"
DB_USER="postgres"

psql_run() {
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB" -v ON_ERROR_STOP=1 "$@"
}

# ─── Comprobaciones previas ──────────────────────────────────────────────────

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "ERROR: el contenedor $CONTAINER no está corriendo."
  echo "       Levanta el proyecto con:  docker compose up -d"
  exit 1
fi

if ! psql_run -tAc \
  "SELECT 1 FROM information_schema.columns
   WHERE table_name = 'User' AND column_name = 'alexaSeed';" | grep -q 1; then
  echo "ERROR: la columna \"alexaSeed\" no existe todavía."
  echo "       Corre primero la migración:"
  echo "         cd apps/backend/auth-service && pnpm exec prisma migrate dev --name add_alexa_seed"
  exit 1
fi

# ─── Palabras clave ──────────────────────────────────────────────────────────
#
# Se guardan normalizadas (minúsculas, sin espacios ni acentos) porque así es
# como las manda la skill después de limpiar lo que dictó el usuario, y así es
# como las busca el backend.
#
#   correo                    guardada          se dice en voz alta
#
SEEDS=(
  "organizador@test.com|jaguarmorado|jaguar morado"
  "admin@test.com|faroazul|faro azul"
  "cliente@test.com|roblesereno|roble sereno"
  "validador@test.com|colibriblanco|colibrí blanco"
)

if [[ "${1:-}" != "--list" ]]; then
  echo "Asignando palabras clave…"
  echo

  for entry in "${SEEDS[@]}"; do
    IFS='|' read -r email seed spoken <<< "$entry"

    # psql imprime el valor de RETURNING y DESPUÉS la etiqueta "UPDATE 1",
    # así que hay que quedarse solo con la primera línea.
    updated=$(psql_run -tAc \
      "UPDATE \"User\" SET \"alexaSeed\" = '$seed' WHERE email = '$email' RETURNING 1;" \
      2>/dev/null | head -1 || true)

    if [[ "$updated" == "1" ]]; then
      printf '  %-24s -> "%s"\n' "$email" "$spoken"
    else
      printf '  %-24s -- NO EXISTE (corre antes scripts/seed-users.sh)\n' "$email"
    fi
  done
  echo
fi

# ─── Resultado ───────────────────────────────────────────────────────────────

echo "Palabras clave registradas ahora mismo:"
echo
psql_run -c \
  "SELECT u.email, r.name AS rol, u.\"alexaSeed\" AS palabra
   FROM \"User\" u
   JOIN \"Role\" r ON r.id = u.\"roleId\"
   WHERE u.\"alexaSeed\" IS NOT NULL
   ORDER BY r.name;"

cat <<'FIN'
Para probar el endpoint sin Alexa:

  curl -s -X POST http://localhost:3001/auth/alexa/seed \
    -H "Content-Type: application/json" \
    -d '{"seed":"jaguar morado"}'

Debe devolver { token, user }. El backend normaliza "jaguar morado" a
"jaguarmorado" antes de buscarlo, igual que hace la skill.
FIN
