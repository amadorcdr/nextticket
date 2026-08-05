import { useMemo, useState } from "react";
import { EmptyState, Icon, Router, Skeleton } from "@nextticket-frontend/commons";
import { EventCard } from "../components/EventCard";
import { EventFilters } from "../components/EventFilters";
import { useSelectedEvent } from "../context/SelectedEventContext";
import {
    filterEventsByDate,
    VALIDATOR_EVENTS,
    type ValidatorEvent,
    type ValidatorEventFilter,
} from "../mocks/validatorEvents";

function EventCardSkeleton() {
    return (
        <div className="flex flex-col gap-3 rounded-[10px] bg-surface p-4">
            <Skeleton className="h-32 w-full rounded-[10px]" />
            <Skeleton className="h-5 w-3/4 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-9 w-full rounded" />
        </div>
    );
}

export function EventsPage() {
    const [filter, setFilter] = useState<ValidatorEventFilter>("today");
    const [isLoading, setIsLoading] = useState(false);
    const navigate = Router.useNavigate();
    const { selectEvent } = useSelectedEvent();

    const events = useMemo(() => filterEventsByDate(VALIDATOR_EVENTS, filter), [filter]);

    /** Cambio de filtro con una breve transición simulada (sin peticiones). */
    function handleFilterChange(next: ValidatorEventFilter) {
        if (next === filter) return;
        setFilter(next);
        setIsLoading(true);
        window.setTimeout(() => setIsLoading(false), 250);
    }

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
                <EventFilters value={filter} onChange={handleFilterChange} />
            </header>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[0, 1, 2].map((key) => (
                        <EventCardSkeleton key={key} />
                    ))}
                </div>
            ) : events.length === 0 ? (
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
                    {events.map((event) => (
                        <EventCard key={event.id} event={event} onSelect={handleSelect} />
                    ))}
                </div>
            )}
        </div>
    );
}
