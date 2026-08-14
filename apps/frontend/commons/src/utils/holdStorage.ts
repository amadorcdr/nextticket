/**
 * Estado del bloqueo temporal (hold) de asientos entre "elegir asientos" y
 * "confirmar compra". Se guarda en sessionStorage (no en CartProvider, que
 * ya extiende otro proceso en paralelo) para sobrevivir un refresh dentro
 * del mismo tramo de navegación, y vive en commons porque lo escriben
 * events-front (SeatSelection) y lo leen purchases-front (Checkout): son
 * paquetes npm distintos, así que no pueden compartir estado de componente.
 *
 * `seatMap` conecta cada CartSeat.id (real EventSeat.id para asientos
 * numerados, o un id sintético "general-{eventZoneId}-{n}" para admisión
 * general) con la zona/precio real que necesita el backend en
 * POST /purchases — CartSeat solo trae el nombre de la zona, no su id.
 */
export interface HeldSeatInfo {
    eventZoneId: string;
    eventSeatId: string | null;
    unitPrice: number;
}

export interface StoredHold {
    eventId: string;
    /** El más próximo entre todas las zonas hold-eadas: el que manda para el contador. */
    expiresAt: string;
    /** Todos los TemporaryBlock.id de todas las zonas, para mandar como temporaryBlockIds. */
    blockIds: string[];
    seatMap: Record<string, HeldSeatInfo>;
}

function storageKey(eventId: string): string {
    return `nextticket:hold:${eventId}`;
}

export function getStoredHold(eventId: string): StoredHold | null {
    try {
        const raw = window.sessionStorage.getItem(storageKey(eventId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredHold;
        return parsed.eventId === eventId ? parsed : null;
    } catch {
        return null;
    }
}

export function setStoredHold(hold: StoredHold): void {
    try {
        window.sessionStorage.setItem(storageKey(hold.eventId), JSON.stringify(hold));
    } catch {
        // Sin storage no persiste entre refresh, pero el flujo sigue funcionando en memoria.
    }
}

export function clearStoredHold(eventId: string): void {
    try {
        window.sessionStorage.removeItem(storageKey(eventId));
    } catch {
        // Nada que limpiar si el storage no está disponible.
    }
}
