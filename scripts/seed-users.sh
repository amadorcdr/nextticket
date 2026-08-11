#!/usr/bin/env bash
#
# Crea los usuarios de prueba de NextTicket en TU base local.
#
# Cada quien tiene su propio Postgres, así que estos usuarios no se comparten
# entre computadoras: cada integrante del equipo corre este script una vez.
#
# Requisitos: docker compose up -d  y  auth-service corriendo en el puerto 3002.
#
# Uso:  bash scripts/seed-users.sh

set -euo pipefail

AUTH_URL="${AUTH_URL:-http://localhost:3002}"
DB_CONTAINER="${DB_CONTAINER:-nextticket-postgres}"

echo "Sembrando usuarios de prueba en $AUTH_URL"
echo ""

if ! curl -sf --max-time 3 "$AUTH_URL/health" >/dev/null; then
  echo "ERROR: auth-service no responde en $AUTH_URL"
  echo "       Levántalo con: cd apps/backend/auth-service && pnpm start:dev"
  exit 1
fi

# ── 1. Registrar los usuarios por la API ────────────────────────────────────
# Se registran por la API (no por SQL) para que la contraseña quede hasheada
# con bcrypt igual que la de cualquier usuario real.

register() {
  local name="$1" email="$2" password="$3"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$AUTH_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$password\"}")

  case "$code" in
    201|200) echo "  creado    $email" ;;
    409)     echo "  ya existía $email" ;;
    *)       echo "  ERROR ($code) al crear $email"; return 1 ;;
  esac
}

register "Organizador Demo" "organizador@test.com" "Test1234"
register "Admin Demo"       "admin@test.com"       "Admin1234"
register "Cliente Demo"     "cliente@test.com"     "Cliente1234"
register "Validador Demo"   "validador@test.com"   "Valida1234"

# ── 2. Asignar los roles ────────────────────────────────────────────────────
# Todos nacen con rol CLIENT. El primer ADMIN no se puede crear por la API
# (haría falta un ADMIN para autorizarlo), así que se asigna por SQL una vez.
# De ahí en adelante los roles se reparten con PATCH /users/:id/role.

echo ""
echo "Asignando roles..."

assign_role() {
  local email="$1" role="$2"
  docker exec "$DB_CONTAINER" psql -U postgres -d auth_db -q -c \
    "UPDATE \"User\" SET \"roleId\" = (SELECT id FROM \"Role\" WHERE name = '$role') WHERE email = '$email';"
  echo "  $email → $role"
}

assign_role "organizador@test.com" "ORGANIZER"
assign_role "admin@test.com"       "ADMIN"
assign_role "validador@test.com"   "VALIDATOR"

echo ""
echo "Listo. Usuarios disponibles:"
echo ""
docker exec "$DB_CONTAINER" psql -U postgres -d auth_db -tAc \
  'SELECT u.email || E'"'"'\t'"'"' || r.name FROM "User" u JOIN "Role" r ON r.id = u."roleId" ORDER BY r.name;' \
  | sed 's/^/  /'

echo ""
echo "Contraseñas:"
echo "  organizador@test.com  Test1234     (para eventos, zonas, recintos)"
echo "  admin@test.com        Admin1234    (para gestionar usuarios y roles)"
echo "  cliente@test.com      Cliente1234  (para comprar)"
echo "  validador@test.com    Valida1234   (para validar boletos)"
