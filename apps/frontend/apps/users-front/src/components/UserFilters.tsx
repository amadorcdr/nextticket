import { Icon, ListBox, SearchField, Select } from "@nextticket-frontend/commons";
import { ROLE_LABELS, type AdminUserRole } from "../types/user";

export const ROLE_FILTER_OPTIONS: { id: AdminUserRole | "all"; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "admin", label: "Administradores" },
    { id: "organizador", label: "Organizadores" },
    { id: "usuario", label: "Clientes" },
    { id: "validador", label: "Validadores" },
];

export type StatusFilter = "all" | "active" | "inactive";

const STATUS_FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "active", label: "Activos" },
    { id: "inactive", label: "Inactivos" },
];

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
    all: "Todos",
    active: "Activos",
    inactive: "Inactivos",
};

interface UserFiltersProps {
    search: string;
    onSearchChange: (value: string) => void;
    roleFilter: AdminUserRole | "all";
    onRoleFilterChange: (value: AdminUserRole | "all") => void;
    statusFilter: StatusFilter;
    onStatusFilterChange: (value: StatusFilter) => void;
}

export function UserFilters({
    search,
    onSearchChange,
    roleFilter,
    onRoleFilterChange,
    statusFilter,
    onStatusFilterChange,
}: UserFiltersProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <SearchField name="search-users" className="flex-1 min-w-45 max-w-100" value={search} onChange={onSearchChange}>
                <SearchField.Group>
                    <SearchField.SearchIcon>
                        <Icon.Search />
                    </SearchField.SearchIcon>
                    <SearchField.Input placeholder="Buscar por nombre o correo..." autoComplete="off" />
                    <SearchField.ClearButton>
                        <Icon.X />
                    </SearchField.ClearButton>
                </SearchField.Group>
            </SearchField>

            <Select
                className="w-fit"
                aria-label="Rol"
                value={roleFilter}
                onChange={(value) => onRoleFilterChange(value as AdminUserRole | "all")}
            >
                <Select.Trigger>
                    <div className="flex items-center gap-2">
                        <Icon.SlidersHorizontal className="shrink-0 size-3.5" />
                        <span className="text-xs">{ROLE_LABELS[roleFilter as AdminUserRole] ?? "Todos"}</span>
                    </div>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        {ROLE_FILTER_OPTIONS.map((opt) => (
                            <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                                {opt.label}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>

            <Select
                className="w-fit"
                aria-label="Estado"
                value={statusFilter}
                onChange={(value) => onStatusFilterChange(value as StatusFilter)}
            >
                <Select.Trigger>
                    <div className="flex items-center gap-2">
                        <Icon.Activity className="shrink-0 size-3.5" />
                        <span className="text-xs">{STATUS_FILTER_LABELS[statusFilter]}</span>
                    </div>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        {STATUS_FILTER_OPTIONS.map((opt) => (
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
