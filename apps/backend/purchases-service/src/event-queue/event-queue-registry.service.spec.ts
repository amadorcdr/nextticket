import { EventQueueRegistryService } from './event-queue-registry.service';

/**
 * Módulo 31 del TODO: la alta demanda de un evento no debe bloquear la fila
 * de otro. Usa BullMQ/Redis reales (no mocks): la garantía que importa es
 * que cada evento tenga su propia Queue con su propio nombre, y que los
 * jobs de una no aparezcan en la otra.
 */
describe('EventQueueRegistryService (BullMQ/Redis real): aislamiento entre eventos', () => {
  let registry: EventQueueRegistryService;
  const eventA = `test-event-a-${Date.now()}`;
  const eventB = `test-event-b-${Date.now()}`;

  beforeAll(() => {
    registry = new EventQueueRegistryService();
  });

  afterAll(async () => {
    await registry.onModuleDestroy();
  });

  it('crea una Queue independiente por evento y no mezcla jobs entre ellas', async () => {
    const queueA = registry.getQueue(eventA);
    const queueB = registry.getQueue(eventB);

    expect(queueA.name).not.toEqual(queueB.name);
    expect(registry.getQueue(eventA)).toBe(queueA); // reutiliza la misma instancia

    await queueA.add('admit', { queueEntryId: '1', userId: 'u1', eventId: eventA });
    await queueA.add('admit', { queueEntryId: '2', userId: 'u2', eventId: eventA });

    const countsA = await queueA.getJobCounts('waiting');
    const countsB = await queueB.getJobCounts('waiting');

    expect(countsA.waiting).toBe(2);
    expect(countsB.waiting).toBe(0);

    await queueA.obliterate({ force: true });
    await queueB.obliterate({ force: true });
  }, 15000);
});
