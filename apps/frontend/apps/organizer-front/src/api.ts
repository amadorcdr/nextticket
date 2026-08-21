/** Forma real de EventStatus en venues-events-service. */
export type ApiEventStatus = "DRAFT" | "PUBLISHED" | "CANCELED" | "SOLD_OUT" | "COMPLETED";

export interface ApiEventZone {
    id: string;
    publicName: string;
    eventPrice: string | number | null;
    availableCapacity: number;
    status: string;
}

export interface ApiEventCategoryAssignment {
    category: { id: string; name: string };
}

/** Forma real de GET /event-categories (listado paginado). */
export interface ApiEventCategory {
    id: string;
    name: string;
    status: "ACTIVE" | "INACTIVE" | "REMOVED";
}

/** Forma real de GET /events (venues-events-service), incluye venue y zonas. */
export interface ApiEvent {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    imageUrl?: string | null;
    description?: string | null;
    status: ApiEventStatus;
    venueId: string;
    venue: { id: string; name: string };
    zones: ApiEventZone[];
    categories: ApiEventCategoryAssignment[];
}

export interface ApiTicketZoneStats {
    eventZoneId: string;
    sold: number;
}

/** Forma real de GET /tickets/stats/by-event-zones (rol organizador/admin). */
export interface ApiTicketsEventZoneStats {
    total: number;
    sold: number;
    validated: number;
    unvalidated: number;
    canceled: number;
    byEventZone: ApiTicketZoneStats[];
}

/** Forma real de GET /venues (listado paginado). */
export interface ApiVenue {
    id: string;
    name: string;
    status: "DRAFT" | "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE" | "REMOVED";
}

export type OrganizerEventStatus = "Activo" | "Inactivo";

export interface OrganizerEventRow {
    id: string;
    name: string;
    venueId: string;
    venue: string;
    date: string;
    time: string;
    startsAt: string;
    endsAt: string;
    imageUrl: string;
    description: string;
    categoryId: string;
    categoryName: string;
    sold: number;
    total: number;
    status: OrganizerEventStatus;
    /** Status real del backend, para cuando "Activo"/"Inactivo" no alcanza a
     *  distinguir (p. ej. Dashboard necesita excluir COMPLETED, que aquí
     *  cuenta como "Activo" pero ya no genera ventas nuevas). */
    rawStatus: ApiEventStatus;
}

/*
 * El organizador solo necesita saber si un evento sigue vigente o no: el
 * status real del backend (DRAFT/PUBLISHED/SOLD_OUT/CANCELED/COMPLETED) se
 * colapsa a 2 valores. Cancelado es el único "Inactivo" — la baja lógica
 * (ver toIsoDateTime más abajo) es justo pasar el evento a CANCELED.
 */
const STATUS_LABEL: Record<ApiEventStatus, OrganizerEventStatus> = {
    DRAFT: "Activo",
    PUBLISHED: "Activo",
    SOLD_OUT: "Activo",
    COMPLETED: "Activo",
    CANCELED: "Inactivo",
};

function formatEventDate(iso: string): string {
    const date = new Date(iso);
    const day = date.toLocaleDateString("es-MX", { day: "2-digit" });
    const month = date.toLocaleDateString("es-MX", { month: "short" }).replace(".", "");
    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
    return `${day} ${capitalizedMonth}, ${date.getFullYear()}`;
}

function formatEventTime(iso: string): string {
    return `${new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })} hrs`;
}

export function toOrganizerEventRow(event: ApiEvent, soldByZone: Map<string, number>): OrganizerEventRow {
    const sold = event.zones.reduce((sum, zone) => sum + (soldByZone.get(zone.id) ?? 0), 0);
    const total = event.zones.reduce((sum, zone) => sum + zone.availableCapacity, 0);

    return {
        id: event.id,
        name: event.name,
        venueId: event.venueId,
        venue: event.venue?.name ?? "Recinto sin asignar",
        date: formatEventDate(event.startsAt),
        time: formatEventTime(event.startsAt),
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        imageUrl: event.imageUrl ?? "",
        description: event.description ?? "",
        categoryId: event.categories[0]?.category.id ?? "",
        categoryName: event.categories[0]?.category.name ?? "",
        sold,
        total,
        status: STATUS_LABEL[event.status],
        rawStatus: event.status,
    };
}

