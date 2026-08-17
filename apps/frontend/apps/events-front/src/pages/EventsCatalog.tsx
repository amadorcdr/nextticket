import { useEffect, useMemo, useState } from "react";
import type { Key } from "@nextticket-frontend/commons";
import { ApiError, Button, Icon, ScrollShadow, useApi } from "@nextticket-frontend/commons";
import { EventCard } from "../components/EventCard";
import { EventFilters } from "../components/EventFilters";
import { toClientEvent, type ApiEvent, type Paginated } from "../api";
import type { ClientEvent } from "../types/client";

// El backend no soporta busqueda de texto en la query todavia (solo
// page/limit): se trae una sola pagina grande y se filtra en el cliente,
// mismo patron que AdminEventsView. Tampoco filtra por status en una sola
// llamada para varios valores, asi que se pide todo y se filtra aqui.
const FETCH_LIMIT = 100;

/** Catálogo público de eventos: es la pantalla de entrada del cliente. */
export function EventsCatalog() {
    const api = useApi();

    const [events, setEvents] = useState<ClientEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [selectedCities, setSelectedCities] = useState<Key[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<Key[]>([]);

    const load = () => {
        setLoading(true);
        setError(null);

        api.get<Paginated<ApiEvent>>(`/events?limit=${FETCH_LIMIT}`)
            .then((res) => {
                const visible = res.data.filter(
                    (event) => event.status === "PUBLISHED" || event.status === "SOLD_OUT",
                );
                setEvents(visible.map(toClientEvent));
            })
            .catch((err) => {
                setError(err instanceof ApiError ? err.message : "No se pudieron cargar los eventos");
            })
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const cities = useMemo(
        () => Array.from(new Set(events.map((event) => event.city).filter(Boolean))).sort(),
        [events],
    );

    const categories = useMemo(
        () => Array.from(new Set(events.map((event) => event.category))).sort(),
        [events],
    );

    const filteredEvents = useMemo(() => {
        const term = search.trim().toLowerCase();

        return events.filter((event) => {
            const matchesSearch =
                term.length === 0 ||
                event.title.toLowerCase().includes(term) ||
                event.venue.toLowerCase().includes(term);

            const matchesCity =
                selectedCities.length === 0 || selectedCities.includes(event.city);

            const matchesCategory =
                selectedCategories.length === 0 ||
                selectedCategories.includes(event.category);

            return matchesSearch && matchesCity && matchesCategory;
        });
    }, [events, search, selectedCities, selectedCategories]);

    const hasActiveFilters =
        search.length > 0 ||
        selectedCities.length > 0 ||
        selectedCategories.length > 0;

    const handleReset = () => {
        setSearch("");
        setSelectedCities([]);
        setSelectedCategories([]);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-col gap-2 md:gap-4 shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
                    <div>
                        <h2>Eventos</h2>
                        <p className="text-muted md:text-sm text-xs">
                            <span className="text-foreground font-medium">
                                {filteredEvents.length}
                            </span>{" "}
                            {filteredEvents.length === 1
                                ? "evento disponible"
                                : "eventos disponibles"}
                        </p>
                    </div>

                    <EventFilters
                        search={search}
                        cities={cities}
                        categories={categories}
                        selectedCities={selectedCities}
                        selectedCategories={selectedCategories}
                        hasActiveFilters={hasActiveFilters}
                        onSearchChange={setSearch}
                        onCitiesChange={setSelectedCities}
                        onCategoriesChange={setSelectedCategories}
                        onReset={handleReset}
                    />
                </div>
            </div>

            <ScrollShadow className="flex-1 overflow-auto md:pt-4 pt-2">
                {loading && (
                    <p className="text-muted text-xs py-16 text-center">Cargando eventos...</p>
                )}

                {!loading && error && (
                    <div className="flex flex-col items-center gap-3 py-16">
                        <Icon.CircleAlert className="size-8 text-muted" />
                        <p className="text-muted text-xs text-center">{error}</p>
                        <Button size="sm" onPress={load}>
                            Reintentar
                        </Button>
                    </div>
                )}

                {!loading && !error && filteredEvents.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                        <Icon.SearchX className="size-8 text-muted" />
                        <h4>Sin resultados</h4>
                        <p className="text-muted md:text-sm text-xs">
                            {events.length === 0
                                ? "Todavía no hay eventos publicados."
                                : "No encontramos eventos con esos filtros."}
                        </p>
                    </div>
                )}

                {!loading && !error && filteredEvents.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredEvents.map((event) => (
                            <EventCard key={event.id} event={event} />
                        ))}
                    </div>
                )}
            </ScrollShadow>
        </div>
    );
}
