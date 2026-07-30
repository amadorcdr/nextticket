import { useState, useMemo } from "react";
import type { Key } from "@nextticket-frontend/commons";
import { Icon, Select, ListBox, ScrollShadow, Link, Button, SearchField, Chip } from "@nextticket-frontend/commons";
import { HoloCard, HoloCardDisplayData } from "./components/HoloCard/HoloCard";

const MOCK_TICKETS: HoloCardDisplayData[] = [
  {
    eventName: "Mitski - Nothing's About To Happen To Me Tour",
    eventDateTime: "17/07/2026 • 20:00 hrs",
    floorName: "Planta baja",
    sectionPrefix: "BAL-01",
    row: "A",
    seat: "1",
    seatType: "STANDARD",
    venueName: "Auditorio Nacional",
    venueAddress: "Calzada de Tlalpan 3465",
    venueCity: "Ciudad de México",
    venueState: "CDMX",
    venueCountry: "Mexico",
    folio: "TK-MRP9ARTDBAA4",
    status: "ISSUED",
    badge: "ISSUED",
    backgroundImage: "https://deadoceans.com/wp-content/uploads/2026/02/1-250514006092070023-Edit-1-1600x1061.jpg",
  },
  {
    eventName: "Mitski - Nothing's About To Happen To Me Tour",
    eventDateTime: "17/07/2026 • 20:00 hrs",
    floorName: "Planta baja",
    sectionPrefix: "BAL-01",
    row: "A",
    seat: "2",
    seatType: "STANDARD",
    venueName: "Auditorio Nacional",
    venueAddress: "Calzada de Tlalpan 3465",
    venueCity: "Ciudad de México",
    venueState: "CDMX",
    venueCountry: "Mexico",
    folio: "TK-MRP9ARTDBAA5",
    status: "ISSUED",
    badge: "ISSUED",
    backgroundImage: "https://deadoceans.com/wp-content/uploads/2026/01/2C8A7361-Enhanced-NR-Edit-1600x1067.jpg",
  },
  {
    eventName: "Mitski - Nothing's About To Happen To Me Tour",
    eventDateTime: "17/07/2026 • 20:00 hrs",
    floorName: "Planta baja",
    sectionPrefix: "BAL-01",
    row: "A",
    seat: "3",
    seatType: "STANDARD",
    venueName: "Auditorio Nacional",
    venueAddress: "Calzada de Tlalpan 3465",
    venueCity: "Ciudad de México",
    venueState: "CDMX",
    venueCountry: "Mexico",
    folio: "TK-MRP9ARTDBAA6",
    status: "ISSUED",
    badge: "ISSUED",
    backgroundImage: "https://grupoanimal.sfo3.cdn.digitaloceanspaces.com/uploads/2026/03/mitski-nuevo-album-nothings-about-to-happen-to-me-single-wheres-my-phone.jpg",
  },
  {
    eventName: "Mitski - Nothing's About To Happen To Me Tour",
    eventDateTime: "17/07/2026 | 20:00 hrs",
    floorName: "Planta baja",
    sectionPrefix: "BAL-01",
    row: "A",
    seat: "4",
    seatType: "STANDARD",
    venueName: "Auditorio Nacional",
    venueAddress: "Calzada de Tlalpan 3465",
    venueCity: "Ciudad de México",
    venueState: "CDMX",
    venueCountry: "Mexico",
    folio: "TK-MRP9ARTDBAA7",
    status: "ISSUED",
    badge: "ISSUED",
    backgroundImage: "https://d36dm5l5awwtco.cloudfront.net/api/file/YbPOEWLtT3m3N5QjkzC3/convert?w=2048&compress=true&fit=max",
  },
];

const statuses = [
  { id: "ISSUED", label: "Emitidos", className: "bg-success/10 text-success", icon: <Icon.Check /> },
  { id: "USED", label: "Usados", className: "bg-muted/10 text-muted", icon: <Icon.Ticket /> },
  { id: "CANCELED", label: "Cancelados", className: "bg-danger/10 text-danger", icon: <Icon.X /> },
  { id: "EXPIRED", label: "Expirados", className: "bg-warning/10 text-warning", icon: <Icon.Clock /> },
];

export function TicketsModule() {
  const [statusFilter, setStatusFilter] = useState<Key[]>(["ISSUED"]);

  const filteredTickets = useMemo(() => {
    if (statusFilter.length === 0) return MOCK_TICKETS;
    return MOCK_TICKETS.filter((t) => t.status && statusFilter.includes(t.status));
  }, [statusFilter]);

  // Count tickets by status
  const ticketCounts = useMemo(() => {
    const counts: Record<string, number> = { ISSUED: 0, USED: 0, CANCELED: 0, EXPIRED: 0 };
    MOCK_TICKETS.forEach((t) => {
      if (t.status) counts[t.status]++;
    });
    return counts;
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 md:gap-4 shrink-0">
        <div className="flex flex-col gap-2 md:gap-4">
          <div className="flex flex-row items-center justify-between md:gap-4 gap-2">
            <div>
              <h2>Tickets</h2>
              <p className="text-muted md:text-sm text-xs flex flex-wrap gap-x-2 gap-y-1">
                {["ISSUED", "USED", "CANCELED", "EXPIRED"].map((id) => {
                  const status = statuses.find((s) => s.id === id);
                  const count = ticketCounts[id];
                  return status ? (
                    <span key={id} className="flex items-center gap-1">
                      <span className="text-foreground font-medium">{count}</span> {status.label.toLowerCase()}
                    </span>
                  ) : null;
                })}
              </p>
            </div>

            <div className="flex-1 flex items-center justify-end gap-1 md:gap-2">
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
                      <>
                        <span>Todos los estatus</span>
                      </>
                    ) : (
                      <>
                        <Select.Value className="line-clamp-1" />
                      </>
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
              <Button>
                <Icon.ArrowRightLeft />
                Transferir
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ScrollShadow className="flex-1 overflow-auto  md:pt-4 pt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-6">
          {filteredTickets.map((ticket, index) => (
            <div key={index} className="w-full h-[550px]">
              <HoloCard data={ticket} />
            </div>
          ))}
        </div>
      </ScrollShadow>
    </div>
  );
}
