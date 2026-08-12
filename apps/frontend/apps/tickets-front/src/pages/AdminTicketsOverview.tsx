import { useMemo, useState } from "react";
import { Icon, SearchField } from "@nextticket-frontend/commons";
import { EventSalesCard } from "../components/EventSalesCard";
import { EVENT_SALES_SUMMARIES } from "../mocks/adminTicketsMocks";

export function AdminTicketsOverview() {
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        const query = search.toLowerCase();
        if (!query) return EVENT_SALES_SUMMARIES;
        return EVENT_SALES_SUMMARIES.filter(
            (s) => s.eventName.toLowerCase().includes(query) || s.venue.toLowerCase().includes(query)
        );
    }, [search]);

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500">
            <div className="flex flex-row items-center justify-between gap-4">
                <div>
                    <h3>Tickets</h3>
                    <p className="text-muted text-xs mt-0.5">Resumen administrativo de ventas y boletos por evento.</p>
                </div>
                <SearchField name="search-admin-tickets" className="flex-1 max-w-100" value={search} onChange={setSearch}>
                    <SearchField.Group>
                        <SearchField.SearchIcon>
                            <Icon.Search />
                        </SearchField.SearchIcon>
                        <SearchField.Input placeholder="Buscar por evento o recinto..." />
                        <SearchField.ClearButton>
                            <Icon.X />
                        </SearchField.ClearButton>
                    </SearchField.Group>
                </SearchField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((summary) => (
                    <EventSalesCard key={summary.eventId} summary={summary} />
                ))}
            </div>
        </div>
    );
}
