import { useEffect, useState } from "react";
import { Button, Icon, ListBox, Pagination, Select, SearchField, Table } from "@nextticket-frontend/commons";
import { ModalEvent } from "../components/ModalEvent";
import { ModalEditEvent, EventData } from "../components/EditModalEvent";
import { ModalDeleteEvent } from "../components/ModalDeleteEvent";

type EventStatus = "Activo" | "Agotado" | "Draft" | "Cancelado";

interface EventRow {
  id: string;
  name: string;
  venue: string;
  date: string;
  time: string;
  sold: number;
  total: number;
  status: EventStatus;
}

const STATUS_CLASSNAME: Record<EventStatus, string> = {
  Activo: "text-success bg-success/10",
  Agotado: "text-danger bg-danger/10",
  Draft: "text-muted bg-muted/10",
  Cancelado: "text-danger bg-danger/10",
};

const ALL_VENUES = ["Arena Movistar", "Teatro Nacional", "Estadio Olímpico", "Playa del Sol"];

const EVENTOS: EventRow[] = [
  { id: "EV-8829", name: "Neon Nights Festival 2024", venue: "Arena Movistar", date: "15 Oct, 2024", time: "21:00 hrs", sold: 850, total: 1200, status: "Activo" },
  { id: "EV-9012", name: "Clásicos de Otoño: Orquesta", venue: "Teatro Nacional", date: "22 Oct, 2024", time: "19:30 hrs", sold: 500, total: 500, status: "Agotado" },
  { id: "EV-9103", name: "Rock Revolution Tour", venue: "Estadio Olímpico", date: "05 Nov, 2024", time: "20:00 hrs", sold: 1200, total: 1500, status: "Activo" },
  { id: "EV-9247", name: "Electronic Beach Party", venue: "Playa del Sol", date: "15 Nov, 2024", time: "18:00 hrs", sold: 0, total: 2000, status: "Draft" },
  { id: "EV-9350", name: "Stand Up Comedy Night", venue: "Teatro Nacional", date: "20 Nov, 2024", time: "20:30 hrs", sold: 320, total: 450, status: "Activo" },
  { id: "EV-9412", name: "Jazz & Blues Sessions", venue: "Arena Movistar", date: "28 Nov, 2024", time: "19:00 hrs", sold: 150, total: 800, status: "Activo" },
  { id: "EV-9501", name: "Festival Urbano Latino", venue: "Estadio Olímpico", date: "03 Dic, 2024", time: "21:00 hrs", sold: 3200, total: 3200, status: "Agotado" },
  { id: "EV-9588", name: "Sinfónica de Año Nuevo", venue: "Teatro Nacional", date: "31 Dic, 2024", time: "22:00 hrs", sold: 0, total: 500, status: "Draft" },
  { id: "EV-9642", name: "Techno Sunset Sessions", venue: "Playa del Sol", date: "10 Ene, 2025", time: "17:00 hrs", sold: 480, total: 1500, status: "Activo" },
  { id: "EV-9710", name: "Gira Acústica Íntima", venue: "Arena Movistar", date: "18 Ene, 2025", time: "20:00 hrs", sold: 0, total: 600, status: "Cancelado" },
];

const PAGE_SIZE = 10;

