import type { AdminEvent, AdminEventStatus } from "./types/admin";
import type { ClientEvent, ClientEventDetail, ClientEventStatus, ClientEventZone } from "./types/client";

/** Forma real de EventStatus en venues-events-service. */
export type ApiEventStatus = "DRAFT" | "PUBLISHED" | "CANCELED" | "SOLD_OUT" | "COMPLETED";

/** Forma real de AdmissionType en venues-events-service. */
export type ApiAdmissionType = "RESERVED" | "GENERAL";

/** Forma real de EventZoneStatus en venues-events-service. */
export type ApiEventZoneStatus = "ACTIVE" | "INACTIVE" | "SOLD_OUT";

export interface ApiEventZone {
    id: string;
    availableCapacity: number;
    /**
     * Estos campos solo vienen completos en GET /events/:id (el detalle usa
     * `include` sin restricción). El listado GET /events los trae con
     * `select`: publicName/eventPrice/availableCapacity/status sí, pero
     * admissionType y maxTicketsPerPurchase no — por eso son opcionales acá.
     */
    publicName?: string;
    /** Prisma Decimal serializado como string en JSON: usa Number() antes de operar. */
    eventPrice?: string;
    admissionType?: ApiAdmissionType;
    status?: ApiEventZoneStatus;
    maxTicketsPerPurchase?: number;
}

export interface ApiEventCategoryAssignment {
    category: { name: string };
}

export interface ApiEventVenue {
    id?: string;
    name: string;
    address?: string;
    city?: string;
    totalCapacity?: number;
}

/** Forma real de GET /events y GET /events/:id (venues-events-service). */
export interface ApiEvent {
    id: string;
    name: string;
    description?: string | null;
    startsAt: string;
    endsAt?: string;
    imageUrl?: string | null;
    status: ApiEventStatus;
    venue: ApiEventVenue;
    zones: ApiEventZone[];
    categories: ApiEventCategoryAssignment[];
}

/** Forma real de EventSeatStatus en venues-events-service. */
export type ApiEventSeatStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "DISABLED";

export type ApiSeatType = "STANDARD" | "VIP" | "PREMIUM" | "ACCESSIBLE";

/** Forma real de GET /events/:eventId/seats (venues-events-service). */
export interface ApiEventSeat {
    /** EventSeat.id: es el id que se usa para el hold, no seat.id. */
    id: string;
    eventZoneId: string;
    sectionId: string;
    status: ApiEventSeatStatus;
    lockedUntil: string | null;
    seat: { id: string; row: string; number: string; type: ApiSeatType };
}

export interface ApiTicketZoneCount {
    eventZoneId: string;
    count: number;
}

/** Forma real de GET /tickets/stats (tickets-service). */
export interface ApiTicketsStats {
    totalSold: number;
    byEventZone: ApiTicketZoneCount[];
}

/** Forma genérica de una respuesta paginada del gateway ({data, meta}). */
export interface Paginated<T> {
    data: T[];
    meta?: {
        total?: number;
        page?: number;
        limit?: number;
        hasNextPage?: boolean;
    };
}

const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop";

function toAdminEventStatus(status: ApiEventStatus, startsAt: string): AdminEventStatus {
    switch (status) {
        case "DRAFT":
            return "borrador";
        case "CANCELED":
            return "cancelado";
        case "COMPLETED":
            return "finalizado";
        case "SOLD_OUT":
            return "activo";
        case "PUBLISHED":
        default:
            return new Date(startsAt).getTime() > Date.now() ? "proximo" : "activo";
    }
}

export function formatEventDate(iso: string): string {
    const date = new Date(iso);
    const day = date.toLocaleDateString("es-MX", { day: "2-digit" });
    const month = date.toLocaleDateString("es-MX", { month: "short" }).replace(".", "");
    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
    return `${day} ${capitalizedMonth}, ${date.getFullYear()}`;
}

export function formatEventTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function toAdminEvent(event: ApiEvent, ticketCountByZone: Map<string, number>): AdminEvent {
    const ticketsSold = event.zones.reduce((sum, zone) => sum + (ticketCountByZone.get(zone.id) ?? 0), 0);
    const totalSeats = event.zones.reduce((sum, zone) => sum + zone.availableCapacity, 0);

    return {
        id: event.id,
        title: event.name,
        imageUrl: event.imageUrl || FALLBACK_IMAGE_URL,
        category: event.categories[0]?.category.name ?? "Sin categoría",
        date: formatEventDate(event.startsAt),
        time: formatEventTime(event.startsAt),
        venue: event.venue?.name ?? "Recinto sin asignar",
        status: toAdminEventStatus(event.status, event.startsAt),
        ticketsSold,
        totalSeats,
    };
}

function toClientEventStatus(status: ApiEventStatus): ClientEventStatus {
    return status === "SOLD_OUT" ? "sold-out" : "available";
}

/** Zonas activas y con precio válido: base para "desde $X" y para saber si hay algo que vender. */
function sellableZones(zones: ApiEventZone[]): ApiEventZone[] {
    return zones.filter((zone) => zone.status !== "INACTIVE" && zone.eventPrice !== undefined);
}

/** Catálogo y tarjetas: la forma ligera que ya consume EventCard. */
export function toClientEvent(event: ApiEvent): ClientEvent {
    const zones = sellableZones(event.zones);
    const minPrice = zones.length > 0 ? Math.min(...zones.map((zone) => Number(zone.eventPrice))) : 0;

    return {
        id: event.id,
        title: event.name,
        category: event.categories[0]?.category.name ?? "Sin categoría",
        venue: event.venue?.name ?? "Recinto sin asignar",
        city: event.venue?.city ?? "",
        date: formatEventDate(event.startsAt),
        time: formatEventTime(event.startsAt),
        imageUrl: event.imageUrl || FALLBACK_IMAGE_URL,
        description: event.description ?? "",
        status: toClientEventStatus(event.status),
        minPrice,
        currency: "MXN",
        availableSeats: event.zones.reduce((sum, zone) => sum + zone.availableCapacity, 0),
        totalSeats: event.venue?.totalCapacity ?? 0,
    };
}

/** Descripción derivada de datos reales de la zona (no hay campo "description" en EventZone). */
function describeZone(zone: ApiEventZone): string {
    const kind = zone.admissionType === "GENERAL" ? "Admisión general" : "Asiento numerado";
    return `${kind} · ${zone.availableCapacity.toLocaleString("es-MX")} disponibles`;
}

/** Detalle del evento (GET /events/:id): incluye zonas completas y venue completo. */
export function toClientEventDetail(event: ApiEvent): ClientEventDetail {
    const base = toClientEvent(event);

    const zones: ClientEventZone[] = sellableZones(event.zones).map((zone) => ({
        id: zone.id,
        name: zone.publicName ?? "Zona",
        description: describeZone(zone),
        price: Number(zone.eventPrice),
        admissionType: zone.admissionType ?? "RESERVED",
        availableCapacity: zone.availableCapacity,
        maxTicketsPerPurchase: zone.maxTicketsPerPurchase ?? 10,
    }));

    return {
        ...base,
        zones,
        venueInfo: {
            name: event.venue?.name ?? "Recinto sin asignar",
            address: event.venue?.address ?? "",
            city: event.venue?.city ?? "",
            totalCapacity: event.venue?.totalCapacity ?? 0,
        },
    };
}
