# tickets-service — imagen de producción
# ============================================================================
# Se construye desde la RAÍZ del repositorio:
#   docker build -f apps/backend/tickets-service/Dockerfile -t nextticket/tickets-service .
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

# Primero solo los manifiestos: si no cambian, Docker reutiliza la capa de
# dependencias y la construcción tarda segundos en vez de minutos.
COPY apps/backend/tickets-service/package.json apps/backend/tickets-service/pnpm-lock.yaml ./
COPY apps/backend/tickets-service/prisma ./prisma
COPY apps/backend/tickets-service/prisma.config.ts ./prisma.config.ts
RUN pnpm install --frozen-lockfile

COPY apps/backend/tickets-service/ ./
RUN pnpm run build

# ─── Imagen final ────────────────────────────────────────────────────────────
FROM node:22-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends openssl curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3005

# node_modules viene de la etapa anterior: incluye el cliente de Prisma ya
# generado y el CLI que hace falta para aplicar migraciones al arrancar.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# No corre como root: si alguien logra ejecutar algo dentro, no es dueño de nada.
USER node

EXPOSE 3005

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS http://localhost:3005/health || exit 1

# Las migraciones se aplican al arrancar: así una instancia nueva o una
# base recién creada quedan al día sin pasos manuales. `migrate deploy`
# solo aplica lo pendiente y nunca borra datos.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main"]
