/**
 * Formas reales devueltas por los endpoints del backend consumidos por el
 * Dashboard de Administrador, y los tipos de UI que consumen los componentes
 * existentes (mismo patrón que apps/frontend/apps/users-front/src/types/user.ts).
 */

// ── Api*: forma real del backend ──────────────────────────────

export interface ApiEventsStats {
    totalEvents: number;
    activeEvents: number;
    upcomingEvents: number;
}

export interface ApiTicketZoneCount {
    eventZoneId: string;
    count: number;
}

export interface ApiTicketsStats {
    totalSold: number;
    byEventZone: ApiTicketZoneCount[];
}

export interface ApiPurchasesStats {
    totalRevenue: number;
    recentPurchasesCount: number;
}

/** Forma real de EventStatus en venues-events-service. */
export type ApiEventStatus = "DRAFT" | "PUBLISHED" | "CANCELED" | "SOLD_OUT" | "COMPLETED";

export interface ApiEventZone {
    id: string;
    publicName: string;
    eventPrice: number;
    availableCapacity: number;
    status: string;
}

/** Subconjunto de GET /events relevante para el Dashboard. */
export interface ApiEvent {
    id: string;
    name: string;
    startsAt: string;
    status: ApiEventStatus;
    venue: { name: string };
    zones: ApiEventZone[];
}

export interface ApiPurchaseDetail {
    id: string;
}

/** Forma real de GET /purchases (Purchase de purchases-service). */
export interface ApiPurchase {
    id: string;
    userId: string;
    eventId: string;
    total: number;
    status: "PENDING" | "CONFIRMED" | "CANCELED" | "REFUNDED";
    createdAt: string;
    details: ApiPurchaseDetail[];
}

/** Subconjunto de GET /users relevante para el Dashboard. */
export interface ApiUserSummary {
    id: string;
    name: string;
    email: string;
    createdAt: string;
}

// ── Tipos de UI (misma forma que usaban los mocks) ────────────

export interface DashboardMetrics {
    totalEvents: number;
    activeEvents: number;
    upcomingEvents: number;
    totalUsers: number;
    ticketsSold: number;
    totalRevenue: number;
    recentPurchasesCount: number;
}

export type UpcomingEventStatus = "proximo" | "activo" | "finalizado" | "cancelado" | "borrador";

export interface UpcomingEventSummary {
    id: string;
    name: string;
    date: string;
    venue: string;
    status: UpcomingEventStatus;
    ticketsSold: number;
    totalSeats: number;
}

export type ActivityType = "compra" | "evento_creado" | "usuario_registrado" | "evento_actualizado";

export interface RecentActivityItem {
    id: string;
    type: ActivityType;
    description: string;
    date: string;
}

export interface EventOccupancy {
    label: string;
    occupancyPercentage: number;
}

// ── Mappers ─────────────────────────────────────────────────

export function toUiEventStatus(status: ApiEventStatus, startsAt: string): UpcomingEventStatus {
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
    return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export function formatRelativeDate(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

    if (diffMinutes < 1) return "Justo ahora";
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;

    const diffDays = Math.round(diffHours / 24);
    return diffDays === 1 ? "Hace 1 día" : `Hace ${diffDays} días`;
}

function ticketsSoldForEvent(event: ApiEvent, ticketCountByZone: Map<string, number>): number {
    return event.zones.reduce((sum, zone) => sum + (ticketCountByZone.get(zone.id) ?? 0), 0);
}

function totalCapacityForEvent(event: ApiEvent): number {
    return event.zones.reduce((sum, zone) => sum + zone.availableCapacity, 0);
}

export function toUpcomingEventSummary(event: ApiEvent, ticketCountByZone: Map<string, number>): UpcomingEventSummary {
    return {
        id: event.id,
        name: event.name,
        date: formatEventDate(event.startsAt),
        venue: event.venue?.name ?? "Recinto sin asignar",
        status: toUiEventStatus(event.status, event.startsAt),
        ticketsSold: ticketsSoldForEvent(event, ticketCountByZone),
        totalSeats: totalCapacityForEvent(event),
    };
}

export function toEventOccupancy(event: ApiEvent, ticketCountByZone: Map<string, number>): EventOccupancy {
    const capacity = totalCapacityForEvent(event);
    const sold = ticketsSoldForEvent(event, ticketCountByZone);
    const occupancyPercentage = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;

    return {
        label: event.name,
        occupancyPercentage: Math.min(100, occupancyPercentage),
    };
}

export function toActivityFromPurchase(purchase: ApiPurchase, buyerName: string, eventName: string): RecentActivityItem {
    const quantity = purchase.details.length;
    const ticketsLabel = quantity === 1 ? "boleto" : "boletos";

    return {
        id: `purchase-${purchase.id}`,
        type: "compra",
        description: `${buyerName} compró ${quantity} ${ticketsLabel} para ${eventName}`,
        date: formatRelativeDate(purchase.createdAt),
    };
}

export function toActivityFromUser(user: ApiUserSummary): RecentActivityItem {
    return {
        id: `user-${user.id}`,
        type: "usuario_registrado",
        description: `Nuevo usuario registrado: ${user.name}`,
        date: formatRelativeDate(user.createdAt),
    };
}
