import { useMemo, useState } from "react";
import type { Key } from "@nextticket-frontend/commons";
import { Icon, ScrollShadow } from "@nextticket-frontend/commons";
import { EventCard } from "../components/EventCard";
import { EventFilters } from "../components/EventFilters";
import { CLIENT_EVENTS } from "../mocks/clientEvents";

/** Catálogo público de eventos: es la pantalla de entrada del cliente. */
export function EventsCatalog() {
    const [search, setSearch] = useState("");
    const [selectedCities, setSelectedCities] = useState<Key[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<Key[]>([]);

    const cities = useMemo(
        () => Array.from(new Set(CLIENT_EVENTS.map((event) => event.city))).sort(),
        [],
    );

    const categories = useMemo(
        () =>
            Array.from(new Set(CLIENT_EVENTS.map((event) => event.category))).sort(),
        [],
    );

    const filteredEvents = useMemo(() => {
        const term = search.trim().toLowerCase();

        return CLIENT_EVENTS.filter((event) => {
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
    }, [search, selectedCities, selectedCategories]);

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
                {filteredEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
                        <Icon.SearchX className="size-8 text-muted" />
                        <h4>Sin resultados</h4>
                        <p className="text-muted md:text-sm text-xs">
                            No encontramos eventos con esos filtros.
                        </p>
                    </div>
                ) : (
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
