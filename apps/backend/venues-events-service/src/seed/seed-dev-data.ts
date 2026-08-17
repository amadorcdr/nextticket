import 'dotenv/config';
import { createHash } from 'crypto';
import { Client as PgClient } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import Redis from 'ioredis';
import {
  PrismaClient,
  Prisma,
  VenueStatus,
  SectionStatus,
  SeatStatus,
  SeatType,
  EventStatus,
  AdmissionType,
  EventZoneStatus,
  PriceTierStatus,
  EventSeatStatus,
  EventCategoryStatus,
} from '@prisma/client';

/**
 * Siembra datos de desarrollo (recintos, eventos, zonas, asientos, precios)
 * para poder probar manualmente el flujo del Cliente ya conectado al backend
 * real. Repetible: cada fila usa un id determinístico (sha256 de una llave
 * legible) y upsert/skipDuplicates, así que correrlo varias veces actualiza
 * los mismos registros en vez de duplicarlos.
 *
 * No siembra compras/tickets/holds del cliente de prueba: esos se generan
 * manualmente desde el frontend.
 *
 * Uso: cd apps/backend/venues-events-service && npx prisma db seed
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no esta definida: revisa el .env');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const NAMESPACE = 'nextticket-dev-seed';

/**
 * Id determinístico (sha256 de una llave legible, formateado como uuid v4)
 * para que el seed sea idempotente sin hardcodear UUIDs a mano. Fuerza el
 * nibble de versión ('4') y el de variante ('8'-'b'): varios DTOs del backend
 * validan con `@IsUUID('4')`, que exige ese formato exacto, no solo la forma
 * general de un UUID.
 */
function uid(key: string): string {
  const hash = createHash('sha256').update(`${NAMESPACE}:${key}`).digest('hex').split('');
  hash[12] = '4';
  hash[16] = ['8', '9', 'a', 'b'][parseInt(hash[16], 16) % 4];
  const fixed = hash.join('');
  return [
    fixed.slice(0, 8),
    fixed.slice(8, 12),
    fixed.slice(12, 16),
    fixed.slice(16, 20),
    fixed.slice(20, 32),
  ].join('-');
}

