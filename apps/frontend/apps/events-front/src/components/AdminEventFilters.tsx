import { Icon, ListBox, SearchField, Select } from "@nextticket-frontend/commons";
import type { AdminEventStatus } from "../types/admin";

export const EVENT_FILTER_OPTIONS: { id: AdminEventStatus | "all"; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "borrador", label: "Borradores" },
    { id: "proximo", label: "Próximos" },
    { id: "activo", label: "Activos" },
    { id: "finalizado", label: "Finalizados" },
    { id: "cancelado", label: "Cancelados" },
];

const EVENT_FILTER_LABELS: Record<AdminEventStatus | "all", string> = {
    all: "Todos",
    borrador: "Borradores",
    proximo: "Próximos",
    activo: "Activos",
    finalizado: "Finalizados",
    cancelado: "Cancelados",
};

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
                    <SearchField.Input placeholder="Buscar eventos..." autoComplete="off" />
                    <SearchField.ClearButton>
                        <Icon.X />
                    </SearchField.ClearButton>
                </SearchField.Group>
            </SearchField>

            <Select
                className="w-fit"
                aria-label="Estado"
                value={statusFilter}
                onChange={(value) => onStatusFilterChange(value as AdminEventStatus | "all")}
            >
                <Select.Trigger className="min-h-0! h-7! px-2.5! py-1! text-xs!">
                    <div className="flex items-center gap-2">
                        <Icon.Activity className="shrink-0 size-3.5" />
                        <span className="text-xs">{EVENT_FILTER_LABELS[statusFilter]}</span>
                    </div>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        {EVENT_FILTER_OPTIONS.map((opt) => (
                            <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                                {opt.label}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
        </div>
    );
}
