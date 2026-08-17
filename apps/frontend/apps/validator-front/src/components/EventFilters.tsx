import { Chip, Tabs } from "@nextticket-frontend/commons";
import {
    EVENT_FILTERS,
    filterEventsByDate,
    type ValidatorEvent,
    type ValidatorEventFilter,
} from "../types/validatorEvents";

interface EventFiltersProps {
    events: ValidatorEvent[];
    value: ValidatorEventFilter;
    onChange: (filter: ValidatorEventFilter) => void;
}

/** Filtros por fecha: Hoy, Mañana y Próximos. El filtrado ocurre en memoria. */
export function EventFilters({ events, value, onChange }: EventFiltersProps) {
    return (
        <Tabs
            aria-label="Filtrar eventos por fecha"
            variant="secondary"
            orientation="horizontal"
            selectedKey={value}
            onSelectionChange={(key) => onChange(key as ValidatorEventFilter)}
        >
            <Tabs.ListContainer className="w-fit">
                <Tabs.List>
                    {EVENT_FILTERS.map(({ id, label }) => (
                        <Tabs.Tab key={id} id={id} className="flex items-center gap-2">
                            <span>{label}</span>
                            <Chip variant="soft" color="default" size="sm">
                                {filterEventsByDate(events, id).length}
                            </Chip>
                            <Tabs.Indicator className="rounded-full" />
                        </Tabs.Tab>
                    ))}
                </Tabs.List>
            </Tabs.ListContainer>
        </Tabs>
    );
}
