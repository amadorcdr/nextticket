# Purchases Service — Guía de arranque y pruebas

Guía para levantar y probar el microservicio de compras (Módulo 6: Compra Simulada + Módulo 7: Bloqueo Temporal + Módulo 8: Fila Virtual) en local.

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

## 6.5 Fila Virtual (Módulo 8): flujo end-to-end

```bash
# 1. Unirse a la fila del evento (idempotente: repetir con la misma
#    idempotencyKey devuelve la misma entrada en vez de crear otra)
curl -X POST http://localhost:3004/purchases/queue/550e8400-e29b-41d4-a716-446655440010 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{ "idempotencyKey": "9f2b6e2a-0000-4000-8000-000000000001" }'
# → { queueEntryId, eventId, status: "WAITING", position, createdAt }

# 2. Consultar mi estado (poll cada pocos segundos desde el frontend)
curl http://localhost:3004/purchases/queue/550e8400-e29b-41d4-a716-446655440010/me \
  -H "Authorization: Bearer <TOKEN>"
# → status pasa de "WAITING" (con `position`) a "ADMITTED" (con `admissionExpiresAt`)
#   cuando el worker de BullMQ del evento te admite (hay cupo: menos de
#   MAX_CONCURRENT_ADMITTED_PER_EVENT admitidos vigentes).

# 3. Ya "ADMITTED", puedes crear un hold de asientos (sección 7.1). Si no
#    hay admisión vigente, el hold responde 403.
```

**Qué probar:**
- Unirse dos veces con la misma `idempotencyKey` → misma `queueEntryId`, no se duplica.
- Doble clic sin `idempotencyKey` (mismo usuario, mismo evento) → tampoco se duplica (índice único por usuario+evento).
- Dejar pasar `QUEUE_ADMISSION_TTL_SECONDS` sin crear un hold → el estado pasa solo a `EXPIRED` (TTL de Redis + cron de respaldo cada 30 s), sin llamar a ningún endpoint.
- Dos eventos distintos con demanda alta en uno: la fila del otro evento no se atrasa (cada evento tiene su propia `Queue`/`Worker` de BullMQ) — ver `src/event-queue/event-queue-registry.service.spec.ts`.

## 7. Pruebas manuales del flujo completo (curl)

> También puedes hacer todas estas pruebas desde la UI de Scalar en `/docs/purchases`.

### 7.0 Requisito previo: turno vigente en la fila virtual (Módulo 8)

