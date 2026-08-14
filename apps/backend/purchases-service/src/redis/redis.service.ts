import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

// Adquiere N locks (SET NX EX) de forma atómica: si CUALQUIERA de las
// claves ya existe, no se toca ninguna. Evita el caso "A1 y A2 bloqueados,
// A3 ya estaba ocupado" al apartar varios asientos a la vez (Módulo 7 ·
// hold múltiple). Los scripts Lua se ejecutan atómicamente en Redis.
const ACQUIRE_MULTI_LOCK_SCRIPT = `
local ttl = tonumber(ARGV[1])
for i, key in ipairs(KEYS) do
  if redis.call('EXISTS', key) == 1 then
    return 0
  end
end
for i, key in ipairs(KEYS) do
  redis.call('SET', key, ARGV[i + 1], 'EX', ttl)
end
return 1
`;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    this.client.on('error', (err) => console.warn('Redis error:', err.message));
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds = 30): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async setIfAbsent(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.client.set(
      key,
      JSON.stringify(value),
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async delMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.del(...keys);
  }

  /**
   * All-or-nothing: adquiere el lock de cada key en `keys` con el payload
   * en la misma posición de `payloads`. Si alguna key ya está tomada, no
   * adquiere ninguna y devuelve false.
   */
  async acquireMultiLock(
    keys: string[],
    ttlSeconds: number,
    payloads: unknown[],
  ): Promise<boolean> {
    if (keys.length === 0) return true;
    if (keys.length !== payloads.length) {
      throw new Error('keys and payloads must have the same length');
    }

    const serializedPayloads = payloads.map((payload) => JSON.stringify(payload));
    const result = await this.client.eval(
      ACQUIRE_MULTI_LOCK_SCRIPT,
      keys.length,
      ...keys,
      String(ttlSeconds),
      ...serializedPayloads,
    );
    return result === 1;
  }
}
