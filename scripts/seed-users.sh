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
AUTH_CONTAINER="${AUTH_CONTAINER:-nextticket-auth}"

# En un servidor el usuario no suele estar en el grupo docker hasta volver a
# iniciar sesión. Se detecta una vez y se antepone sudo solo si hace falta.
if docker info >/dev/null 2>&1; then
  DOCKER="docker"
else
  DOCKER="sudo docker"
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTH_SERVICE_DIR="$SCRIPT_DIR/../apps/backend/auth-service"

echo "Sembrando usuarios de prueba en $AUTH_URL"
echo ""

if ! curl -sf --max-time 3 "$AUTH_URL/health" >/dev/null; then
  echo "ERROR: auth-service no responde en $AUTH_URL"
  echo "       Levántalo con: cd apps/backend/auth-service && pnpm start:dev"
  exit 1
fi

# ── 1. Registrar los usuarios por la API ────────────────────────────────────
# Se registran por la API (no por SQL) para que la cuenta, el rol default
# (CLIENT) y el flujo de alta queden exactamente como los de un usuario real.
# RegisterDto ya NO acepta password: el registro crea la cuenta en PENDING
# (sin password) y normalmente se activa por el link que llega al correo.

register() {
  local name="$1" email="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$AUTH_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"email\":\"$email\"}")

  case "$code" in
    201|200) echo "  creado (PENDING) $email" ;;
    409)     echo "  ya existía        $email" ;;
    *)       echo "  ERROR ($code) al crear $email"; return 1 ;;
  esac
}

register "Organizador Demo" "organizador@test.com"
register "Admin Demo"       "admin@test.com"
register "Cliente Demo"     "cliente@test.com"
register "Validador Demo"   "validador@test.com"

# ── 2. Activar las cuentas (bypass de correo, SOLO desarrollo local) ───────
# El flujo real de activación exige el link que llega al correo configurado
# en auth-service/.env (SMTP_HOST). Para no depender de leer un inbox en un
# script de seed local, hasheamos la contraseña con el MISMO bcryptjs que usa
# auth-service (costo 10) y activamos por SQL directo — mismo tipo de bypass
# que ya usa este script para asignar el primer ADMIN (ver sección 2 más abajo).
# NUNCA hagas esto contra una base que no sea tu entorno local de desarrollo.

# El hash se calcula con bcryptjs. En una máquina de desarrollo está en
# node_modules del servicio; en un servidor donde todo corre en contenedores no
# hay Node instalado, así que se usa el del propio contenedor de auth.
hash_password() {
  local password="$1"
  local script="console.log(require('bcryptjs').hashSync(process.argv[1], 10))"

  if command -v node >/dev/null 2>&1 && [ -d "$AUTH_SERVICE_DIR/node_modules/bcryptjs" ]; then
    (cd "$AUTH_SERVICE_DIR" && node -e "$script" "$password")
  else
    $DOCKER exec "$AUTH_CONTAINER" node -e "$script" "$password"
  fi
}

activate_with_password() {
  local email="$1" password="$2"
  local hash
  hash=$(hash_password "$password")

  $DOCKER exec "$DB_CONTAINER" psql -U postgres -d auth_db -q -c \
    "UPDATE \"User\" SET password = '$hash', \"accountStatus\" = 'ACTIVE' WHERE email = '$email';" \
    >/dev/null
  echo "  activado  $email"
}

echo ""
echo "Activando cuentas (bypass de correo, solo dev local)..."
activate_with_password "organizador@test.com" "Test1234"
activate_with_password "admin@test.com"       "Admin1234"
activate_with_password "cliente@test.com"     "Cliente1234"
activate_with_password "validador@test.com"   "Valida1234"

# ── 3. Asignar los roles ────────────────────────────────────────────────────
# Todos nacen con rol CLIENT. El primer ADMIN no se puede crear por la API
# (haría falta un ADMIN para autorizarlo), así que se asigna por SQL una vez.
# De ahí en adelante los roles se reparten con PATCH /users/:id/role.

echo ""
echo "Asignando roles..."

assign_role() {
  local email="$1" role="$2"
  $DOCKER exec "$DB_CONTAINER" psql -U postgres -d auth_db -q -c \
    "UPDATE \"User\" SET \"roleId\" = (SELECT id FROM \"Role\" WHERE name = '$role') WHERE email = '$email';"
  echo "  $email → $role"
}

assign_role "organizador@test.com" "ORGANIZER"
assign_role "admin@test.com"       "ADMIN"
assign_role "validador@test.com"   "VALIDATOR"

echo ""
echo "Listo. Usuarios disponibles:"
echo ""
$DOCKER exec "$DB_CONTAINER" psql -U postgres -d auth_db -tAc \
  'SELECT u.email || E'"'"'\t'"'"' || r.name FROM "User" u JOIN "Role" r ON r.id = u."roleId" ORDER BY r.name;' \
  | sed 's/^/  /'

echo ""
echo "Contraseñas:"
echo "  organizador@test.com  Test1234     (para eventos, zonas, recintos)"
echo "  admin@test.com        Admin1234    (para gestionar usuarios y roles)"
echo "  cliente@test.com      Cliente1234  (para comprar)"
echo "  validador@test.com    Valida1234   (para validar boletos)"
