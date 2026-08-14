import type { AdminEvent, AdminEventStatus } from "./types/admin";

/** Forma real de EventStatus en venues-events-service. */
export type ApiEventStatus = "DRAFT" | "PUBLISHED" | "CANCELED" | "SOLD_OUT" | "COMPLETED";

export interface ApiEventZone {
    id: string;
    availableCapacity: number;
}

export interface ApiEventCategoryAssignment {
    category: { name: string };
}

/** Forma real de GET /events (venues-events-service). */
export interface ApiEvent {
    id: string;
    name: string;
    startsAt: string;
    imageUrl?: string | null;
    status: ApiEventStatus;
    venue: { name: string };
    zones: ApiEventZone[];
    categories: ApiEventCategoryAssignment[];
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

function formatEventDate(iso: string): string {
    const date = new Date(iso);
    const day = date.toLocaleDateString("es-MX", { day: "2-digit" });
    const month = date.toLocaleDateString("es-MX", { month: "short" }).replace(".", "");
    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
    return `${day} ${capitalizedMonth}, ${date.getFullYear()}`;
}

function formatEventTime(iso: string): string {
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