Desde esta tarea, `POST /purchases/temporary-blocks` **rechaza con 403** a cualquier usuario que no tenga una admisión `ACTIVE` vigente. Antes de las pruebas de esta sección, únete a la fila y espera a ser admitido — ver [sección 6.5](#65-fila-virtual-módulo-8-flujo-end-to-end) más abajo. Todas las rutas de `/purchases/*` requieren `Authorization: Bearer <token>` (la identidad se toma del JWT, nunca de un `userId` en el body).

### 7.1 Crear un bloqueo temporal (TTL configurable, 8 minutos por defecto)

```bash
curl -X POST http://localhost:3004/purchases/temporary-blocks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_DE_UN_USUARIO_ADMITIDO>" \
  -d '{
    "eventId": "550e8400-e29b-41d4-a716-446655440010",
    "eventZoneId": "a9ec1978-75f6-4432-9476-edf3835938c5",
    "eventSeatIds": ["cf3d2b7b-b24f-4468-b906-350c35c4764b"]
  }'
```

**Esperado:** `201` con `{ holdId, eventId, eventZoneId, status: "HELD", expiresAt, blocks: [{ blockId, eventSeatId, quantity }] }`. Guarda `blocks[].blockId` (lo usarás como `temporaryBlockIds` en la compra); `holdId` agrupa todos los asientos de esta misma llamada.

Para bloquear varios asientos a la vez de forma atómica, manda varios ids en `eventSeatIds` (máx. 10): si cualquiera ya no está disponible, la llamada completa falla con `409` y **no se bloquea ninguno**.

### 7.2 Concurrencia: mismo asiento, otro usuario

Repite el mismo request con el token de otro usuario admitido. **Esperado:** `409 Conflict` (lock atómico en Redis — ver `src/redis/redis.service.concurrency.spec.ts` para la prueba automatizada con 50 solicitudes concurrentes).

### 7.3 Bloqueos activos del usuario (con TTL en vivo)

```bash
curl http://localhost:3004/purchases/temporary-blocks/user/550e8400-e29b-41d4-a716-446655440000
```

**Esperado:** lista con `ttlSeconds` (contador real de Redis).

### 7.4 Compra con pago APROBADO

```bash
curl -X POST http://localhost:3004/purchases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
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

## 9. Contrato futuro: integración con Checkout (Cliente)

Esta tarea deja lista la infraestructura de fila virtual + hold, pero **no** conecta el flujo de compra del Cliente. Cuando se implemente ese checkout, debe seguir este contrato:

```text
holdId (de la respuesta de POST /purchases/temporary-blocks)
   ↓
checkout del Cliente selecciona método de pago
   ↓
POST /purchases  { temporaryBlockIds: [...blocks[].blockId], details, payment }
   ↓
PurchasesService.create():
   1. assertBlocksCanBeConverted: verifica ownership (block.userId === user),
      vigencia (status ACTIVE, no expirado) y que cada `detail` corresponda
      a uno de los blocks — YA IMPLEMENTADO, no requiere cambios.
   2. Dentro de prisma.$transaction: crea Purchase + PurchaseDetail[] +
      Payment, y marca los TemporaryBlock como CONVERTED/RELEASED según el
      resultado del pago — YA IMPLEMENTADO.
   3. PENDIENTE (fuera de alcance de esta tarea): al confirmar la compra,
      llamar a venues-events-service para marcar cada EventSeat como SOLD
      (hoy nada hace esa transición; el asiento queda AVAILABLE en la BD
      real de venues-events-service aunque el hold y la compra existan en
      purchases-service). Sin esto, dos compras confirmadas casi
      simultáneas para el mismo asiento NO están bloqueadas por una
      restricción de base de datos — solo por el lock de Redis durante el
      hold, que ya expiró para cuando se confirma el pago.
   4. releaseRedisLocksForBlocks: borra las keys de Redis de los blocks
      convertidos/liberados — YA IMPLEMENTADO.
```

**Limitaciones/decisiones a resolver antes de implementar Checkout:**

1. **Protección definitiva en BD contra sobreventa (Módulo 21 del TODO):** el índice único parcial `tickets(event_seat_id) WHERE status = 'ISSUED'` está documentado en `nextticket.sql` (referencia) pero **no** se portó a la migración real de `tickets-service` (confirmado por inspección directa de `prisma/migrations/20260717194040_init/migration.sql`). Sin él, nada en la base de datos impide emitir dos tickets `ISSUED` para el mismo `eventSeatId` si dos compras se confirman casi al mismo tiempo después de que ambos holds ya expiraron. Debe agregarse a mano a la migración de `tickets-service`, igual que ya hicieron con los índices únicos parciales de `TemporaryBlock`/`QueueEntry` en este mismo módulo.
2. **Transición `EventSeat.status → SOLD`:** falta decidir si `purchases-service` llama sincrónicamente a `venues-events-service` (como ya hace `assertOrganizerOwnsEvent`) o si se introduce un mecanismo async (evento/saga) para esa transición al confirmar el pago.
3. **Reutilización del `holdId`:** hoy es un identificador generado en la respuesta (no una tabla propia); el checkout debe seguir usando los `blockId` individuales de `blocks[]` para `temporaryBlockIds`, no el `holdId` agrupador.
4. **Sin renovación de hold:** por diseño (Módulo 19 del TODO) el TTL es fijo y no renovable. Si el checkout tarda más que `SEAT_HOLD_TTL_SECONDS`, el hold expira y debe reiniciarse desde la selección de asientos.
