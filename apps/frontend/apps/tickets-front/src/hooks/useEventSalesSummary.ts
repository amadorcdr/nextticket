import { useEffect, useState } from "react";
import { ApiError, useApi } from "@nextticket-frontend/commons";
import {
    toEventSalesMetrics,
    toEventSummary,
    toRecentPurchaseRow,
    toZoneSalesRows,
    type ApiEvent,
    type ApiPurchase,
    type ApiPurchasesStats,
    type ApiTicketsEventZoneStats,
    type ApiUserSummary,
    type EventSalesMetrics,
    type EventSummary,
    type RecentPurchaseRow,
    type ZoneSalesRow,
} from "../types/eventSales";

const RECENT_PURCHASES_LIMIT = 5;

const EMPTY_TICKET_STATS: ApiTicketsEventZoneStats = {
    total: 0,
    sold: 0,
    validated: 0,
    unvalidated: 0,
    canceled: 0,
    byEventZone: [],
};

interface Paginated<T> {
    data: T[];
}

interface EventSalesData {
    event: EventSummary;
    metrics: EventSalesMetrics;
    zones: ZoneSalesRow[];
    recentPurchases: RecentPurchaseRow[];
}

export function useEventSalesSummary(eventId: string | undefined) {
    const api = useApi();

    const [data, setData] = useState<EventSalesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    const load = () => {
        if (!eventId) return;

        setLoading(true);
        setError(null);
        setNotFound(false);

        api.get<ApiEvent>(`/events/${eventId}`)
            .then(async (event) => {
                const eventZoneIds = event.zones.map((zone) => zone.id);

                const [ticketStats, purchasesStats, purchasesRes] = await Promise.all([
                    eventZoneIds.length > 0
                        ? api.get<ApiTicketsEventZoneStats>(`/tickets/stats/by-event-zones?eventZoneIds=${encodeURIComponent(eventZoneIds.join(","))}`)
                        : Promise.resolve(EMPTY_TICKET_STATS),
                    api.get<ApiPurchasesStats>(`/purchases/stats?eventId=${eventId}`),
                    api.get<Paginated<ApiPurchase>>(`/purchases?eventId=${eventId}&page=1&limit=${RECENT_PURCHASES_LIMIT}`),
                ]);

                // Enriquecimiento acotado: solo sobre las compras recientes (ventana chica).
                const uniqueUserIds = [...new Set(purchasesRes.data.map((purchase) => purchase.userId))];
                const buyers = await Promise.all(
                    uniqueUserIds.map((id) => api.get<ApiUserSummary>(`/users/${id}`).catch(() => null)),
                );
                const buyerNameById = new Map(
                    buyers.filter((buyer): buyer is ApiUserSummary => buyer !== null).map((buyer) => [buyer.id, buyer.name]),
                );

                setData({
                    event: toEventSummary(event),
                    metrics: toEventSalesMetrics(event.zones, ticketStats, purchasesStats),
                    zones: toZoneSalesRows(event.zones, ticketStats, purchasesStats.byEventZone ?? []),
                    recentPurchases: purchasesRes.data.map((purchase) =>
                        toRecentPurchaseRow(purchase, buyerNameById.get(purchase.userId) ?? "Un usuario"),
                    ),
                });
            })
            .catch((err) => {
                if (err instanceof ApiError && err.status === 404) {
                    setNotFound(true);
                } else {
                    setError(err instanceof ApiError ? err.message : "No se pudo cargar el resumen de ventas");
                }
            })
            .finally(() => setLoading(false));
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, [eventId]);

    return { data, loading, error, notFound, retry: load };
}