function addDaysAtUtcHour(base: Date, days: number, hour: number, minute = 0): Date {
  const d = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

/**
 * organizerId es una referencia opaca a auth-service (sin FK entre bases).
 * Se resuelve por email consultando auth_db directo, para no hardcodear un
 * id que solo existe en la máquina donde se corrió seed-users.sh una vez.
 */
async function getOrganizerId(): Promise<string> {
  const authDbUrl = connectionString!.replace(/\/venues_events_db(\?|$)/, '/auth_db$1');
  const client = new PgClient({ connectionString: authDbUrl });
  await client.connect();
  try {
    const res = await client.query('SELECT id FROM "User" WHERE email = $1', [
      'organizador@test.com',
    ]);
    if (res.rows.length === 0) {
      throw new Error(
        'No existe organizador@test.com en auth_db. Corre primero: bash scripts/seed-users.sh',
      );
    }
    return res.rows[0].id as string;
  } finally {
    await client.end();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// RECINTOS
// ─────────────────────────────────────────────────────────────────────────

interface SeatRowPlan {
  row: string;
  count: number;
  type?: SeatType;
}

interface SectionPlan {
  key: string;
  name: string;
  seats: SeatRowPlan[];
}

interface FloorPlan {
  key: string;
  name: string;
  levelIndex: number;
  sections: SectionPlan[];
}

interface VenuePlan {
  key: string;
  name: string;
  address: string;
  city: string;
  state: string;
  floors: FloorPlan[];
}

async function seedVenue(plan: VenuePlan) {
  const totalCapacity = plan.floors.reduce(
    (venueTotal, floor) =>
      venueTotal +
      floor.sections.reduce(
        (floorTotal, section) =>
          floorTotal + section.seats.reduce((s, r) => s + r.count, 0),
        0,
      ),
    0,
  );

  const venueId = uid(`venue:${plan.key}`);
  await prisma.venue.upsert({
    where: { id: venueId },
    update: {
      name: plan.name,
      address: plan.address,
      city: plan.city,
      state: plan.state,
      country: 'Mexico',
      totalCapacity,
      status: VenueStatus.ACTIVE,
    },
    create: {
      id: venueId,
      name: plan.name,
      address: plan.address,
      city: plan.city,
      state: plan.state,
      country: 'Mexico',
      totalCapacity,
      status: VenueStatus.ACTIVE,
    },
  });

  const sectionIdByKey = new Map<string, string>();

  for (const floor of plan.floors) {
    const floorId = uid(`floor:${plan.key}:${floor.key}`);
    await prisma.floor.upsert({
      where: { id: floorId },
      update: { name: floor.name, levelIndex: floor.levelIndex, venueId },
      create: { id: floorId, name: floor.name, levelIndex: floor.levelIndex, venueId },
    });

    for (const section of floor.sections) {
      const capacity = section.seats.reduce((s, r) => s + r.count, 0);
      const sectionId = uid(`section:${plan.key}:${section.key}`);

      await prisma.section.upsert({
        where: { id: sectionId },
        update: {
          name: section.name,
          capacity,
          venueId,
          floorId,
          status: SectionStatus.ACTIVE,
        },
        create: {
          id: sectionId,
          name: section.name,
          capacity,
          venueId,
          floorId,
          status: SectionStatus.ACTIVE,
        },
      });
      sectionIdByKey.set(section.key, sectionId);

      const seatRows: Prisma.SeatCreateManyInput[] = [];
      for (const rowPlan of section.seats) {
        for (let i = 1; i <= rowPlan.count; i++) {
          const number = String(i);
          seatRows.push({
            id: uid(`seat:${plan.key}:${section.key}:${rowPlan.row}:${number}`),
            sectionId,
            row: rowPlan.row,
            number,
            type: rowPlan.type ?? SeatType.STANDARD,
            status: SeatStatus.AVAILABLE,
          });
        }
      }
      if (seatRows.length > 0) {
        await prisma.seat.createMany({ data: seatRows, skipDuplicates: true });
      }
    }
  }

  return { venueId, sectionIdByKey };
}

// ─────────────────────────────────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────────────────────────────────

interface ZonePlan {
  key: string;
  publicName: string;
  admissionType: AdmissionType;
  price: number;
  sectionKeys: string[];
  mapColor: string;
}

interface EventPlan {
  key: string;
  name: string;
  description: string;
  imageUrl: string;
  venueId: string;
  sectionIdByKey: Map<string, string>;
  categoryId: string;
  startsAt: Date;
  endsAt: Date;
  status: EventStatus;
  zones: ZonePlan[];
}

async function seedEvent(plan: EventPlan, organizerId: string): Promise<string> {
  const eventId = uid(`event:${plan.key}`);

  await prisma.event.upsert({
    where: { id: eventId },
    update: {
      name: plan.name,
      description: plan.description,
      imageUrl: plan.imageUrl,
      venueId: plan.venueId,
      startsAt: plan.startsAt,
      endsAt: plan.endsAt,
      status: plan.status,
      lastModifiedBy: organizerId,
    },
    create: {
      id: eventId,
      name: plan.name,
      description: plan.description,
      imageUrl: plan.imageUrl,
      venueId: plan.venueId,
      organizerId,
      startsAt: plan.startsAt,
      endsAt: plan.endsAt,
      status: plan.status,
      createdBy: organizerId,
    },
  });

  await prisma.eventCategoryAssignment.upsert({
    where: { eventId_categoryId: { eventId, categoryId: plan.categoryId } },
    update: {},
    create: { eventId, categoryId: plan.categoryId },
  });

  for (const zone of plan.zones) {
    const zoneId = uid(`zone:${plan.key}:${zone.key}`);
    const sectionIds = zone.sectionKeys.map((key) => {
      const id = plan.sectionIdByKey.get(key);
      if (!id) throw new Error(`Sección "${key}" no existe en el recinto del evento "${plan.key}"`);
      return id;
    });

    const availableSeatsCount = await prisma.seat.count({
      where: { sectionId: { in: sectionIds }, status: SeatStatus.AVAILABLE },
    });

    if (availableSeatsCount === 0) {
      throw new Error(`Zona "${zone.key}" del evento "${plan.key}" no tiene asientos disponibles`);
    }

    await prisma.eventZone.upsert({
      where: { id: zoneId },
      update: {
        publicName: zone.publicName,
        admissionType: zone.admissionType,
        eventPrice: new Prisma.Decimal(zone.price),
        availableCapacity: availableSeatsCount,
        mapColor: zone.mapColor,
        status: EventZoneStatus.ACTIVE,
        lastModifiedBy: organizerId,
      },
      create: {
        id: zoneId,
        eventId,
        publicName: zone.publicName,
        admissionType: zone.admissionType,
        eventPrice: new Prisma.Decimal(zone.price),
        availableCapacity: availableSeatsCount,
        mapColor: zone.mapColor,
        status: EventZoneStatus.ACTIVE,
        createdBy: organizerId,
      },
    });

    for (const sectionId of sectionIds) {
      await prisma.eventZoneSection.upsert({
        where: { eventZoneId_sectionId: { eventZoneId: zoneId, sectionId } },
        update: {},
        create: { eventZoneId: zoneId, eventId, sectionId },
      });
    }

    const seats = await prisma.seat.findMany({
      where: { sectionId: { in: sectionIds }, status: SeatStatus.AVAILABLE },
      select: { id: true, sectionId: true },
    });
    const eventSeatsData: Prisma.EventSeatCreateManyInput[] = seats.map((seat) => ({
      id: uid(`eventseat:${plan.key}:${zone.key}:${seat.id}`),
      eventZoneId: zoneId,
      sectionId: seat.sectionId,
      seatId: seat.id,
      status: EventSeatStatus.AVAILABLE,
    }));
    if (eventSeatsData.length > 0) {
      await prisma.eventSeat.createMany({ data: eventSeatsData, skipDuplicates: true });
    }

    const tierId = uid(`tier:${plan.key}:${zone.key}`);
    await prisma.eventZonePriceTier.upsert({
      where: { id: tierId },
      update: {
        name: 'Regular',
        price: new Prisma.Decimal(zone.price),
        initialCapacity: availableSeatsCount,
        availableCapacity: availableSeatsCount,
        sortOrder: 0,
        status: PriceTierStatus.ACTIVE,
        lastModifiedBy: organizerId,
      },
      create: {
        id: tierId,
        eventZoneId: zoneId,
        name: 'Regular',
        price: new Prisma.Decimal(zone.price),
        initialCapacity: availableSeatsCount,
        availableCapacity: availableSeatsCount,
        sortOrder: 0,
        status: PriceTierStatus.ACTIVE,
        createdBy: organizerId,
      },
    });
  }

  return eventId;
}

async function seedCategory(key: string, name: string, slug: string): Promise<string> {
  const id = uid(`category:${key}`);
  await prisma.eventCategory.upsert({
    where: { id },
    update: { name, slug, status: EventCategoryStatus.ACTIVE },
    create: { id, name, slug, status: EventCategoryStatus.ACTIVE },
  });
  return id;
}

async function main() {
  const organizerId = await getOrganizerId();
  const now = new Date();

  console.log('Sembrando categorías DEV...');
  const categoryIds = {
    conciertos: await seedCategory('conciertos', 'DEV - Conciertos', 'dev-conciertos'),
    festivales: await seedCategory('festivales', 'DEV - Festivales', 'dev-festivales'),
    teatro: await seedCategory('teatro', 'DEV - Teatro y Artes', 'dev-teatro-y-artes'),
    comedia: await seedCategory('comedia', 'DEV - Comedia', 'dev-comedia'),
    gaming: await seedCategory('gaming', 'DEV - Gaming y Esports', 'dev-gaming-y-esports'),
  };

  console.log('Sembrando recintos DEV...');

  const arenaCentral = await seedVenue({
    key: 'arena-central',
    name: 'Arena Central',
    address: 'Av. Central 100',
    city: 'Ciudad de México',
    state: 'CDMX',
    floors: [
      {
        key: 'principal',
        name: 'Piso Principal',
        levelIndex: 0,
        sections: [
          { key: 'general', name: 'General', seats: [{ row: 'A', count: 10 }, { row: 'B', count: 10 }, { row: 'C', count: 10 }, { row: 'D', count: 10 }] },
          { key: 'preferente', name: 'Preferente', seats: [{ row: 'A', count: 10, type: SeatType.PREMIUM }, { row: 'B', count: 10, type: SeatType.PREMIUM }, { row: 'C', count: 10, type: SeatType.PREMIUM }] },
          { key: 'vip', name: 'VIP', seats: [{ row: 'A', count: 10, type: SeatType.VIP }, { row: 'B', count: 10, type: SeatType.VIP }] },
        ],
      },
    ],
  });

  const explanadaNorte = await seedVenue({
    key: 'explanada-norte',
    name: 'Explanada Norte',
    address: 'Carretera Nacional Km 12',
    city: 'Monterrey',
    state: 'Nuevo León',
    floors: [
      {
        key: 'explanada',
        name: 'Explanada',
        levelIndex: 0,
        sections: [
          { key: 'campo-general', name: 'Campo General', seats: [{ row: 'GA', count: 200 }] },
          { key: 'zona-vip', name: 'Zona VIP Explanada', seats: [{ row: 'GA', count: 50, type: SeatType.VIP }] },
        ],
      },
    ],
  });

  const teatroDelBosque = await seedVenue({
    key: 'teatro-del-bosque',
    name: 'Teatro del Bosque',
    address: 'Av. Chapultepec 550',
    city: 'Guadalajara',
    state: 'Jalisco',
    floors: [
      {
        key: 'planta-baja',
        name: 'Planta Baja',
        levelIndex: 0,
        sections: [
          { key: 'butaca-central', name: 'Butaca Central', seats: [{ row: 'A', count: 10 }, { row: 'B', count: 10 }, { row: 'C', count: 10 }, { row: 'D', count: 10 }, { row: 'E', count: 10 }, { row: 'F', count: 10 }] },
        ],
      },
      {
        key: 'balcon',
        name: 'Balcón',
        levelIndex: 1,
        sections: [
          { key: 'balcon', name: 'Balcón', seats: [{ row: 'A', count: 10, type: SeatType.PREMIUM }, { row: 'B', count: 10, type: SeatType.PREMIUM }, { row: 'C', count: 10, type: SeatType.PREMIUM }] },
        ],
      },
    ],
  });

  console.log('Sembrando eventos DEV...');

  const eventAId = await seedEvent(
    {
      key: 'rock-en-vivo',
      name: 'Rock en Vivo',
      description: 'Concierto de rock en vivo con tres zonas de asientos numerados. Evento de prueba comprable de inmediato.',
      imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1200&auto=format&fit=crop',
      venueId: arenaCentral.venueId,
      sectionIdByKey: arenaCentral.sectionIdByKey,
      categoryId: categoryIds.conciertos,
      startsAt: addDaysAtUtcHour(now, 5, 20, 0),
      endsAt: addDaysAtUtcHour(now, 5, 23, 0),
      status: EventStatus.PUBLISHED,
      zones: [
        { key: 'general', publicName: 'General', admissionType: AdmissionType.RESERVED, price: 450, sectionKeys: ['general'], mapColor: '#22C55E' },
        { key: 'preferente', publicName: 'Preferente', admissionType: AdmissionType.RESERVED, price: 750, sectionKeys: ['preferente'], mapColor: '#3B82F6' },
        { key: 'vip', publicName: 'VIP', admissionType: AdmissionType.RESERVED, price: 1250, sectionKeys: ['vip'], mapColor: '#F59E0B' },
      ],
    },
    organizerId,
  );

  const eventBId = await seedEvent(
    {
      key: 'festival-sabor-nortenio',
      name: 'Festival Sabor Norteño',
      description: 'Festival al aire libre con admisión general por cantidad de boletos. Evento de prueba comprable de inmediato, en un recinto distinto.',
      imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=1200&auto=format&fit=crop',
      venueId: explanadaNorte.venueId,
      sectionIdByKey: explanadaNorte.sectionIdByKey,
      categoryId: categoryIds.festivales,
      startsAt: addDaysAtUtcHour(now, 8, 18, 0),
      endsAt: addDaysAtUtcHour(now, 8, 23, 59),
      status: EventStatus.PUBLISHED,
      zones: [
        { key: 'general', publicName: 'General', admissionType: AdmissionType.GENERAL, price: 350, sectionKeys: ['campo-general'], mapColor: '#22C55E' },
        { key: 'vip', publicName: 'VIP', admissionType: AdmissionType.GENERAL, price: 900, sectionKeys: ['zona-vip'], mapColor: '#F59E0B' },
      ],
    },
    organizerId,
  );

  const eventCId = await seedEvent(
    {
      key: 'sinfonica-de-otonio',
      name: 'Sinfónica de Otoño',
      description: 'Concierto de la orquesta sinfónica en el teatro. Evento próximo (fecha más lejana) con asientos numerados en dos niveles.',
      imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=1200&auto=format&fit=crop',
      venueId: teatroDelBosque.venueId,
      sectionIdByKey: teatroDelBosque.sectionIdByKey,
      categoryId: categoryIds.teatro,
      startsAt: addDaysAtUtcHour(now, 45, 19, 0),
      endsAt: addDaysAtUtcHour(now, 45, 21, 30),
      status: EventStatus.PUBLISHED,
      zones: [
        { key: 'butaca-central', publicName: 'Butaca Central', admissionType: AdmissionType.RESERVED, price: 600, sectionKeys: ['butaca-central'], mapColor: '#3B82F6' },
        { key: 'balcon', publicName: 'Balcón', admissionType: AdmissionType.RESERVED, price: 400, sectionKeys: ['balcon'], mapColor: '#A855F7' },
      ],
    },
    organizerId,
  );

  const eventDId = await seedEvent(
    {
      key: 'gira-comedia-stand-up',
      name: 'Gira de Comedia',
      description: 'Noche de stand-up con una sola zona a precio plano que combina ambos niveles del teatro. Otra configuración de zonas/precios sobre el mismo recinto.',
      imageUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?q=80&w=1200&auto=format&fit=crop',
      venueId: teatroDelBosque.venueId,
      sectionIdByKey: teatroDelBosque.sectionIdByKey,
      categoryId: categoryIds.comedia,
      startsAt: addDaysAtUtcHour(now, 15, 21, 0),
      endsAt: addDaysAtUtcHour(now, 15, 23, 0),
      status: EventStatus.PUBLISHED,
      zones: [
        { key: 'general', publicName: 'General', admissionType: AdmissionType.RESERVED, price: 300, sectionKeys: ['butaca-central', 'balcon'], mapColor: '#22C55E' },
      ],
    },
    organizerId,
  );

  const eventEId = await seedEvent(
    {
      key: 'expo-gamer-fest',
      name: 'Expo Gamer Fest',
      description: 'Torneo y expo de videojuegos. Evento de prueba en estado SOLD_OUT (agotado) para verificar ese estado alternativo en el catálogo.',
      imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop',
      venueId: arenaCentral.venueId,
      sectionIdByKey: arenaCentral.sectionIdByKey,
      categoryId: categoryIds.gaming,
      startsAt: addDaysAtUtcHour(now, 20, 10, 0),
      endsAt: addDaysAtUtcHour(now, 20, 18, 0),
      status: EventStatus.SOLD_OUT,
      zones: [
        { key: 'general', publicName: 'General', admissionType: AdmissionType.RESERVED, price: 300, sectionKeys: ['general'], mapColor: '#22C55E' },
        { key: 'vip', publicName: 'VIP', admissionType: AdmissionType.RESERVED, price: 700, sectionKeys: ['vip'], mapColor: '#F59E0B' },
      ],
    },
    organizerId,
  );

  console.log('Limpiando caché de Redis (venues/events)...');
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  const eventIds = [eventAId, eventBId, eventCId, eventDId, eventEId];
  const venueIds = [arenaCentral.venueId, explanadaNorte.venueId, teatroDelBosque.venueId];
  await redis.del(
    'venues:list',
    'events:list',
    'events:stats',
    'catalog:events',
    ...venueIds.map((id) => `venues:${id}`),
    ...eventIds.map((id) => `events:${id}`),
    ...eventIds.map((id) => `catalog:events:${id}`),
  );
  redis.disconnect();

  console.log('\n=== Recintos ===');
  console.log('DEV - Arena Central       ', arenaCentral.venueId);
  console.log('DEV - Explanada Norte     ', explanadaNorte.venueId);
  console.log('DEV - Teatro del Bosque   ', teatroDelBosque.venueId);

  console.log('\n=== Eventos ===');
  console.log('A. DEV - Rock en Vivo (comprable ahora)        ', eventAId);
  console.log('B. DEV - Festival Sabor Norteño (comprable ahora)', eventBId);
  console.log('C. DEV - Sinfónica de Otoño (próximo)           ', eventCId);
  console.log('D. DEV - Gira de Comedia Stand-up               ', eventDId);
  console.log('E. DEV - Expo Gamer Fest (SOLD_OUT)             ', eventEId);

  console.log('\nListo.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
