/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { buildAdmissionKey } from '../event-queue/admission-key.util';
import { PurchasesGateway } from './purchases.gateway';
import { PurchasesService } from './purchases.service';

/**
 * Módulo 29 del TODO — prueba de concurrencia OBLIGATORIA, contra Postgres y
 * Redis reales (no mocks): simula muchas solicitudes simultáneas por el
 * mismo asiento y comprueba que solo una obtiene el hold. También cubre el
 * caso de hold múltiple atómico (Módulo 12): dos grupos que compiten por un
 * asiento compartido nunca terminan ambos con una reserva parcial.
 */
describe('PurchasesService concurrency (Postgres + Redis reales)', () => {
  let service: PurchasesService;
  let prisma: PrismaService;
  let redis: RedisService;
  const gateway = {
    emitBlockLocked: jest.fn(),
    emitBlockReleased: jest.fn(),
    emitBlockExpired: jest.fn(),
    emitBlockConverted: jest.fn(),
  };

  const EVENT_ID = randomUUID();
  const ZONE_ID = randomUUID();

  let fetchSpy: jest.SpyInstance;

  beforeAll(async () => {
    redis = new RedisService();
    await redis.onModuleInit();

    prisma = new PrismaService({
      getOrThrow: () =>
        process.env.DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:5432/purchases_db?schema=public',
    } as any);
    await prisma.onModuleInit();

    service = new PurchasesService(prisma, redis, gateway as unknown as PurchasesGateway);
  });

  afterAll(async () => {
    fetchSpy?.mockRestore();
    await prisma.onModuleDestroy();
    await redis.onModuleDestroy();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('50 solicitudes concurrentes por el MISMO asiento: exactamente 1 obtiene el hold, 49 son rechazadas', async () => {
    const seatId = randomUUID();
    const userIds = Array.from({ length: 50 }, () => randomUUID());

    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: seatId, eventZoneId: ZONE_ID, status: 'AVAILABLE' }],
    } as Response);

    await Promise.all(
      userIds.map((userId) => redis.set(buildAdmissionKey(EVENT_ID, userId), { ok: true }, 60)),
    );

    const results = await Promise.allSettled(
      userIds.map((userId) =>
        service.createTemporaryBlock(
          { eventId: EVENT_ID, eventZoneId: ZONE_ID, eventSeatIds: [seatId] },
          userId,
        ),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(49);
    for (const r of rejected as PromiseRejectedResult[]) {
      expect(r.reason).toBeInstanceOf(ConflictException);
    }

    const blocks = await prisma.temporaryBlock.findMany({ where: { eventSeatId: seatId } });
    expect(blocks.length).toBe(1); // nunca dos usuarios con el mismo asiento

    await prisma.temporaryBlock.deleteMany({ where: { eventSeatId: seatId } });
    await redis.del(`event-zone:${ZONE_ID}:seat:${seatId}`);
    await redis.delMany(userIds.map((userId) => buildAdmissionKey(EVENT_ID, userId)));
  }, 30000);

  it('hold múltiple atómico: dos grupos que compiten por un asiento compartido nunca dejan una reserva parcial', async () => {
    const seatA = randomUUID();
    const seatB = randomUUID(); // compartido entre ambos grupos
    const seatC = randomUUID();

    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () =>
        [seatA, seatB, seatC].map((id) => ({ id, eventZoneId: ZONE_ID, status: 'AVAILABLE' })),
    } as Response);

    const userX = randomUUID();
    const userY = randomUUID();
    await redis.set(buildAdmissionKey(EVENT_ID, userX), { ok: true }, 60);
    await redis.set(buildAdmissionKey(EVENT_ID, userY), { ok: true }, 60);

    const [resultX, resultY] = await Promise.allSettled([
      service.createTemporaryBlock(
        { eventId: EVENT_ID, eventZoneId: ZONE_ID, eventSeatIds: [seatA, seatB] },
        userX,
      ),
      service.createTemporaryBlock(
        { eventId: EVENT_ID, eventZoneId: ZONE_ID, eventSeatIds: [seatB, seatC] },
        userY,
      ),
    ]);

    const succeeded = [resultX, resultY].filter((r) => r.status === 'fulfilled');
    expect(succeeded.length).toBe(1); // nunca los dos grupos a la vez (comparten seatB)

    const blocks = await prisma.temporaryBlock.findMany({
      where: { eventSeatId: { in: [seatA, seatB, seatC] } },
    });
    // El grupo ganador crea SUS DOS asientos; el perdedor no crea ninguno
    // (nunca queda "un asiento sí, otro no" del mismo intento).
    expect(blocks.length).toBe(2);

    await prisma.temporaryBlock.deleteMany({
      where: { eventSeatId: { in: [seatA, seatB, seatC] } },
    });
    await redis.delMany(
      [seatA, seatB, seatC].map((seatId) => `event-zone:${ZONE_ID}:seat:${seatId}`),
    );
    await redis.delMany([
      buildAdmissionKey(EVENT_ID, userX),
      buildAdmissionKey(EVENT_ID, userY),
    ]);
  }, 30000);
});