export function MyEvents() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(["Activo", "Agotado", "Draft", "Cancelado"]));
  const [venueFilter, setVenueFilter] = useState<Set<string>>(new Set(ALL_VENUES));
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventData | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteName, setDeleteName] = useState("");

  const openEdit = (ev: EventRow) => {
    setEditEvent({ nombre: ev.name, fecha: ev.date, hora: ev.time, descripcion: "", recinto: ev.venue, zonas: [] });
    setEditOpen(true);
  };

  const filtered = EVENTOS.filter(
    (ev) => statusFilter.has(ev.status) && venueFilter.has(ev.venue) && ev.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => setPage(1), [search, statusFilter, venueFilter]);
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-500">
      {/* Título + botón */}
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h3>Mis Eventos</h3>
          <p className="text-muted text-xs mt-0.5">Gestiona y monitorea el rendimiento de tus producciones activas.</p>
        </div>
        <Button size="sm" onPress={() => setModalOpen(true)}>
          <Icon.Plus />
          Crear Evento
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchField name="search-events" className="flex-1 min-w-45 max-w-100" value={search} onChange={setSearch}>
          <SearchField.Group>
            <SearchField.SearchIcon>
              <Icon.Search />
            </SearchField.SearchIcon>
            <SearchField.Input placeholder="Buscar eventos por nombre..." />
            <SearchField.ClearButton>
              <Icon.X />
            </SearchField.ClearButton>
          </SearchField.Group>
        </SearchField>

        <Select
          className="w-fit"
          aria-label="Estatus"
          selectionMode="multiple"
          value={Array.from(statusFilter)}
          onChange={(keys) => setStatusFilter(new Set(Array.from(keys as Set<string>)))}
        >
          <Select.Trigger>
            <div className="flex items-center gap-2">
              <Icon.SlidersHorizontal className="shrink-0 size-3.5" />
              <span className="text-xs">Estatus</span>
            </div>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {(["Activo", "Agotado", "Draft", "Cancelado"] as EventStatus[]).map((s) => (
                <ListBox.Item key={s} id={s} textValue={s}>
                  {s}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          className="w-fit"
          aria-label="Recinto"
          selectionMode="multiple"
          value={Array.from(venueFilter)}
          onChange={(keys) => setVenueFilter(new Set(Array.from(keys as Set<string>)))}
        >
          <Select.Trigger>
            <div className="flex items-center gap-2">
              <Icon.MapPinned className="shrink-0 size-3.5" />
              <span className="text-xs">Recinto</span>
            </div>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {ALL_VENUES.map((v) => (
                <ListBox.Item key={v} id={v} textValue={v}>
                  {v}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {/* Tabla */}
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Mis eventos" className="min-w-160 max-h-100 overflow-y-auto text-xs">
            <Table.Header>
              <Table.Column isRowHeader id="name" minWidth={200} className="text-center">
                Evento
              </Table.Column>
              <Table.Column id="date" minWidth={110} className="text-center">
                Fecha y Hora
              </Table.Column>
              <Table.Column id="venue" minWidth={120} className="text-center">
                Recinto
              </Table.Column>
              <Table.Column id="status" minWidth={90} className="text-center">
                Estado
              </Table.Column>
              <Table.Column id="sold" minWidth={150} className="text-center">
                Boletos Vendidos
              </Table.Column>
              <Table.Column id="actions" minWidth={80} className="text-center">
                Acciones
              </Table.Column>
            </Table.Header>
            <Table.Body items={paginated}>
              {(ev) => {
                const pct = ev.total > 0 ? Math.round((ev.sold / ev.total) * 100) : 0;
                return (
                  <Table.Row>
                    <Table.Cell className="text-center">
                      <div>
                        <p className="text-foreground text-xs font-medium">{ev.name}</p>
                        <p className="text-muted text-[11px]">ID: {ev.id}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      <div>
                        <p className="text-foreground text-xs">{ev.date}</p>
                        <p className="text-muted text-[11px]">{ev.time}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      <span className="text-xs">{ev.venue}</span>
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_CLASSNAME[ev.status]}`}>
                        {ev.status}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      <div className="flex flex-col gap-1 w-32 mx-auto">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted font-mono">
                            {ev.sold.toLocaleString()} / {ev.total.toLocaleString()}
                          </span>
                          <span className="text-foreground font-medium">{pct}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-default overflow-hidden">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button size="sm" variant="ghost" isIconOnly onPress={() => openEdit(ev)}>
                          <Icon.Pencil />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          color="danger"
                          isIconOnly
                          onPress={() => {
                            setDeleteName(ev.name);
                            setDeleteOpen(true);
                          }}
                        >
                          <Icon.Trash2 />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              }}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <div className="flex justify-end">
        <Pagination size="sm" style={{ justifyContent: "flex-end" }}>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous isDisabled={currentPage <= 1} onPress={() => setPage((p) => p - 1)}>
                <Pagination.PreviousIcon />
              </Pagination.Previous>
            </Pagination.Item>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Pagination.Item key={p}>
                <Pagination.Link isActive={p === currentPage} onPress={() => setPage(p)}>
                  {p}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next isDisabled={currentPage >= totalPages} onPress={() => setPage((p) => p + 1)}>
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </div>

      <ModalEvent open={modalOpen} onClose={() => setModalOpen(false)} />
      <ModalEditEvent open={editOpen} onClose={() => setEditOpen(false)} event={editEvent} onSave={(data) => console.log("Guardado:", data)} />
      <ModalDeleteEvent open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={() => console.log("Eliminado:", deleteName)} eventName={deleteName} />
    </div>
  );
}
