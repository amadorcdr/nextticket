import { useMemo, useState } from "react";
import { AdminEventCard } from "../components/AdminEventCard";
import { AdminEventFilters } from "../components/AdminEventFilters";
import { ADMIN_EVENTS } from "../mocks/adminEvents";
import type { AdminEventStatus } from "../types/admin";

export function AdminEventsView() {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<AdminEventStatus | "all">("all");

    const filtered = useMemo(() => {
        const query = search.toLowerCase();
        return ADMIN_EVENTS.filter((ev) => {
            const matchesStatus = statusFilter === "all" || ev.status === statusFilter;
            const matchesSearch = !query || ev.title.toLowerCase().includes(query) || ev.venue.toLowerCase().includes(query);
            return matchesStatus && matchesSearch;
        });
    }, [search, statusFilter]);

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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((event) => (
                    <AdminEventCard key={event.id} event={event} />
                ))}
            </div>
        </div>
    );
}