export interface EventFormPayload {
    venueId: string;
    name: string;
    startsAt: string;
    endsAt: string;
    imageUrl?: string;
    description?: string;
}

/** Combina fecha (yyyy-mm-dd) + hora (HH:mm) en un ISO string que el backend acepta. */
export function toIsoDateTime(fecha: string, hora: string): string {
    return new Date(`${fecha}T${hora}:00`).toISOString();
}

/**
 * Sube la imagen de portada de un evento. Va por fuera de useApi() a
 * propósito: ese helper siempre manda Content-Type: application/json y
 * serializa el body con JSON.stringify, lo cual rompe un multipart/form-data
 * (el navegador necesita poner él mismo el boundary del Content-Type).
 */
export async function uploadEventImage(apiBaseUrl: string, eventId: string, file: File, token?: string): Promise<ApiEvent> {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${apiBaseUrl}/events/${eventId}/image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "No se pudo subir la imagen");
    }

    return response.json();
}

// ── Zonas comerciales (GET /events/:eventId/zones) para el editor de canvas ──

export interface ApiEventZonePriceTierDetail {
    id: string;
    eventZoneId: string;
    name: string;
    price: string | number;
    initialCapacity: number | null;
    availableCapacity: number | null;
    startsAt: string | null;
    endsAt: string | null;
    sortOrder: number;
    status: "PENDING" | "ACTIVE" | "EXHAUSTED" | "CLOSED";
}

export interface ApiEventZoneSection {
    sectionId: string;
}

export interface ApiEventSeatDetail {
    id: string;
    status: "AVAILABLE" | "RESERVED" | "SOLD" | "DISABLED";
    lockedUntil: string | null;
    sectionId: string;
    seat: { id: string };
}

export interface ApiEventZoneDetail {
    id: string;
    eventId: string;
    publicName: string;
    admissionType: "RESERVED" | "GENERAL";
    eventPrice: string | number;
    availableCapacity: number;
    mapColor: string | null;
    maxTicketsPerPurchase: number;
    status: "ACTIVE" | "INACTIVE" | "SOLD_OUT";
    priceTiers: ApiEventZonePriceTierDetail[];
    sections: ApiEventZoneSection[];
    eventSeats: ApiEventSeatDetail[];
}

/** Convierte el listado real de GET /events/:eventId/zones al estado que consume CommercialEditor. */
export function toCommercialEventState(eventId: string, eventName: string, apiZones: ApiEventZoneDetail[]) {
    return {
        eventId,
        eventName,
        zones: apiZones.map((z) => ({
            id: z.id,
            eventId: z.eventId,
            publicName: z.publicName,
            admissionType: z.admissionType,
            eventPrice: Number(z.eventPrice),
            availableCapacity: z.availableCapacity,
            mapColor: z.mapColor,
            maxTicketsPerPurchase: z.maxTicketsPerPurchase,
            status: z.status,
            sectionIds: z.sections.map((s) => s.sectionId),
        })),
        priceTiers: apiZones.flatMap((z) =>
            z.priceTiers.map((t) => ({
                id: t.id,
                eventZoneId: t.eventZoneId,
                name: t.name,
                price: Number(t.price),
                initialCapacity: t.initialCapacity,
                availableCapacity: t.availableCapacity,
                startsAt: t.startsAt,
                endsAt: t.endsAt,
                sortOrder: t.sortOrder,
                status: t.status,
            })),
        ),
        eventSeats: apiZones.flatMap((z) =>
            z.eventSeats.map((es) => ({
                id: es.id,
                eventZoneId: z.id,
                seatId: es.seat.id,
                sectionId: es.sectionId,
                lockedUntil: es.lockedUntil,
                status: es.status,
            })),
        ),
    };
}
