import { useEffect, useMemo, useState } from "react";
import { ApiError, Button, Pagination, ScrollShadow, useApi } from "@nextticket-frontend/commons";
import { AdminEventCard } from "../components/AdminEventCard";
import { AdminEventFilters } from "../components/AdminEventFilters";
import { toAdminEvent, type ApiEvent, type ApiTicketsStats } from "../api";
import type { AdminEvent, AdminEventStatus } from "../types/admin";

// El backend no soporta busqueda por texto en la query todavia (solo
// page/limit): se trae una sola pagina grande y se filtra en el cliente,
// mismo patron que UsersView/VenuesModule.
const FETCH_LIMIT = 100;
const PAGE_SIZE = 8;

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
    const [page, setPage] = useState(1);

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

    useEffect(() => setPage(1), [search, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, filtered.length);
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    return (
        <div className="flex flex-col gap-3 h-full animate-in fade-in duration-500">
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
                <>
                    <ScrollShadow className="flex-1 overflow-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {paginated.map((event) => (
                                <AdminEventCard key={event.id} event={event} />
                            ))}
                        </div>
                    </ScrollShadow>

                    <div className="shrink-0 flex justify-center md:justify-between items-center flex-wrap gap-4">
                        <Pagination size="sm">
                            <Pagination.Summary>
                                <div className="flex items-center gap-4">
                                    <span className="text-muted">
                                        <span className="text-foreground font-medium">{start}</span> al{" "}
                                        <span className="text-foreground font-medium">{end}</span> de{" "}
                                        <span className="text-foreground font-medium">{filtered.length}</span> resultados
                                    </span>
                                </div>
                            </Pagination.Summary>
                            <Pagination.Content>
                                <Pagination.Item>
                                    <Pagination.Previous isDisabled={currentPage <= 1} onPress={() => setPage((p) => p - 1)}>
                                        <Pagination.PreviousIcon />
                                        Anterior
                                    </Pagination.Previous>
                                </Pagination.Item>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                    <Pagination.Item key={p}>
                                        <Pagination.Link isActive={p === currentPage} onPress={() => setPage(p)}>
                                            {p}
                                        </Pagination.Link>
                                    </Pagination.Item>
                                ))}
                                <Pagination.Item>
                                    <Pagination.Next isDisabled={currentPage >= totalPages} onPress={() => setPage((p) => p + 1)}>
                                        Siguiente
                                        <Pagination.NextIcon />
                                    </Pagination.Next>
                                </Pagination.Item>
                            </Pagination.Content>
                        </Pagination>
                    </div>
                </>
            )}
        </div>
    );
}
