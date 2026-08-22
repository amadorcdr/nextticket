# Mapa de endpoints y permisos

Generado a partir de los controladores. Todo el tráfico entra por el
API Gateway en `http://localhost:3001`.

**Acceso:** `público` no pide token · `cualquier sesión` pide token válido ·
un rol (`ORGANIZER`, `VALIDATOR`, `ADMIN`, …) exige además ese rol.


## auth-service

| Método | Ruta | Acceso | Qué hace |
|--------|------|--------|----------|
| `POST` | `/auth/register` | público | Register a client user |
| `POST` | `/auth/login` | público | Login with email and password |
| `GET` | `/auth/google` | público | Start Google OAuth flow |
| `GET` | `/auth/google/callback` | público | Handle Google OAuth callback |
| `GET` | `/auth/me` | cualquier sesión | Get the authenticated user |
| `POST` | `/users` | ADMIN |  |
| `GET` | `/users` | ADMIN | Listar usuarios paginados (solo ADMIN) |
| `GET` | `/users/:id` | cualquier sesión | Obtener usuario por id (uno mismo o ADMIN) |
| `PATCH` | `/users/:id/role` | ADMIN | Cambiar el rol de un usuario (solo ADMIN) |
| `PATCH` | `/users/:id` | cualquier sesión |  |
| `DELETE` | `/users/:id` | ADMIN | Eliminar usuario (solo ADMIN) |

## venues-events-service

