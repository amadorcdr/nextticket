import { useState } from "react";
import type { Key } from "@nextticket-frontend/commons";
import { Button, Icon, Select, ListBox, SearchField, Popover, ScrollShadow, Router } from "@nextticket-frontend/commons";
import { Label, Slider, Modal, Chip } from "@heroui/react";
import { VenuesTable } from "./VenuesTable";

export function VenuesModule() {
  const navigate = Router.useNavigate();
  const [statusFilter, setStatusFilter] = useState<Key[]>(["DRAFT", "ACTIVE", "INACTIVE", "UNDER_MAINTENANCE", "REMOVED"]);

  const MEXICAN_STATES = [
    "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
    "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato",
    "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
    "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco",
    "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"
  ];

  const [stateFilter, setStateFilter] = useState<Key[]>(MEXICAN_STATES);
  const [capacityFilter, setCapacityFilter] = useState<number[]>([0, 100000]);
  const [sorting, setSorting] = useState<{ id: string, desc: boolean }[]>([{ id: "name", desc: false }]);

  const columnOptions = [
    { id: "name", name: "Nombre" },
    { id: "address", name: "Dirección" },
    { id: "city", name: "Ciudad" },
    { id: "state", name: "Estado" },
    { id: "total_capacity", name: "Capacidad" },
    { id: "status", name: "Estatus" },
    { id: "createdAt", name: "Fecha de creación" },
  ];

  const statuses = [
    { id: "DRAFT", label: "Borradores", count: 3, className: "bg-accent/10 text-foreground", icon: <Icon.Pen /> },
    { id: "INACTIVE", label: "Inactivos", count: 1, className: "bg-muted/10 text-muted", icon: <Icon.Minus /> },
    { id: "ACTIVE", label: "Activos", count: 12, className: "bg-success/10 text-success", icon: <Icon.Check /> },
    { id: "UNDER_MAINTENANCE", label: "Mantenimiento", count: 2, className: "bg-warning/10 text-warning", icon: <Icon.Wrench /> },
    { id: "REMOVED", label: "Eliminados", count: 0, className: "bg-danger/10 text-danger", icon: <Icon.X /> },
  ];
  const totalVenues = statuses.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="flex flex-col md:gap-4 gap-2 h-full" >
      <div className="flex flex-col gap-2 md:gap-4 shrink-0">
        <div className="flex flex-col gap-2 md:gap-4">
          <div className="flex flex-row items-center justify-between md:gap-4 gap-2">
            <div>
              <h2>Recintos</h2>
              <p className="text-muted md:text-sm text-xs flex flex-wrap gap-x-2 gap-y-1">
                {["DRAFT", "ACTIVE", "INACTIVE", "UNDER_MAINTENANCE", "REMOVED"].map((id) => {
                  const status = statuses.find((s) => s.id === id);
                  return status ? (
                    <span key={id}>
                      <span className="text-foreground font-medium">{status.count}</span> {status.label.toLowerCase()}
                    </span>
                  ) : null;
                })}
              </p>
            </div>
            <Button className="shrink-0" onPress={() => navigate("canvas")}>
              <Icon.HousePlus />
              Crear recinto
            </Button>
          </div>
        </div>
        <div className="flex flex-col-reverse md:flex-row md:items-center items-end justify-between md:gap-4 gap-2">
          <div className="flex flex-wrap flex-1 items-center gap-1 md:gap-2 w-full">
            <SearchField name="search-custom" className="flex-1 min-w-[180px] md:max-w-[400px]">
              <SearchField.Group>
                <SearchField.SearchIcon>
                  <Icon.Search />
                </SearchField.SearchIcon>
                <SearchField.Input placeholder="Buscar..." />
                <SearchField.ClearButton>
                  <Icon.X />
                </SearchField.ClearButton>
              </SearchField.Group>
            </SearchField>



            <Popover>
              <Button isIconOnly variant="ghost" className="shrink-0">
                <Icon.Settings2 />
              </Button>
              <Popover.Content className="w-80 p-4" placement="bottom end">
                <Slider
                  className="w-full"
                  value={capacityFilter}
                  onChange={(val) => setCapacityFilter(val as number[])}
                  maxValue={100000}
                  minValue={0}
                  step={1000}
                >
                  <div className="flex items-center gap-2">
                    <Icon.Users />
                    <Label>Capacidad</Label>
                  </div>                        <Slider.Output />
                  <Slider.Track>
                    {({ state }) => (
                      <>
                        <Slider.Fill />
                        {state.values.map((_, i) => (
                          <Slider.Thumb key={i} index={i} />
                        ))}
                      </>
                    )}
                  </Slider.Track>
                </Slider>
              </Popover.Content>
            </Popover>
          </div>
          <ScrollShadow orientation="horizontal" className="flex items-center md:gap-2 gap-1">

            <Select
              className="w-fit"
              aria-label="Ordenar por"
              value={sorting.length > 0 ? sorting[0].id : null}
              onChange={(value) => {
                if (value) {
                  const key = value as string;
                  if (sorting[0]?.id !== key) {
                    setSorting([{ id: key, desc: false }]);
                  }
                }
              }}
            >
              <Select.Trigger>
                <div className="flex items-center gap-2">
                  <Icon.ArrowUpDown className="size-4 text-muted shrink-0" />
                  <Select.Value>
                    {({ state }) => {
                      const sel = state.selectedItems[0];
                      if (!sel) return <span className="max-[1400px]:hidden">Ordenar por...</span>;
                      return (
                        <>
                          <span className="truncate max-[1400px]:hidden">
                            Ordenar: {sel.textValue}
                          </span>
                          <span className="min-[1400px]:hidden">Ordenar</span>
                        </>
                      );
                    }}
                  </Select.Value>
                </div>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {columnOptions.map((col) => (
                    <ListBox.Item
                      key={col.id}
                      id={col.id}
                      textValue={col.name}
                      onPress={() => {
                        if (sorting[0]?.id === col.id) {
                          setSorting([{ id: col.id, desc: !sorting[0]?.desc }]);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{col.name}</span>
                        {sorting[0]?.id === col.id && (
                          <span className="text-xs text-muted">({sorting[0]?.desc ? "Desc" : "Asc"})</span>
                        )}
                      </div>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              className="w-fit min-[1400px]:w-44"
              aria-label="Estatus"
              selectionMode="multiple"
              value={statusFilter}
              onChange={(keys) => setStatusFilter(Array.from(keys) as Key[])}
            >
              <Select.Trigger>
                <div className="flex items-center gap-2">
                  <Icon.SquaresSubtract className="shrink-0" />
                  <Select.Value>
                    {({ state }) => {
                      const count = state.selectedItems.length;
                      if (count === statuses.length || count === 0) {
                        return (
                          <>
                            <span className="max-[1400px]:hidden">Todos los estatus</span>
                            <span className="min-[1400px]:hidden">Estatus</span>
                          </>
                        );
                      }
                      return (
                        <>
                          <span className="max-[1400px]:hidden line-clamp-1">
                            {state.selectedItems.map(i => i.textValue).join(", ")}
                          </span>
                          <span className="min-[1400px]:hidden">Estatus</span>
                        </>
                      );
                    }}
                  </Select.Value>
                </div>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {statuses.map((s) => (
                    <ListBox.Item key={s.id} id={s.id} textValue={s.label}>
                      {s.label.charAt(0).toUpperCase() + s.label.slice(1)}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              className="w-fit min-[1400px]:w-44"
              aria-label="Estados"
              selectionMode="multiple"
              value={stateFilter}
              onChange={(keys) => setStateFilter(Array.from(keys) as Key[])}
            >
              <Select.Trigger>
                <div className="flex items-center gap-2">
                  <Icon.MapPinned className="shrink-0" />
                  <Select.Value>
                    {({ state }) => {
                      const count = state.selectedItems.length;
                      if (count === MEXICAN_STATES.length || count === 0) {
                        return (
                          <>
                            <span className="max-[1400px]:hidden">Todos los estados</span>
                            <span className="min-[1400px]:hidden">Estados</span>
                          </>
                        );
                      }
                      return (
                        <>
                          <span className="max-[1400px]:hidden line-clamp-1">
                            {state.selectedItems.map(i => i.textValue).join(", ")}
                          </span>
                          <span className="min-[1400px]:hidden">Estados</span>
                        </>
                      );
                    }}
                  </Select.Value>
                </div>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {MEXICAN_STATES.map((state) => (
                    <ListBox.Item key={state} id={state} textValue={state}>
                      {state}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </ScrollShadow>
        </div>
      </div>

      <div className="flex-1 min-h-72">
        <VenuesTable
          statusFilter={statusFilter}
          stateFilter={stateFilter}
          capacityFilter={capacityFilter}
          sorting={sorting}
        />
      </div>
    </div>
  );
}
