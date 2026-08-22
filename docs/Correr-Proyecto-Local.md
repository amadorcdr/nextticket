# Cómo correr NextTicket en local

Guía rápida y directa: solo los pasos para dejar el proyecto corriendo en tu
máquina. Para convenciones de equipo, Git Flow y detalle de arquitectura ver
[README.md](../README.md) y [ARCHITECTURE.md](ARCHITECTURE.md).

## 0. Requisitos

- **Docker Desktop** corriendo (Postgres + Redis viven en contenedores).
- **Node.js** v20 o superior.
- **pnpm** v11.x o superior — para el backend (`npm i -g pnpm` si no lo tienes).
- **npm** v10.x o superior — para el frontend (ya viene con Node).

```bash
node -v
pnpm -v
npm -v
docker -v
```

## 1. Clonar e instalar

```bash
git clone <url-del-repositorio>
cd nextticket
```

## 2. Levantar la infraestructura (Postgres + Redis)

Desde la raíz del repo:

```bash
docker compose up -d
```

Esto levanta **un solo Postgres** con las cuatro bases (`auth_db`,
`venues_events_db`, `purchases_db`, `tickets_db`) — las crea
`docker/init-databases.sql` la primera vez — y Redis. Verifica que estén
arriba con `docker compose ps`.

## 3. Configurar el backend

### 3.1 Crear los `.env` de cada microservicio

```bash
for s in api-gateway auth-service venues-events-service purchases-service tickets-service; do
  cp apps/backend/$s/.env.example apps/backend/$s/.env
done
```

(En PowerShell, si el `for` de bash no te funciona, cópialos uno por uno con
`Copy-Item apps\backend\auth-service\.env.example apps\backend\auth-service\.env`,
repitiendo para cada carpeta.)

Los valores por defecto de cada `.env.example` ya sirven para correr en
local tal cual (incluyendo un admin de arranque `admin@nextticket.com` /
`Admin123!` y una cuenta de correo de prueba automática si no configuras
SMTP). Lo único que debes cuidar:

> ⚠️ **`JWT_SECRET` debe ser el mismo valor en los 4 servicios que lo usan**
> (`auth-service`, `venues-events-service`, `purchases-service`,
> `tickets-service`) — si no coincide, los tokens que emite `auth-service` no
> se validan en los demás y todo da 401.

### 3.2 Instalar dependencias y aplicar migraciones (una vez por servicio)

```bash
cd apps/backend/auth-service
pnpm install
pnpm exec prisma migrate dev --name init
cd ../../..

cd apps/backend/venues-events-service
pnpm install
pnpm exec prisma migrate dev --name init
cd ../../..

cd apps/backend/purchases-service
pnpm install
pnpm exec prisma migrate dev --name init
cd ../../..

cd apps/backend/tickets-service
pnpm install
pnpm exec prisma migrate dev --name init
cd ../../..

cd apps/backend/api-gateway
pnpm install
cd ../../..
```

> 💡 Usa siempre `pnpm exec prisma ...`, nunca `npx prisma ...` — evita
> conflictos entre gestores de paquetes.

### 3.3 Levantar los 5 microservicios

Cada uno en su propia terminal:

```bash
# Terminal 1 — API Gateway (puerto 3001)
cd apps/backend/api-gateway && pnpm start:dev

# Terminal 2 — Auth Service (puerto 3002)
cd apps/backend/auth-service && pnpm start:dev

# Terminal 3 — Venues & Events (puerto 3003)
cd apps/backend/venues-events-service && pnpm start:dev

# Terminal 4 — Purchases Service (puerto 3004)
cd apps/backend/purchases-service && pnpm start:dev

# Terminal 5 — Tickets Service (puerto 3005)
cd apps/backend/tickets-service && pnpm start:dev
```

**Atajo en Windows:** una vez hecho el paso 3.2 (deps instaladas + `.env` +
migraciones), puedes abrir los 5 de un solo golpe, cada uno en su propia
ventana, con:

```bat
scripts\start-backend.bat
```

Espera a que los 5 digan `Nest application successfully started` (o revisa
`http://localhost:3001/health`) antes de seguir.

## 4. Sembrar usuarios de prueba

Con `auth-service` ya corriendo (puerto 3002), desde Git Bash o WSL:

```bash
bash scripts/seed-users.sh
```

Crea y activa 4 cuentas, cada una con su rol:

| Correo | Contraseña | Rol |
|---|---|---|
| `admin@test.com` | `Admin1234` | ADMIN |
| `organizador@test.com` | `Test1234` | ORGANIZER |
| `cliente@test.com` | `Cliente1234` | CLIENT |
| `validador@test.com` | `Valida1234` | VALIDATOR |

> Cada quien tiene su propio Postgres local, así que este script se corre
> una vez por máquina, no se comparte entre integrantes del equipo.

### 4.1 (Opcional) Datos de ejemplo — recintos y eventos

Si quieres recintos/eventos de prueba ya cargados en vez de partir de cero
(requiere que `organizador@test.com` ya exista, o sea, corre esto **después**
del paso 4):

```bash
cd apps/backend/venues-events-service
npx prisma db seed
cd ../../..
```

## 5. Levantar el frontend

```bash
cd apps/frontend
npm install
npm run dev
```

Esto arranca el `webshell` (único paquete con dev-server propio) en
**http://localhost:4000** — ahí vive toda la app; los demás paquetes de
`apps/frontend/apps/*` se compilan como parte de este mismo bundle, no
tienen puerto propio.

## 6. Ya está — entra y prueba

Abre **http://localhost:4000** e inicia sesión con cualquiera de las
cuentas del paso 4.

| Servicio | URL |
|---|---|
| Frontend | http://localhost:4000 |
| API Gateway | http://localhost:3001 |
| Docs Auth | http://localhost:3001/docs/auth |
| Docs Venues/Events | http://localhost:3001/docs/venues |
| Docs Purchases | http://localhost:3001/docs/purchases |
| Docs Tickets | http://localhost:3001/docs/tickets |

## Problemas comunes

- **401 en todo:** revisa que `JWT_SECRET` sea idéntico en los 4 `.env` que lo usan (ver paso 3.1).
- **Un microservicio no conecta a la base:** confirma que `docker compose ps` muestre Postgres y Redis como `healthy` antes de levantar los servicios.
- **`pnpm exec prisma migrate dev` falla por base inexistente:** vuelve a correr `docker compose up -d` — `docker/init-databases.sql` solo crea las 4 bases la primera vez que el volumen de Postgres se inicializa; si ya tenías un volumen viejo de otro proyecto, bórralo (`docker compose down -v`) y vuelve a levantarlo.
- **El frontend no encuentra el backend:** confirma que el API Gateway esté arriba en `:3001` — es el único puerto que el frontend llama directamente.