| Método | Ruta | Acceso | Qué hace |
|--------|------|--------|----------|
| `POST` | `/event-categories` | ORGANIZER, ADMIN | Crear categoría de evento |
| `GET` | `/event-categories` | público |  |
| `GET` | `/event-categories/:id` | público | Obtener categoría por id |
| `PATCH` | `/event-categories/:id` | ORGANIZER, ADMIN | Actualizar categoría |
| `DELETE` | `/event-categories/:id` | ORGANIZER, ADMIN | Eliminar categoría |
| `GET` | `/events/:eventId/seats` | público |  |
| `GET` | `/events/:eventId/seats/:seatId` | público |  |
| `PATCH` | `/events/:eventId/seats/:seatId` | ORGANIZER, ADMIN |  |
| `DELETE` | `/events/:eventId/seats/:seatId` | ORGANIZER, ADMIN |  |
| `POST` | `/events/:eventId/sections` | ORGANIZER, ADMIN |  |
| `GET` | `/events/:eventId/sections` | público |  |
| `GET` | `/events/:eventId/sections/:sectionId` | público |  |
| `PATCH` | `/events/:eventId/sections/:sectionId` | ORGANIZER, ADMIN |  |
| `DELETE` | `/events/:eventId/sections/:sectionId` | ORGANIZER, ADMIN |  |
| `POST` | `/events/:eventId/zones` | ORGANIZER, ADMIN |  |
| `GET` | `/events/:eventId/zones` | público |  |
| `GET` | `/events/:eventId/zones/:zoneId` | público |  |
| `PATCH` | `/events/:eventId/zones/:zoneId` | ORGANIZER, ADMIN |  |
| `POST` | `/events/:eventId/zones/:zoneId/sections` | ORGANIZER, ADMIN |  |
| `DELETE` | `/events/:eventId/zones/:zoneId/sections/:sectionId` | ORGANIZER, ADMIN |  |
| `POST` | `/events/:eventId/zones/:zoneId/price-tiers` | ORGANIZER, ADMIN |  |
| `PATCH` | `/events/:eventId/zones/:zoneId/price-tiers/:tierId` | ORGANIZER, ADMIN |  |
| `DELETE` | `/events/:eventId/zones/:zoneId` | ORGANIZER, ADMIN |  |
| `POST` | `/events` | ORGANIZER, ADMIN |  |
| `GET` | `/events` | público |  |
| `GET` | `/events/:id` | público |  |
| `PATCH` | `/events/:id` | ORGANIZER, ADMIN |  |
| `PATCH` | `/events/:id/status` | ORGANIZER, ADMIN |  |
| `DELETE` | `/events/:id` | ORGANIZER, ADMIN |  |
| `POST` | `/events/:eventId/categories` | ORGANIZER, ADMIN |  |
| `DELETE` | `/events/:eventId/categories/:categoryId` | ORGANIZER, ADMIN |  |
| `POST` | `/venues` | ORGANIZER, ADMIN | Crear recinto |
| `GET` | `/venues` | público |  |
| `GET` | `/venues/:venueId` | público | Obtener recinto por id (con árbol completo) |
| `PATCH` | `/venues/:venueId` | ORGANIZER, ADMIN | Actualizar recinto |
| `DELETE` | `/venues/:venueId` | ORGANIZER, ADMIN |  |
| `POST` | `/venues/:venueId/floors` | ORGANIZER, ADMIN | Crear piso en un recinto |
| `GET` | `/venues/:venueId/floors` | público | Listar pisos de un recinto |
| `GET` | `/venues/:venueId/floors/:floorId` | público | Obtener piso por id |
| `PATCH` | `/venues/:venueId/floors/:floorId` | ORGANIZER, ADMIN | Actualizar piso |
| `DELETE` | `/venues/:venueId/floors/:floorId` | ORGANIZER, ADMIN |  |
| `POST` | `/venues/:venueId/floors/:floorId/sections` | ORGANIZER, ADMIN | Crear sección en un piso |
| `GET` | `/venues/:venueId/floors/:floorId/sections` | público | Listar secciones de un piso |
| `GET` | `/venues/:venueId/floors/:floorId/sections/:sectionId` | público | Obtener sección por id |
| `PATCH` | `/venues/:venueId/floors/:floorId/sections/:sectionId` | ORGANIZER, ADMIN | Actualizar sección |
| `DELETE` | `/venues/:venueId/floors/:floorId/sections/:sectionId` | ORGANIZER, ADMIN | Eliminar sección (cascada: seats) |
| `POST` | `/venues/:venueId/floors/:floorId/sections/:sectionId/seats` | ORGANIZER, ADMIN | Crear asiento en una sección |
| `GET` | `/venues/:venueId/floors/:floorId/sections/:sectionId/seats` | público | Listar asientos de una sección |
| `GET` | `/venues/:venueId/floors/:floorId/sections/:sectionId/seats/:seatId` | público | Obtener asiento por id |
| `PATCH` | `/venues/:venueId/floors/:floorId/sections/:sectionId/seats/:seatId` | ORGANIZER, ADMIN | Actualizar asiento |
| `DELETE` | `/venues/:venueId/floors/:floorId/sections/:sectionId/seats/:seatId` | ORGANIZER, ADMIN | Eliminar asiento |
| `POST` | `/venues/:venueId/floors/:floorId/canvas-elements` | ORGANIZER, ADMIN | Crear elemento de canvas en un piso |
| `GET` | `/venues/:venueId/floors/:floorId/canvas-elements` | público | Listar elementos de canvas de un piso |
| `GET` | `/venues/:venueId/floors/:floorId/canvas-elements/:elementId` | público | Obtener elemento de canvas por id |
| `PATCH` | `/venues/:venueId/floors/:floorId/canvas-elements/:elementId` | ORGANIZER, ADMIN | Actualizar elemento de canvas |
| `DELETE` | `/venues/:venueId/floors/:floorId/canvas-elements/:elementId` | ORGANIZER, ADMIN | Eliminar elemento de canvas |

## purchases-service

### Módulo 8 · Fila Virtual (previo obligatorio al hold)

| Método | Ruta | Acceso | Qué hace |
|--------|------|--------|----------|
| `POST` | `/purchases/queue/:eventId` | cualquier sesión | Unirse a la fila virtual del evento (idempotente vía `idempotencyKey`) |
| `GET` | `/purchases/queue/:eventId/me` | cualquier sesión | Consultar mi entrada de fila activa (WAITING/ADMITTED con posición o TTL de admisión) |
| `GET` | `/purchases/queue/:eventId/:entryId` | cualquier sesión (dueño) | Consultar el estado de una entrada de fila por id |

### Módulo 7 · Bloqueo Temporal (requiere admisión ACTIVA de la fila virtual)

