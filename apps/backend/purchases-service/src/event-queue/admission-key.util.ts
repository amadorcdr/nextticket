/**
 * Clave Redis que representa la admisión temporal (turno de compra) de un
 * usuario para un evento. Es la fuente de verdad en tiempo de ejecución del
 * TTL de admisión; QueueEntry en Postgres solo guarda el registro/auditoría.
 * Se comparte entre event-queue (que la crea al admitir) y purchases (que
 * la consulta antes de permitir un hold de asientos), sin acoplar ambos
 * módulos por inyección de dependencias.
 */
export function buildAdmissionKey(eventId: string, userId: string): string {
  return `admission:event:${eventId}:user:${userId}`;
}
