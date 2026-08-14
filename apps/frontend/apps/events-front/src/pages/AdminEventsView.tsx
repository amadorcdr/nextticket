import { useEffect, useMemo, useState } from "react";
import { ApiError, Button, useApi } from "@nextticket-frontend/commons";
import { AdminEventCard } from "../components/AdminEventCard";
import { AdminEventFilters } from "../components/AdminEventFilters";
import { toAdminEvent, type ApiEvent, type ApiTicketsStats } from "../api";
import type { AdminEvent, AdminEventStatus } from "../types/admin";

// El backend no soporta busqueda por texto en la query todavia (solo
// page/limit): se trae una sola pagina grande y se filtra en el cliente,
// mismo patron que UsersView/VenuesModule.
const FETCH_LIMIT = 100;

interface Paginated<T> {
    data: T[];
}

export function AdminEventsView() {
    const api = useApi();

    const [events, setEvents] = useState<AdminEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<AdminEventStatus | "all">("all");

    const load = () => {
        setLoading(true);
        setError(null);

        Promise.all([
            api.get<Paginated<ApiEvent>>(`/events?limit=${FETCH_LIMIT}`),
            api.get<ApiTicketsStats>("/tickets/stats"),
        ])
            .then(([eventsRes, ticketsStats]) => {
                const ticketCountByZone = new Map(ticketsStats.byEventZone.map((zone) => [zone.eventZoneId, zone.count]));
                setEvents(eventsRes.data.map((event) => toAdminEvent(event, ticketCountByZone)));
            })
            .catch((err) => {
                setError(err instanceof ApiError ? err.message : "No se pudieron cargar los eventos");
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const filtered = useMemo(() => {
        const query = search.toLowerCase();
        return events.filter((ev) => {
            const matchesStatus = statusFilter === "all" || ev.status === statusFilter;
            const matchesSearch = !query || ev.title.toLowerCase().includes(query) || ev.venue.toLowerCase().includes(query);
            return matchesStatus && matchesSearch;
        });
    }, [events, search, statusFilter]);

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500">
            <div>
                <h3>Eventos</h3>
                <p className="text-muted text-xs mt-0.5">Consulta el catálogo completo de eventos de la plataforma.</p>
            </div>

            <AdminEventFilters
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
            />

            {loading && <p className="text-muted text-xs py-8 text-center">Cargando eventos...</p>}

            {!loading && error && (
                <div className="flex flex-col items-center gap-3 py-8">
                    <p className="text-muted text-xs text-center">{error}</p>
                    <Button size="sm" onPress={load}>
                        Reintentar
                    </Button>
                </div>
            )}

            {!loading && !error && filtered.length === 0 && (
                <p className="text-muted text-xs py-8 text-center">No hay eventos que coincidan con la búsqueda.</p>
            )}

            {!loading && !error && filtered.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map((event) => (
                        <AdminEventCard key={event.id} event={event} />
                    ))}
                </div>
            )}
        </div>
    );
}
