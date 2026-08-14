# Endpoint de semilla para Alexa

La skill inicia sesión con **una sola palabra clave** (la "semilla") en vez de
correo y contraseña, porque dictar un correo por voz falla demasiado. Este
endpoint es lo único que hay que agregarle al backend.

Se aplica sobre la rama `develop`, en `apps/backend/auth-service`.

---

## 1. Migración: columna `alexaSeed`

En `prisma/schema.prisma`, dentro de `model User`:

```prisma
  /// Palabra única para iniciar sesión desde Alexa. Null = sin acceso por voz.
  alexaSeed String? @unique
```

Y después:

```bash
pnpm exec prisma migrate dev --name add_alexa_seed
```

---

## 2. DTO

`src/auth/dto/alexa-seed.dto.ts`

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AlexaSeedDto {
  @ApiProperty({
    description: 'Palabra clave que el usuario dicta en Alexa',
    example: 'jaguar morado',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(60)
  // Solo letras, números y espacios: es lo único que Alexa transcribe de forma
  // confiable. Nada de símbolos.
  @Matches(/^[a-zA-Z0-9ÁÉÍÓÚáéíóúÑñ ]+$/, {
    message: 'La semilla solo puede tener letras, números y espacios',
  })
  seed!: string;
}
```

---

## 3. Servicio

En `src/auth/auth.service.ts`:

```ts
/** Normaliza lo que dicta Alexa: sin acentos, sin espacios, minúsculas. */
private normalizeSeed(seed: string) {
  return seed
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

async loginWithAlexaSeed(dto: AlexaSeedDto) {
  const seed = this.normalizeSeed(dto.seed);

  const user = await this.usersService.findByAlexaSeed(seed);

  // Mismo mensaje siempre: no revelamos qué semillas existen.
  if (!user) {
    throw new UnauthorizedException('Semilla no válida');
  }

  return {
    token: this.signToken({
      sub: user.id,
      email: user.email,
      role: user.role.name,
    }),
    user,
  };
}

/** Genera una semilla legible y fácil de dictar. */
async generateAlexaSeed(userId: string) {
  const adjetivos = ['rapido', 'azul', 'brillante', 'valiente', 'sereno'];
  const sustantivos = ['jaguar', 'colibri', 'volcan', 'faro', 'roble'];

  for (let intento = 0; intento < 10; intento++) {
    const seed =
      adjetivos[Math.floor(Math.random() * adjetivos.length)] +
      sustantivos[Math.floor(Math.random() * sustantivos.length)] +
      Math.floor(Math.random() * 90 + 10);

    const existe = await this.usersService.findByAlexaSeed(seed);
    if (!existe) {
      await this.usersService.setAlexaSeed(userId, seed);
      // Se devuelve separada para que la interfaz la muestre legible.
      return { seed, spoken: seed.replace(/(\d+)$/, ' $1') };
    }
  }

  throw new ConflictException('No se pudo generar una semilla única');
}
```

En `src/users/users.service.ts`:

```ts
findByAlexaSeed(seed: string) {
  return this.prisma.user.findUnique({
    where: { alexaSeed: seed },
    include: { role: true },
  });
}

setAlexaSeed(userId: string, alexaSeed: string) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { alexaSeed },
    select: USER_PUBLIC_SELECT,
  });
}
```

---

## 4. Controlador

En `src/auth/auth.controller.ts`:

```ts
@Post('alexa/seed')
@ApiOperation({ summary: 'Iniciar sesión desde Alexa con la palabra semilla' })
loginWithAlexaSeed(@Body() dto: AlexaSeedDto) {
  return this.authService.loginWithAlexaSeed(dto);
}

@Post('alexa/seed/generate')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiOperation({ summary: 'Generar mi palabra semilla para Alexa' })
generateAlexaSeed(@CurrentUser() user: AuthenticatedUser) {
  return this.authService.generateAlexaSeed(user.sub);
}
```

---

## 5. El gateway ya lo rutea

`/auth/**` ya está en los prefijos del api-gateway, así que no hay que tocarlo.

---

## 5b. Filtro por fecha en `GET /purchases/stats`

Lo pide `GetTotalRevenueByPeriodIntent` ("cuánto se recaudó en mayo"). Hoy el
endpoint solo devuelve el total acumulado. Va en `purchases-service`.

`src/purchases/dto/purchase-stats-query.dto.ts`

```ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class PurchaseStatsQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por evento' })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({ description: 'Inicio del periodo, ISO 8601' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Fin del periodo, ISO 8601' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
```

En `purchases.service.ts`, dentro del `where` de las consultas de stats:

```ts
const where: Prisma.PurchaseWhereInput = {
  status: 'CONFIRMED',
  ...(query.eventId ? { eventId: query.eventId } : {}),
  ...(query.from || query.to
    ? {
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        },
      }
    : {}),
};
```

Y en la respuesta hay que **devolver el periodo aplicado**, porque la skill lo
usa para saber si el filtro existe. Si no vienen estos campos, la skill avisa al
usuario que le está dando el total acumulado en vez de mentirle con una cifra
mensual:

```ts
return {
  totalRevenue,
  recentPurchasesCount,
  zones,
  from: query.from ?? null,
  to: query.to ?? null,
};
```

Probar:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/purchases/stats?from=2026-05-01T00:00:00.000Z&to=2026-05-31T23:59:59.000Z"
```

---

## 6. Probar

```bash
curl -s -X POST http://localhost:3001/auth/alexa/seed \
  -H "Content-Type: application/json" \
  -d '{"seed":"jaguar morado"}'
```

Debe responder `{ token, user }`. Con una semilla inexistente, `401`.

Para darle semilla a un usuario de prueba sin pasar por la API:

```bash
docker exec nextticket-postgres psql -U postgres -d auth_db \
  -c "UPDATE \"User\" SET \"alexaSeed\"='jaguarmorado' WHERE email='organizador@test.com';"
```

Ojo: se guarda **normalizada** (sin espacios ni acentos, en minúsculas), porque
así es como la manda la skill.
