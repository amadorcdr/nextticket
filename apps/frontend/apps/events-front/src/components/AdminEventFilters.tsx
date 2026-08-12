import { Icon, SearchField } from "@nextticket-frontend/commons";
import type { AdminEventStatus } from "../types/admin";

export const EVENT_FILTER_OPTIONS: { id: AdminEventStatus | "all"; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "proximo", label: "Próximos" },
    { id: "activo", label: "Activos" },
    { id: "finalizado", label: "Finalizados" },
];

interface AdminEventFiltersProps {
    search: string;
    onSearchChange: (value: string) => void;
    statusFilter: AdminEventStatus | "all";
    onStatusFilterChange: (value: AdminEventStatus | "all") => void;
}

export function AdminEventFilters({ search, onSearchChange, statusFilter, onStatusFilterChange }: AdminEventFiltersProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <SearchField name="search-admin-events" className="flex-1 min-w-45 max-w-100" value={search} onChange={onSearchChange}>
                <SearchField.Group>
                    <SearchField.SearchIcon>
                        <Icon.Search />
                    </SearchField.SearchIcon>
                    <SearchField.Input placeholder="Buscar eventos..." />
                    <SearchField.ClearButton>
                        <Icon.X />
                    </SearchField.ClearButton>
                </SearchField.Group>
            </SearchField>

            <div className="flex items-center gap-1.5 flex-wrap">
                {EVENT_FILTER_OPTIONS.map((opt) => {
                    const active = statusFilter === opt.id;
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => onStatusFilterChange(opt.id)}
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                                active
                                    ? "bg-accent text-accent-foreground border-transparent"
                                    : "bg-surface-secondary text-muted border-border hover:text-foreground"
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
