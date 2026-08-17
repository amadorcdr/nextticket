import { useEffect, useMemo, useState } from "react";
import { ApiError, Button, EmptyState, Icon, Router, Skeleton, useApi } from "@nextticket-frontend/commons";
import { toValidatorEvent, type ApiEvent, type Paginated } from "../api";
import { EventCard } from "../components/EventCard";
import { EventFilters } from "../components/EventFilters";
import { useSelectedEvent } from "../context/SelectedEventContext";
import { filterEventsByDate, type ValidatorEvent, type ValidatorEventFilter } from "../types/validatorEvents";

// El backend no filtra por validador asignado (no existe ese concepto en el
// modelo actual): se trae una sola página grande con todos los eventos no
// borrador y se filtra por fecha en el cliente, igual que events-front.
const FETCH_LIMIT = 100;

function EventCardSkeleton() {
    return (
        <div className="flex flex-col gap-3 rounded-[10px] bg-surface p-4">
            <Skeleton className="aspect-[16/10] w-full rounded-[10px]" />
            <Skeleton className="h-5 w-3/4 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-9 w-full rounded" />
        </div>
    );
}

export function EventsPage() {
    const api = useApi();
    const navigate = Router.useNavigate();
    const { selectEvent } = useSelectedEvent();

    const [filter, setFilter] = useState<ValidatorEventFilter>("today");
    const [events, setEvents] = useState<ValidatorEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setLoading(true);
        setError(null);

        api.get<Paginated<ApiEvent>>(`/events?limit=${FETCH_LIMIT}`)
            .then((res) => {
                const now = new Date();
                const visible = res.data.filter((event) => event.status !== "DRAFT");
                setEvents(visible.map((event) => toValidatorEvent(event, now)));
            })
            .catch((err) => {
                setError(err instanceof ApiError ? err.message : "No se pudieron cargar los eventos");
            })
            .finally(() => setLoading(false));
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, []);

    const filteredEvents = useMemo(() => filterEventsByDate(events, filter), [events, filter]);

    function handleSelect(event: ValidatorEvent) {
        selectEvent(event);
        navigate("/validator/validate");
    }

    return (
        <div className="flex flex-col gap-6 pb-4">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl md:text-3xl">Eventos para validar</h1>
                    <p className="text-muted">
                        Selecciona un evento para comenzar la validación de boletos.
                    </p>
                </div>
                <EventFilters events={events} value={filter} onChange={setFilter} />
            </header>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[0, 1, 2].map((key) => (
                        <EventCardSkeleton key={key} />
                    ))}
                </div>
            ) : error ? (
                <EmptyState className="py-16">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Icon.CircleAlert className="size-8! text-muted" />
                        <div className="flex flex-col gap-1">
                            <h3>No se pudieron cargar los eventos</h3>
                            <p className="text-muted">{error}</p>
                        </div>
                        <Button size="sm" onPress={load}>
                            <Icon.RotateCcw />
                            Reintentar
                        </Button>
                    </div>
                </EmptyState>
            ) : filteredEvents.length === 0 ? (
                <EmptyState className="py-16">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <Icon.CalendarOff className="size-8! text-muted" />
                        <div className="flex flex-col gap-1">
                            <h3>Sin eventos en este periodo</h3>
                            <p className="text-muted">
                                Cambia el filtro de fecha para ver otros eventos asignados.
                            </p>
                        </div>
                    </div>
                </EmptyState>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredEvents.map((event) => (
                        <EventCard key={event.id} event={event} onSelect={handleSelect} />
                    ))}
                </div>
            )}
        </div>
    );
}
