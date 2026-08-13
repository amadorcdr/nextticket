/**
 * Formas reales de los endpoints consumidos por el resumen de ventas de un
 * evento (GET /events/:id, GET /tickets/stats/by-event-zones,
 * GET /purchases/stats, GET /purchases), y los tipos de UI que consume
 * EventSalesSummary.tsx. Mismo patrón que
 * apps/frontend/apps/users-front/src/types/user.ts.
 */

// ── Api*: forma real del backend ──────────────────────────────

export type ApiEventStatus = "DRAFT" | "PUBLISHED" | "CANCELED" | "SOLD_OUT" | "COMPLETED";

export interface ApiEventZone {
    id: string;
    publicName: string;
    eventPrice: number;
    availableCapacity: number;
}

export interface ApiEvent {
    id: string;
    name: string;
    startsAt: string;
    status: ApiEventStatus;
    venue: { name: string };
    zones: ApiEventZone[];
}

export interface ApiTicketZoneStatusCounts {
    eventZoneId: string;
    total: number;
    sold: number;
    validated: number;
    unvalidated: number;
    canceled: number;
}

export interface ApiTicketsEventZoneStats {
    total: number;
    sold: number;
    validated: number;
    unvalidated: number;
    canceled: number;
    byEventZone: ApiTicketZoneStatusCounts[];
}

export interface ApiPurchaseZoneRevenue {
    eventZoneId: string;
    revenue: number;
}

export interface ApiPurchasesStats {
    totalRevenue: number;
    recentPurchasesCount: number;
    byEventZone?: ApiPurchaseZoneRevenue[];
}

export interface ApiPurchaseDetail {
    id: string;
}

export type ApiPurchaseStatus = "PENDING" | "CONFIRMED" | "CANCELED" | "REFUNDED";

/** Purchase.folio es BigInt en el backend; viaja como string (o null si el pago no fue aprobado). */
export interface ApiPurchase {
    id: string;
    folio: string | null;
    userId: string;
    total: number;
    status: ApiPurchaseStatus;
    createdAt: string;
    details: ApiPurchaseDetail[];
}

export interface ApiUserSummary {
    id: string;
    name: string;
    email: string;
}

// ── Tipos de UI ─────────────────────────────────────────────

export interface EventSummary {
    id: string;
    name: string;
    date: string;
    venue: string;
}

export interface EventSalesMetrics {
    totalTickets: number;
    sold: number;
    validated: number;
    unvalidated: number;
    available: number;
    canceled: number;
    occupancyPercentage: number;
    totalRevenue: number;
}

export interface ZoneSalesRow {
    zoneId: string;
    label: string;
    capacity: number;
    sold: number;
    available: number;
    revenue: number;
}

export type PurchaseStatusLabel = "Pendiente" | "Completada" | "Cancelada" | "Reembolsada";

export interface RecentPurchaseRow {
    id: string;
    folio: string;
    buyer: string;
    quantity: number;
    total: number;
    date: string;
    status: ApiPurchaseStatus;
    statusLabel: PurchaseStatusLabel;
}

// ── Mappers ─────────────────────────────────────────────────

export function formatEventDate(iso: string): string {
    return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

export function formatPurchaseDate(iso: string): string {
    return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const PURCHASE_STATUS_LABEL: Record<ApiPurchaseStatus, PurchaseStatusLabel> = {
    PENDING: "Pendiente",
    CONFIRMED: "Completada",
    CANCELED: "Cancelada",
    REFUNDED: "Reembolsada",
};

export function toEventSummary(event: ApiEvent): EventSummary {
    return {
        id: event.id,
        name: event.name,
        date: formatEventDate(event.startsAt),
        venue: event.venue?.name ?? "Recinto sin asignar",
    };
}

export function toZoneSalesRows(
    zones: ApiEventZone[],
    ticketStats: ApiTicketsEventZoneStats,
    revenueByZone: ApiPurchaseZoneRevenue[],
): ZoneSalesRow[] {
    const soldByZone = new Map(ticketStats.byEventZone.map((z) => [z.eventZoneId, z.sold]));
    const revenueMap = new Map(revenueByZone.map((z) => [z.eventZoneId, z.revenue]));

    return zones.map((zone) => {
        const sold = soldByZone.get(zone.id) ?? 0;
        return {
            zoneId: zone.id,
            label: zone.publicName,
            capacity: zone.availableCapacity,
            sold,
            available: Math.max(0, zone.availableCapacity - sold),
            revenue: revenueMap.get(zone.id) ?? 0,
        };
    });
}

export function toEventSalesMetrics(
    zones: ApiEventZone[],
    ticketStats: ApiTicketsEventZoneStats,
    purchasesStats: ApiPurchasesStats,
): EventSalesMetrics {
    const totalCapacity = zones.reduce((sum, zone) => sum + zone.availableCapacity, 0);
    const available = Math.max(0, totalCapacity - ticketStats.sold);
    const occupancyPercentage = totalCapacity > 0 ? Math.min(100, Math.round((ticketStats.sold / totalCapacity) * 100)) : 0;

    return {
        totalTickets: ticketStats.total,
        sold: ticketStats.sold,
        validated: ticketStats.validated,
        unvalidated: ticketStats.unvalidated,
        available,
        canceled: ticketStats.canceled,
        occupancyPercentage,
        totalRevenue: purchasesStats.totalRevenue,
    };
}

export function toRecentPurchaseRow(purchase: ApiPurchase, buyerName: string): RecentPurchaseRow {
    return {
        id: purchase.id,
        folio: purchase.folio ?? "—",
        buyer: buyerName,
        quantity: purchase.details.length,
        total: purchase.total,
        date: formatPurchaseDate(purchase.createdAt),
        status: purchase.status,
        statusLabel: PURCHASE_STATUS_LABEL[purchase.status],
    };
}
