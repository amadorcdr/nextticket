# auth-service — imagen de producción
# ============================================================================
# Se construye desde la RAÍZ del repositorio:
#   docker build -f apps/backend/auth-service/Dockerfile -t nextticket/auth-service .
#
# Debian y no Alpine: el motor de Prisma necesita glibc y OpenSSL 3, y en
# Alpine hay que pelearse con los binarios de musl para nada.
# ============================================================================

# ─── Etapa de compilación ────────────────────────────────────────────────────
FROM node:22-slim AS builder

# openssl lo pide el motor de Prisma al generar el cliente.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

# Sin esto pnpm intenta purgar node_modules de forma interactiva al detectar
# que el lockfile y el árbol no coinciden, y aborta por no tener terminal.
ENV CI=true

# prisma.config.ts exige DATABASE_URL, y el postinstall del paquete ejecuta
# `prisma generate` durante la instalación. Generar el cliente NO se conecta a
# ninguna base: solo lee el schema. Esta URL es un relleno para que la variable
# resuelva; la real llega por el entorno en la imagen final.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

# Primero solo los manifiestos: si no cambian, Docker reutiliza la capa de
# dependencias y la construcción tarda segundos en vez de minutos.
COPY apps/backend/auth-service/package.json apps/backend/auth-service/pnpm-lock.yaml ./
COPY apps/backend/auth-service/prisma ./prisma
COPY apps/backend/auth-service/prisma.config.ts ./prisma.config.ts
# pnpm 11 ignora por defecto los scripts de instalación de las dependencias y
# termina con error. Aquí SÍ hacen falta: el de @prisma/engines coloca el motor
# de consultas. Dentro de una imagen de construcción, reproducible y desechable,
# permitirlos es seguro.
RUN pnpm config set dangerouslyAllowAllBuilds true \
    && pnpm install --frozen-lockfile

COPY apps/backend/auth-service/ ./
RUN pnpm run build

# ─── Imagen final ────────────────────────────────────────────────────────────
FROM node:22-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends openssl curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

# node_modules viene de la etapa anterior: incluye el cliente de Prisma ya
# generado y el CLI que hace falta para aplicar migraciones al arrancar.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# No corre como root: si alguien logra ejecutar algo dentro, no es dueño de nada.
USER node

EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS http://localhost:3002/health || exit 1

# Las migraciones se aplican al arrancar: así una instancia nueva o una
# base recién creada quedan al día sin pasos manuales. `migrate deploy`
# solo aplica lo pendiente y nunca borra datos.
# nest build emite en dist/main.js o en dist/src/main.js según lo que abarque
# el rootDir: basta un .ts en la raíz del servicio (prisma.config.ts) para que
# cambie. Se resuelve en tiempo de arranque en vez de fijar una ruta que se
# rompe sola cuando alguien agrega o quita un archivo.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node $(test -f dist/main.js && echo dist/main.js || echo dist/src/main.js)"]
