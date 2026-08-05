import type { Key } from "@nextticket-frontend/commons";
import {
    Button,
    Icon,
    ListBox,
    SearchField,
    Select,
} from "@nextticket-frontend/commons";

type EventFiltersProps = Readonly<{
    search: string;
    cities: string[];
    categories: string[];
    selectedCities: Key[];
    selectedCategories: Key[];
    hasActiveFilters: boolean;
    onSearchChange: (value: string) => void;
    onCitiesChange: (value: Key[]) => void;
    onCategoriesChange: (value: Key[]) => void;
    onReset: () => void;
}>;

/**
 * En el diseño anterior los filtros vivían en una barra lateral propia.
 * Aquí van en la cabecera, como en el resto de los listados del sistema
 * (ver TicketsModule), para que el catálogo se sienta parte de la misma app.
 */
export function EventFilters({
    search,
    cities,
    categories,
    selectedCities,
    selectedCategories,
    hasActiveFilters,
    onSearchChange,
    onCitiesChange,
    onCategoriesChange,
    onReset,
}: EventFiltersProps) {
    return (
        <div className="flex w-full md:flex-1 min-w-0 flex-wrap items-center justify-start md:justify-end gap-1 md:gap-2">
            <SearchField
                name="search-events"
                className="flex-1 basis-full md:basis-auto min-w-[160px] md:max-w-[320px]"
                value={search}
                onChange={onSearchChange}
            >
                <SearchField.Group>
                    <SearchField.SearchIcon>
                        <Icon.Search />
                    </SearchField.SearchIcon>
                    <SearchField.Input placeholder="Buscar evento..." />
                    <SearchField.ClearButton>
                        <Icon.X />
                    </SearchField.ClearButton>
                </SearchField.Group>
            </SearchField>

            <Select
                className="w-fit min-w-0 shrink-0"
                aria-label="Categoría"
                selectionMode="multiple"
                value={selectedCategories}
                onChange={(keys) => onCategoriesChange(keys as Key[])}
            >
                <Select.Trigger>
                    <div className="flex items-center gap-2">
                        <Icon.Tag />
                        {selectedCategories.length === 0 ? (
                            <span>Categoría</span>
                        ) : (
                            <Select.Value className="line-clamp-1" />
                        )}
                    </div>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox selectionMode="multiple">
                        {categories.map((category) => (
                            <ListBox.Item key={category} id={category} textValue={category}>
                                {category}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>

            <Select
                className="w-fit min-w-0 shrink-0"
                aria-label="Ciudad"
                selectionMode="multiple"
                value={selectedCities}
                onChange={(keys) => onCitiesChange(keys as Key[])}
            >
                <Select.Trigger>
                    <div className="flex items-center gap-2">
                        <Icon.MapPin />
                        {selectedCities.length === 0 ? (
                            <span>Ciudad</span>
                        ) : (
                            <Select.Value className="line-clamp-1" />
                        )}
                    </div>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox selectionMode="multiple">
                        {cities.map((city) => (
                            <ListBox.Item key={city} id={city} textValue={city}>
                                {city}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>

            {hasActiveFilters && (
                <Button variant="ghost" size="sm" onPress={onReset}>
                    <Icon.FilterX />
                    Limpiar
                </Button>
            )}
        </div>
    );
}
