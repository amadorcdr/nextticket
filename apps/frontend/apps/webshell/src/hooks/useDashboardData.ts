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

// Cuántos eventos próximos se traen (alimenta tanto "Eventos Próximos" como
// "Resumen de Ventas" — comparten el mismo fetch).
const UPCOMING_EVENTS_LIMIT = 4;
// El backend no deja filtrar por varios status a la vez (solo uno), así que
// se pide un colchón más grande sin filtrar y se recorta del lado del
// cliente a PUBLISHED/SOLD_OUT — si no, un DRAFT con fecha más próxima le
// gana el lugar a un evento real solo por venir antes en la fecha.
const UPCOMING_EVENTS_FETCH_LIMIT = 20;
const VISIBLE_UPCOMING_STATUSES = new Set(["PUBLISHED", "SOLD_OUT"]);
// Tope final de "Actividad Reciente". Los fetches de usuarios/compras piden
// esta misma cantidad cada uno, para que el pool combinado siempre alcance
// para llenar el tope tras mezclarlos y ordenarlos por fecha.
const ACTIVITY_LIMIT = 7;

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
            api.get<Paginated<ApiUserSummary>>(`/users?page=1&limit=${ACTIVITY_LIMIT}`),
            api.get<{ meta: { total: number } }>("/venues?page=1&limit=1"),
            api.get<Paginated<ApiEvent>>(`/events?upcoming=true&limit=${UPCOMING_EVENTS_FETCH_LIMIT}`),
            api.get<Paginated<ApiPurchase>>(`/purchases?page=1&limit=${ACTIVITY_LIMIT}`),
        ])
            .then(async ([eventsStats, ticketsStats, purchasesStats, usersRes, venuesRes, upcomingRes, purchasesRes]) => {
                const ticketCountByZone = new Map(ticketsStats.byEventZone.map((z) => [z.eventZoneId, z.count]));

                // El backend ya regresa esto ordenado por fecha (startsAt asc),
                // que es justo el orden que "Eventos Próximos" necesita.
                const visibleUpcoming = upcomingRes.data.filter((event) => VISIBLE_UPCOMING_STATUSES.has(event.status));
                const upcomingEvents = visibleUpcoming
                    .slice(0, UPCOMING_EVENTS_LIMIT)
                    .map((event) => toUpcomingEventSummary(event, ticketCountByZone));

                // "Resumen de Ventas" es otro orden: los de mayor % de ocupación
                // primero, sin importar qué tan próxima sea su fecha.
                const occupancy = visibleUpcoming
                    .map((event) => toEventOccupancy(event, ticketCountByZone))
                    .sort((a, b) => b.occupancyPercentage - a.occupancyPercentage)
                    .slice(0, UPCOMING_EVENTS_LIMIT);

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
                    totalVenues: venuesRes.meta.total,
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
