import { useMemo, useState } from "react";
import type { Key } from "@nextticket-frontend/commons";
import { Button, Icon, ListBox, ScrollShadow, Select, SearchField } from "@nextticket-frontend/commons";
import { HoloCard } from "./components/HoloCard/HoloCard";
import { useMyTickets } from "./hooks/useMyTickets";
import { toHoloCardData, type ApiTicketStatus } from "./types/myTickets";

const statuses: Array<{ id: ApiTicketStatus; label: string }> = [
  { id: "ISSUED", label: "Emitidos" },
  { id: "USED", label: "Usados" },
  { id: "CANCELED", label: "Cancelados" },
  { id: "EXPIRED", label: "Expirados" },
];

export function TicketsModule() {
  const { tickets, qrUrls, loading, error, retry } = useMyTickets();
  const [statusFilter, setStatusFilter] = useState<Key[]>(statuses.map((s) => s.id));
  const [search, setSearch] = useState("");

  const ticketCounts = useMemo(() => {
    const counts: Record<string, number> = { ISSUED: 0, USED: 0, CANCELED: 0, EXPIRED: 0 };
    tickets.forEach(({ ticket }) => {
      counts[ticket.status] = (counts[ticket.status] ?? 0) + 1;
    });
    return counts;
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter(({ ticket, eventName }) => {
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(ticket.status);
      const matchesSearch =
        term.length === 0 ||
        eventName.toLowerCase().includes(term) ||
        ticket.folio.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [tickets, statusFilter, search]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 md:gap-4 shrink-0">
        <div className="flex flex-col gap-2 md:gap-4">
          <div className="flex flex-row items-center justify-between md:gap-4 gap-2">
            <div>
              <h2>Boletos</h2>
              <p className="text-muted md:text-sm text-xs flex flex-wrap gap-x-2 gap-y-1">
                {statuses.map(({ id, label }) => (
                  <span key={id} className="flex items-center gap-1">
                    <span className="text-foreground font-medium">{ticketCounts[id]}</span> {label.toLowerCase()}
                  </span>
                ))}
              </p>
            </div>

            <div className="flex-1 flex items-center justify-end gap-1 md:gap-2">
              <SearchField
                name="search-tickets"
                className="flex-1 min-w-[180px] md:max-w-[400px]"
                value={search}
                onChange={setSearch}
              >
                <SearchField.Group>
                  <SearchField.SearchIcon>
                    <Icon.Search />
                  </SearchField.SearchIcon>
                  <SearchField.Input placeholder="Buscar por evento o folio..." />
                  <SearchField.ClearButton>
                    <Icon.X />
                  </SearchField.ClearButton>
                </SearchField.Group>
              </SearchField>
              <Select
                className="w-fit min-w-0 shrink-0"
                aria-label="Estatus"
                selectionMode="multiple"
                value={statusFilter}
                onChange={(keys) => setStatusFilter(keys as Key[])}
              >
                <Select.Trigger>
                  <div className="flex items-center gap-2">
                    <Icon.SquaresSubtract />
                    {statusFilter.length === statuses.length ? (
                      <span>Todos los estatus</span>
                    ) : (
                      <Select.Value className="line-clamp-1" />
                    )}
                  </div>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox selectionMode="multiple">
                    {statuses.map((s) => (
                      <ListBox.Item key={s.id} id={s.id} textValue={s.label}>
                        {s.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <ScrollShadow className="flex-1 overflow-auto md:pt-4 pt-2">
        {loading && <p className="text-muted text-xs py-16 text-center">Cargando boletos...</p>}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Icon.CircleAlert className="size-8 text-muted" />
            <p className="text-muted text-xs text-center">{error}</p>
            <Button size="sm" onPress={retry}>
              Reintentar
            </Button>
          </div>
        )}

        {!loading && !error && tickets.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <Icon.Ticket className="size-8 text-muted" />
            <h4>Todavía no tienes boletos</h4>
            <p className="text-muted md:text-sm text-xs">
              Cuando completes una compra, tus boletos aparecen aquí.
            </p>
          </div>
        )}

        {!loading && !error && tickets.length > 0 && filteredTickets.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <Icon.SearchX className="size-8 text-muted" />
            <h4>Sin resultados</h4>
            <p className="text-muted md:text-sm text-xs">No encontramos boletos con esos filtros.</p>
          </div>
        )}

        {!loading && !error && filteredTickets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6">
            {filteredTickets.map((enriched) => (
              <div key={enriched.ticket.id} className="w-full h-[550px]">
                <HoloCard data={toHoloCardData(enriched, qrUrls[enriched.ticket.id])} />
              </div>
            ))}
          </div>
        )}
      </ScrollShadow>
    </div>
  );
}
