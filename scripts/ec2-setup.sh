#!/usr/bin/env bash
#
# ec2-setup.sh — Deja una instancia Ubuntu recién creada lista para NextTicket
# =============================================================================
# Instala Docker, clona el repositorio y levanta el stack completo.
#
# Se ejecuta UNA VEZ, dentro de la instancia:
#
#   curl -fsSL https://raw.githubusercontent.com/amadorcdr/nextticket/develop/scripts/ec2-setup.sh | bash
#
# o, si el repositorio es privado, se copia a mano y se corre con:  bash ec2-setup.sh
#
# Es idempotente: se puede volver a correr sin romper nada.
# =============================================================================

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/amadorcdr/nextticket.git}"
RAMA="${RAMA:-develop}"
DESTINO="${DESTINO:-$HOME/nextticket}"

echo "══════════════════════════════════════════════"
echo " NextTicket — preparación de la instancia"
echo "══════════════════════════════════════════════"

# ─── 1. Paquetes base ────────────────────────────────────────────────────────
echo "→ Actualizando paquetes…"
sudo apt-get update -qq
sudo apt-get install -y -qq git curl ca-certificates

# ─── 2. Docker ───────────────────────────────────────────────────────────────
if command -v docker >/dev/null 2>&1; then
  echo "→ Docker ya está instalado, se omite."
else
  echo "→ Instalando Docker…"
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg

  # El repositorio de Docker tarda meses en publicar paquetes para una versión
  # de Ubuntu recién salida. Si la de esta máquina no está, se usa la última
  # LTS soportada: los paquetes son compatibles.
  CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
  if ! curl -fsI "https://download.docker.com/linux/ubuntu/dists/${CODENAME}/Release" >/dev/null 2>&1; then
    echo "   Docker aún no publica para '${CODENAME}'; se usa 'noble' (24.04 LTS)."
    CODENAME=noble
  fi

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  sudo apt-get update -qq
  if ! sudo apt-get install -y -qq \
       docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
    # Último recurso: el Docker que trae Ubuntu. Versión más vieja, pero
    # suficiente, y así el despliegue no se queda bloqueado.
    echo "   Falló el repositorio de Docker; se instala el de Ubuntu."
    sudo apt-get install -y -qq docker.io docker-compose-v2
  fi

  # Para no tener que escribir sudo en cada comando de docker.
  sudo usermod -aG docker "$USER"
fi

# Docker debe arrancar solo cuando la instancia se encienda: sin esto, cada vez
# que el laboratorio reinicie la máquina habría que entrar a levantarlo a mano.
sudo systemctl enable --now docker

# ─── 3. Memoria de intercambio ───────────────────────────────────────────────
# Compilar los cinco servicios consume más RAM de la que tiene una t3.medium en
# los picos. Sin swap, el compilador muere con "Killed" y el build falla sin
# explicación clara.
if [ ! -f /swapfile ]; then
  echo "→ Creando 4 GB de swap para que la compilación no se quede sin memoria…"
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# ─── 4. Código ───────────────────────────────────────────────────────────────
if [ -d "$DESTINO/.git" ]; then
  echo "→ El repositorio ya existe, actualizando…"
  git -C "$DESTINO" fetch origin --quiet
  git -C "$DESTINO" checkout "$RAMA" --quiet
  git -C "$DESTINO" pull --ff-only origin "$RAMA"
else
  echo "→ Clonando el repositorio…"
  git clone --branch "$RAMA" "$REPO_URL" "$DESTINO"
fi

cd "$DESTINO"

# ─── 5. Variables ────────────────────────────────────────────────────────────
if [ -f .env ]; then
  echo "→ .env ya existe, se conserva."
else
  echo "→ Creando .env a partir del ejemplo…"
  cp .env.prod.example .env

  # Secretos generados en la propia máquina: nunca viajan por el repositorio
  # ni quedan en el historial del chat.
  JWT=$(openssl rand -base64 48 | tr -d '\n')
  DBPASS=$(openssl rand -base64 24 | tr -d '\n/+=')

  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DBPASS}|" .env

  echo
  echo "  ⚠  Falta poner FRONTEND_URL en .env cuando el sitio de S3 esté publicado."
  echo
fi

# ─── 6. Arranque ─────────────────────────────────────────────────────────────
echo "→ Construyendo las imágenes. La primera vez tarda entre 10 y 20 minutos…"
sudo docker compose -f docker-compose.prod.yml build

echo "→ Levantando el stack…"
sudo docker compose -f docker-compose.prod.yml up -d

# ─── 7. Comprobación ─────────────────────────────────────────────────────────
echo "→ Esperando a que el gateway responda…"
for intento in $(seq 1 40); do
  if curl -fsS --max-time 3 http://localhost:3001/health >/dev/null 2>&1; then
    echo
    echo "══════════════════════════════════════════════"
    echo " Listo. El gateway responde."
    echo
    IP=$(curl -fsS --max-time 5 http://checkip.amazonaws.com 2>/dev/null || echo "IP-DE-TU-INSTANCIA")
    echo "   API pública:  http://${IP}:3001"
    echo
    echo " Pega esa URL en apps/alexa-skill/index.js, en API_URL_FIJA,"
    echo " y haz Deploy en el Alexa Developer Console."
    echo "══════════════════════════════════════════════"
    exit 0
  fi
  sleep 5
done

echo
echo "El gateway no respondió a tiempo. Revisa qué pasó con:"
echo "   sudo docker compose -f docker-compose.prod.yml ps"
echo "   sudo docker compose -f docker-compose.prod.yml logs --tail 50"
exit 1
