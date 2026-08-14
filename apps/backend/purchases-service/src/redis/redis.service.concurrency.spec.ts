import { RedisService } from './redis.service';

/**
 * Pruebas de concurrencia REALES (Módulo 28/29 del TODO de fila virtual):
 * usan el Redis real de docker-compose (misma instancia que usa la app en
 * desarrollo), no mocks, porque un mock de jest.fn() no puede demostrar
 * atomicidad — todas las llamadas a un mock se resuelven secuencialmente
 * dentro del mismo proceso. `Promise.all` sobre operaciones reales de
 * Redis sí ejercita el caso real: muchas solicitudes concurrentes contra
 * la misma clave.
 */
describe('RedisService concurrency (Redis real)', () => {
  let redis: RedisService;

  beforeAll(async () => {
    redis = new RedisService();
    await redis.onModuleInit();
  });

  afterAll(async () => {
    await redis.onModuleDestroy();
  });

  it('de 50 solicitudes concurrentes por la misma key, exactamente una adquiere el lock (setIfAbsent)', async () => {
    const key = `test:concurrency:seat:${Date.now()}`;

    const attempts = Array.from({ length: 50 }, (_, i) =>
      redis.setIfAbsent(key, { attempt: i }, 5),
    );
    const results = await Promise.all(attempts);

    expect(results.filter(Boolean).length).toBe(1);

    await redis.del(key);
  });

  it('acquireMultiLock: si dos grupos comparten un asiento, nunca ganan ambos (todo o nada)', async () => {
    const suffix = Date.now();
    const seatA = `test:concurrency:seatA:${suffix}`;
    const seatB = `test:concurrency:seatB:${suffix}`;
    const seatC = `test:concurrency:seatC:${suffix}`;

    const groupOne = redis.acquireMultiLock([seatA, seatB], 5, [
      { group: 1 },
      { group: 1 },
    ]);
    const groupTwo = redis.acquireMultiLock([seatB, seatC], 5, [
      { group: 2 },
      { group: 2 },
    ]);

    const [oneAcquired, twoAcquired] = await Promise.all([groupOne, groupTwo]);

    expect(oneAcquired && twoAcquired).toBe(false);
    expect(oneAcquired || twoAcquired).toBe(true);

    await redis.delMany([seatA, seatB, seatC]);
  });

  it('acquireMultiLock: de 50 solicitudes concurrentes por el MISMO conjunto de asientos, solo una lo obtiene (Módulo 29 del TODO)', async () => {
    const suffix = Date.now();
    const seats = [0, 1, 2].map((n) => `test:concurrency:multiseat:${n}:${suffix}`);

    const attempts = Array.from({ length: 50 }, (_, i) =>
      redis.acquireMultiLock(
        seats,
        5,
        seats.map(() => ({ attempt: i })),
      ),
    );
    const results = await Promise.all(attempts);

    expect(results.filter(Boolean).length).toBe(1);

    await redis.delMany(seats);
  });

  it('un lock liberado por TTL puede ser adquirido de nuevo por otro usuario (Módulo 30 del TODO)', async () => {
    const key = `test:concurrency:ttl-expiry:${Date.now()}`;

    const first = await redis.setIfAbsent(key, { userId: 'user-a' }, 1);
    expect(first).toBe(true);

    const blockedWhileActive = await redis.setIfAbsent(key, { userId: 'user-b' }, 1);
    expect(blockedWhileActive).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1300));

    const afterExpiry = await redis.setIfAbsent(key, { userId: 'user-b' }, 1);
    expect(afterExpiry).toBe(true);

    await redis.del(key);
  }, 10000);
});
