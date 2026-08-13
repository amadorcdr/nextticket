import { useEffect, useState } from "react";
import { ApiError, useApi } from "@nextticket-frontend/commons";
import {
    toActivityFromPurchase,
    toActivityFromUser,
    toEventOccupancy,
    toUpcomingEventSummary,
    type ApiEvent,
    type ApiEventsStats,
    type ApiPurchase,
    type ApiPurchasesStats,
    type ApiTicketsStats,
    type ApiUserSummary,
    type DashboardMetrics,
    type EventOccupancy,
    type RecentActivityItem,
    type UpcomingEventSummary,
} from "../types/dashboard";

const RECENT_LIMIT = 5;
const ACTIVITY_LIMIT = 6;

interface Paginated<T> {
    data: T[];
    meta: { total: number };
}

interface DashboardData {
    metrics: DashboardMetrics;
    upcomingEvents: UpcomingEventSummary[];
    activity: RecentActivityItem[];
    occupancy: EventOccupancy[];
}

type ActivitySource =
    | { kind: "purchase"; at: string; purchase: ApiPurchase }
    | { kind: "user"; at: string; user: ApiUserSummary };

export function useDashboardData() {
    const api = useApi();

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);

        Promise.all([
            api.get<ApiEventsStats>("/events/stats"),
            api.get<ApiTicketsStats>("/tickets/stats"),
            api.get<ApiPurchasesStats>("/purchases/stats"),
            api.get<Paginated<ApiUserSummary>>(`/users?page=1&limit=${RECENT_LIMIT}`),
            api.get<Paginated<ApiEvent>>(`/events?upcoming=true&limit=${RECENT_LIMIT}`),
            api.get<Paginated<ApiPurchase>>(`/purchases?page=1&limit=${RECENT_LIMIT}`),
        ])
            .then(async ([eventsStats, ticketsStats, purchasesStats, usersRes, upcomingRes, purchasesRes]) => {
                const ticketCountByZone = new Map(ticketsStats.byEventZone.map((z) => [z.eventZoneId, z.count]));

                const upcomingEvents = upcomingRes.data.map((event) => toUpcomingEventSummary(event, ticketCountByZone));
                const occupancy = upcomingRes.data.map((event) => toEventOccupancy(event, ticketCountByZone));

                // Enriquecimiento acotado: solo sobre las compras recientes (ventana chica),
                // no existe endpoint de "traer muchos por ids" en auth-service/venues-events-service.
                const uniqueUserIds = [...new Set(purchasesRes.data.map((p) => p.userId))];
                const uniqueEventIds = [...new Set(purchasesRes.data.map((p) => p.eventId))];

                const [buyers, buyerEvents] = await Promise.all([
                    Promise.all(uniqueUserIds.map((id) => api.get<ApiUserSummary>(`/users/${id}`).catch(() => null))),
                    Promise.all(uniqueEventIds.map((id) => api.get<ApiEvent>(`/events/${id}`).catch(() => null))),
                ]);

                const buyerNameById = new Map(
                    buyers.filter((buyer): buyer is ApiUserSummary => buyer !== null).map((buyer) => [buyer.id, buyer.name]),
                );
                const eventNameById = new Map(
                    buyerEvents.filter((event): event is ApiEvent => event !== null).map((event) => [event.id, event.name]),
                );

                const sources: ActivitySource[] = [
                    ...purchasesRes.data.map((purchase): ActivitySource => ({ kind: "purchase", at: purchase.createdAt, purchase })),
                    ...usersRes.data.map((user): ActivitySource => ({ kind: "user", at: user.createdAt, user })),
                ];

                const activity = sources
                    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                    .slice(0, ACTIVITY_LIMIT)
                    .map((source) =>
                        source.kind === "purchase"
                            ? toActivityFromPurchase(
                                  source.purchase,
                                  buyerNameById.get(source.purchase.userId) ?? "Un usuario",
                                  eventNameById.get(source.purchase.eventId) ?? "un evento",
                              )
                            : toActivityFromUser(source.user),
                    );

                const metrics: DashboardMetrics = {
                    totalEvents: eventsStats.totalEvents,
                    activeEvents: eventsStats.activeEvents,
                    upcomingEvents: eventsStats.upcomingEvents,
                    totalUsers: usersRes.meta.total,
                    ticketsSold: ticketsStats.totalSold,
                    totalRevenue: purchasesStats.totalRevenue,
                    recentPurchasesCount: purchasesStats.recentPurchasesCount,
                };

                setData({ metrics, upcomingEvents, activity, occupancy });
            })
            .catch((err) => {
                setError(err instanceof ApiError ? err.message : "No se pudo cargar el panel de administración");
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    return { data, loading, error, retry: load };
}
