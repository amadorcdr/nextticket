# Purchases Service — Guía de arranque y pruebas

Guía para levantar y probar el microservicio de compras (Módulo 6: Compra Simulada + Módulo 7: Bloqueo Temporal) en local.

## 1. Prerrequisitos

- **Node** v20+ y **pnpm** v11+ (`corepack enable` si no tienes pnpm)
- **Docker Desktop** corriendo

## 2. Levantar infraestructura (Postgres + Redis)

Desde `apps/backend/purchases-service`:

```bash
docker compose up -d
```

Esto crea dos contenedores: `purchases-db` (Postgres 16, puerto 5432, BD `purchases_db`) y `nextticket-redis` (Redis 7, puerto 6379).

## 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y deja la contraseña que usa el contenedor:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/purchases_db?schema=public"
```

## 4. Instalar dependencias y aplicar migraciones

```bash
pnpm install
pnpm exec prisma migrate dev
```

> Si ya tenías una BD vieja con otro esquema: `pnpm exec prisma migrate reset` (borra los datos) y vuelve a correr `migrate dev`.

## 5. Arrancar el servicio

```bash
pnpm start:dev
```

- API: `http://localhost:3004`
- Docs interactivas (Scalar): `http://localhost:3004/docs/purchases`
- Health: `http://localhost:3004/health`

## 6. Tests unitarios

```bash
pnpm test
```

## 7. Pruebas manuales del flujo completo (curl)

> También puedes hacer todas estas pruebas desde la UI de Scalar en `/docs/purchases`.

### 7.1 Crear un bloqueo temporal (TTL 8 minutos)

```bash
curl -X POST http://localhost:3004/purchases/temporary-blocks \
  -H "Content-Type: application/json" \
  -d '{
    "userId":  "550e8400-e29b-41d4-a716-446655440000",
    "eventZoneId": "a9ec1978-75f6-4432-9476-edf3835938c5",
    "eventSeatId": "cf3d2b7b-b24f-4468-b906-350c35c4764b"
  }'
```

**Esperado:** `201` con `status: "ACTIVE"` y `expiresAt` = 8 minutos después. Guarda el `id` (lo usarás como `temporaryBlockIds` en la compra).

### 7.2 Concurrencia: mismo asiento, otro usuario

Repite el mismo request con otro `userId`. **Esperado:** `409 Conflict` (lock atómico en Redis).

### 7.3 Bloqueos activos del usuario (con TTL en vivo)

```bash
curl http://localhost:3004/purchases/temporary-blocks/user/550e8400-e29b-41d4-a716-446655440000
```

**Esperado:** lista con `ttlSeconds` (contador real de Redis).

### 7.4 Compra con pago APROBADO

```bash
curl -X POST http://localhost:3004/purchases \
  -H "Content-Type: application/json" \
  -d '{
    "userId":  "550e8400-e29b-41d4-a716-446655440000",
    "eventId": "550e8400-e29b-41d4-a716-446655440010",
    "temporaryBlockIds": ["<ID_DEL_BLOQUEO>"],
    "details": [{
      "eventZoneId": "a9ec1978-75f6-4432-9476-edf3835938c5",
      "eventSeatId": "cf3d2b7b-b24f-4468-b906-350c35c4764b",
      "unitPrice": 850, "discountAmount": 100, "taxAmount": 120
    }],
    "payment": {
      "paymentMethod": "CREDIT_CARD",
      "cardholderName": "QA Approved",
      "cardNumber": "4242424242424242",
      "expirationMonth": 12, "expirationYear": 2030, "cvv": "123"
    }
  }'
```

**Esperado:** `status: "CONFIRMED"`, `folio` secuencial (1000, 1001, …), totales que cumplen `net = gross − discount` y `total = net + tax` (850−100=750; 750+120=870), pago `APPROVED`, y el bloqueo pasa a `CONVERTED` (desaparece de la lista de activos).

### 7.5 Tarjetas de prueba (simulación)

| Tarjeta | Resultado |
|---|---|
| `4242424242424242` (o cualquier otra) | ✅ Aprobada |
| Empieza con `400000` (ej. `4000001111222233`) | ❌ Declinada (`SIM-DECLINED`) |
| Empieza con `510510` (ej. `5105105105105100`) | ❌ Fondos insuficientes (`SIM-INSUFFICIENT-FUNDS`) |

Con tarjeta rechazada la compra queda `CANCELED`, el pago `REJECTED` y el folio en `null`. `paymentMethod: "CASH"` no pide datos de tarjeta.

> ⚠️ Es una pasarela 100% simulada. **Nunca ingreses datos de una tarjeta real.** El número y CVV no se guardan en la base de datos.

### 7.6 Liberación automática por timeout

Los bloqueos expiran solos: la llave de Redis muere a los 8 min y un cron (cada 30 s) marca el registro como `EXPIRED` en Postgres — sin llamar a ningún endpoint. Para liberar manualmente antes:

```bash
curl -X DELETE http://localhost:3004/purchases/temporary-blocks/<ID_DEL_BLOQUEO>
```

### 7.7 Otras rutas

| Ruta | Qué hace |
|---|---|
| `GET /purchases` | Lista compras (con caché Redis de 30 s) |
| `GET /purchases/:id` | Detalle con `details` y `payments` |
| `PATCH /purchases/:id` | Actualiza estado |
| `DELETE /purchases/:id` | Cancela (soft-cancel, no borra) |
| `POST /purchases/temporary-blocks/expire` | Fuerza la expiración (el cron ya lo hace solo) |

## 8. Apagar todo

```bash
# Ctrl+C para el servicio, luego:
docker compose down        # conserva los datos
docker compose down -v     # borra también los datos
```

## Notas

- Los UUIDs de zona/asiento son **referencias opacas** a venues-events-service; mientras no exista la parte de eventos, cualquier UUID v4 válido funciona para probar.
- A través del API Gateway (si está corriendo en :3001) las mismas rutas responden en `http://localhost:3001/purchases/...`.