| Método | Ruta | Acceso | Qué hace |
|--------|------|--------|----------|
| `POST` | `/purchases/temporary-blocks` | cualquier sesión con admisión ACTIVA | Bloquear uno o varios asientos (`eventSeatIds`, atómico) o admisión general por `quantity` |
| `GET` | `/purchases/temporary-blocks/me` | cualquier sesión | Listar mis bloqueos temporales activos |
| `POST` | `/purchases/temporary-blocks/expire` | ADMIN |  |
| `DELETE` | `/purchases/temporary-blocks/:id` | cualquier sesión (dueño) | Liberar manualmente un bloqueo temporal |

### Módulo 6 · Compra Simulada

| Método | Ruta | Acceso | Qué hace |
|--------|------|--------|----------|
| `POST` | `/purchases` | cualquier sesión | Crear compra simulada y registrar pago |
| `GET` | `/purchases` | cualquier sesión |  |
| `GET` | `/purchases/:id` | cualquier sesión | Obtener compra por id (propia o ADMIN) |
| `PATCH` | `/purchases/:id` | cualquier sesión | Actualizar estado de compra |
| `DELETE` | `/purchases/:id` | cualquier sesión | Cancelar compra |

## tickets-service

| Método | Ruta | Acceso | Qué hace |
|--------|------|--------|----------|
| `POST` | `/tickets/transfers` | cualquier sesión | Request a ticket transfer between users |
| `POST` | `/tickets/transfers/:id/complete` | cualquier sesión |  |
| `POST` | `/tickets/transfers/:id/reject` | cualquier sesión | Reject a pending transfer |
| `POST` | `/tickets/transfers/:id/cancel` | cualquier sesión | Cancel a pending transfer |
| `GET` | `/tickets/transfers/:id` | cualquier sesión |  |
| `GET` | `/tickets/transfers/user/:userId` | cualquier sesión |  |
| `POST` | `/tickets/validations` | VALIDATOR, ADMIN |  |
| `GET` | `/tickets/validations/ticket/:ticketId` | público | Get validation history for a ticket |
| `GET` | `/tickets/validations/validator/:validatorId` | público | Get validations performed by a specific validator |
| `POST` | `/tickets` | ORGANIZER, ADMIN | Issue a new ticket and generate QR hash |
| `GET` | `/tickets` | ORGANIZER, ADMIN |  |
| `GET` | `/tickets/hash/:hash` | VALIDATOR, ORGANIZER, ADMIN |  |
| `GET` | `/tickets/user/:userId` | cualquier sesión |  |
| `GET` | `/tickets/event-zone/:eventZoneId` | ORGANIZER, ADMIN |  |
| `GET` | `/tickets/:id/qr` | cualquier sesión |  |
| `GET` | `/tickets/:id` | cualquier sesión |  |
| `PATCH` | `/tickets/:id/status` | ORGANIZER, VALIDATOR, ADMIN | Update ticket status |

---

## Cómo se usa un token

```bash
# 1. Iniciar sesión
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@correo.com","password":"TuPassword"}'

# 2. Usar el token que devuelve
curl -s http://localhost:3001/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

Respuestas de error del control de acceso:

| Código | Significa |
|--------|-----------|
| `401` | Falta el token, está vencido o la firma no coincide |
| `403` | El token es válido pero el rol no alcanza, o el recurso es de otra persona |

## Roles

Se siembran solos al arrancar auth-service.

| Rol | Para qué |
|-----|----------|
| `CLIENT` | Rol por defecto de quien se registra. Compra y consulta sus boletos |
| `ORGANIZER` | Administra recintos, eventos, zonas y precios |
| `VALIDATOR` | Valida boletos escaneando el QR en la entrada |
| `ADMIN` | Todo lo anterior, más la gestión de usuarios y roles |

El primer administrador se crea una sola vez directo en la base, porque no hay
otro camino:

```bash
docker exec nextticket-postgres psql -U postgres -d auth_db \
  -c "UPDATE \"User\" SET \"roleId\"=(SELECT id FROM \"Role\" WHERE name='ADMIN') WHERE email='TU_CORREO';"
```

De ahí en adelante los roles se reparten con `PATCH /users/:id/role`.

## Datos que nunca salen en una respuesta

| Dato | Regla |
|------|-------|
| `password` | Nunca, en ningún endpoint |
| `qrCode` del boleto | Solo su titular. Nunca en listados |
| Compras | Solo las propias, salvo que seas `ADMIN` |
| Boletos de otra persona | Solo `ADMIN` |
