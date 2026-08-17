import Redis from 'ioredis';

/**
 * BullMQ necesita su propia conexión ioredis (requiere
 * maxRetriesPerRequest: null para sus comandos bloqueantes) — no puede
 * reutilizar la instancia de RedisService, que está pensada para
 * get/set/setIfAbsent con timeouts normales. Sigue apuntando al MISMO
 * Redis del docker-compose existente, no es una instancia nueva.
 */
export function createBullMQConnection(): Redis {
  const client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  client.on('error', (err) => console.warn('BullMQ Redis error:', err.message));
  return client;
}
