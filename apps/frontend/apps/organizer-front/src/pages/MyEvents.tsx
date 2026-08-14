import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL, ApiError, Button, Icon, ListBox, Pagination, Select, SearchField, Table, toast, useApi, useSession } from "@nextticket-frontend/commons";
import { EventFormModal, type EventFormMode, type EventFormValues } from "../components/EventFormModal";
import { ModalCancelEvent } from "../components/ModalCancelEvent";
import {
  toIsoDateTime,
  toOrganizerEventRow,
  uploadEventImage,
  type ApiEvent,
  type ApiEventCategory,
  type ApiTicketsEventZoneStats,
  type ApiVenue,
  type OrganizerEventRow,
  type OrganizerEventStatus,
} from "../api";

const STATUS_CLASSNAME: Record<OrganizerEventStatus, string> = {
  Activo: "text-success bg-success/10",
  Inactivo: "text-danger bg-danger/10",
};

const ALL_STATUSES: OrganizerEventStatus[] = ["Activo", "Inactivo"];

const PAGE_SIZE = 10;
// El backend no soporta busqueda por texto en la query todavia (solo
// page/limit): se trae una sola pagina grande y se filtra en el cliente,
// mismo patron que UsersView/AdminEventsView.
const FETCH_LIMIT = 100;

interface Paginated<T> {
  data: T[];
}

const EMPTY_TICKET_STATS: ApiTicketsEventZoneStats = { total: 0, sold: 0, validated: 0, unvalidated: 0, canceled: 0, byEventZone: [] };

export function MyEvents() {
  const api = useApi();
  const { user } = useSession();

  const [events, setEvents] = useState<OrganizerEventRow[]>([]);
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [categories, setCategories] = useState<ApiEventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(ALL_STATUSES));
  const [venueFilter, setVenueFilter] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<EventFormMode>("create");
  const [selectedEvent, setSelectedEvent] = useState<OrganizerEventRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [eventToCancel, setEventToCancel] = useState<OrganizerEventRow | null>(null);
  const [canceling, setCanceling] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);

    if (!user?.id) {
      setLoading(false);
      setError("Tu sesión no tiene un id de usuario válido. Cierra sesión y vuelve a iniciarla.");
      return;
    }

    api
      .get<Paginated<ApiEvent>>(`/events?organizerId=${user.id}&limit=${FETCH_LIMIT}`)
      .then(async (eventsRes) => {
        const zoneIds = eventsRes.data.flatMap((ev) => ev.zones.map((z) => z.id));
        const ticketStats =
          zoneIds.length > 0
            ? await api.get<ApiTicketsEventZoneStats>(`/tickets/stats/by-event-zones?eventZoneIds=${encodeURIComponent(zoneIds.join(","))}`)
            : EMPTY_TICKET_STATS;

        const soldByZone = new Map(ticketStats.byEventZone.map((z) => [z.eventZoneId, z.sold]));
        setEvents(eventsRes.data.map((ev) => toOrganizerEventRow(ev, soldByZone)));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudieron cargar los eventos"))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [user?.id]);

  useEffect(() => {
    api
      .get<Paginated<ApiVenue>>(`/venues?limit=${FETCH_LIMIT}`)
      .then((res) => setVenues(res.data.filter((v) => v.status !== "REMOVED" && v.status !== "INACTIVE" && v.status !== "UNDER_MAINTENANCE")))
      .catch(() => {
        // Si falla, el selector de recinto simplemente queda vacío.
      });
    api
      .get<Paginated<ApiEventCategory>>(`/event-categories?limit=${FETCH_LIMIT}`)
      .then((res) => setCategories(res.data.filter((c) => c.status === "ACTIVE")))
      .catch(() => {
        // Si falla, el selector de categoría simplemente queda vacío.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const venueOptions = useMemo(() => {
    const names = new Set(events.map((ev) => ev.venue));
    return Array.from(names);
  }, [events]);
  const venueOptionsKey = venueOptions.join("|");

  // Selecciona todos los recintos la primera vez que hay datos; si el usuario
  // ya filtró manualmente, un reload (tras crear/editar/borrar) no lo pisa.
  useEffect(() => {
    setVenueFilter((prev) => (prev.size === 0 && venueOptions.length > 0 ? new Set(venueOptions) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueOptionsKey]);

  const filtered = events.filter(
    (ev) => statusFilter.has(ev.status) && venueFilter.has(ev.venue) && ev.name.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => setPage(1), [search, statusFilter, venueFilter]);
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openCreate = () => {
    setSelectedEvent(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openEdit = (ev: OrganizerEventRow) => {
    setSelectedEvent(ev);
    setModalMode("edit");
    setModalOpen(true);
  };

  const openCancel = (ev: OrganizerEventRow) => {
    setEventToCancel(ev);
    setCancelOpen(true);
  };

  const handleSave = async (data: EventFormValues) => {
    setSaving(true);
    try {
      const payload = {
        venueId: data.venueId,
        name: data.nombre,
        startsAt: toIsoDateTime(data.fecha, data.horaInicio),
        endsAt: toIsoDateTime(data.fecha, data.horaFin),
        description: data.descripcion.trim() || undefined,
      };

      let eventId: string;

      if (modalMode === "create") {
        const created = await api.post<ApiEvent>("/events", {
          ...payload,
          categoryIds: data.categoryId ? [data.categoryId] : undefined,
        });
        eventId = created.id;
      } else {
        if (!selectedEvent) return;
        eventId = selectedEvent.id;
        await api.patch<ApiEvent>(`/events/${eventId}`, payload);

        if (data.categoryId !== selectedEvent.categoryId) {
          if (selectedEvent.categoryId) {
            await api.del(`/events/${eventId}/categories/${selectedEvent.categoryId}`).catch(() => {
              // Si ya no existía la asignación, no hay nada que limpiar.
            });
          }
          if (data.categoryId) {
            await api.post(`/events/${eventId}/categories`, { categoryIds: [data.categoryId] });
          }
        }
      }

      if (data.imageFile) {
        await uploadEventImage(API_BASE_URL, eventId, data.imageFile, user?.token);
      }

      toast.success(modalMode === "create" ? "Evento creado" : "Evento actualizado");
      setModalOpen(false);
      load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "No se pudo guardar el evento";
      toast.danger(message);
    } finally {
      setSaving(false);
    }
  };

  const confirmCancel = async () => {
    if (!eventToCancel) return;
    setCanceling(true);
    try {
      await api.patch<ApiEvent>(`/events/${eventToCancel.id}/status`, { status: "CANCELED" });
      setEvents((prev) => prev.map((ev) => (ev.id === eventToCancel.id ? { ...ev, status: "Inactivo" } : ev)));
      toast.success("Evento cancelado");
      setCancelOpen(false);
    } catch (err) {
      toast.danger(err instanceof ApiError ? err.message : "No se pudo cancelar el evento");
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-500">
      {/* Título + botón */}
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h3>Mis Eventos</h3>
          <p className="text-muted text-xs mt-0.5">Gestiona y monitorea el rendimiento de tus producciones activas.</p>
        </div>
        <Button size="sm" onPress={openCreate}>
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
              {ALL_STATUSES.map((s) => (
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
              {venueOptions.map((v) => (
                <ListBox.Item key={v} id={v} textValue={v}>
                  {v}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {loading && <p className="text-muted text-xs py-8 text-center">Cargando eventos...</p>}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-muted text-xs text-center">{error}</p>
          <Button size="sm" onPress={load}>
            Reintentar
          </Button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-muted text-xs py-8 text-center">
          {events.length === 0 ? "Todavía no tienes eventos. Crea el primero." : "No hay eventos que coincidan con la búsqueda."}
        </p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
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
                  <Table.Column id="category" minWidth={110} className="text-center">
                    Categoría
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
                          <p className="text-foreground text-xs font-medium">{ev.name}</p>
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
                          {ev.categoryName ? (
                            <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-default text-foreground">
                              {ev.categoryName}
                            </span>
                          ) : (
                            <span className="text-muted text-[11px]">Sin categoría</span>
                          )}
                        </Table.Cell>
                        <Table.Cell className="text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${STATUS_CLASSNAME[ev.status]}`}
                          >
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
                            {ev.status === "Activo" && (
                              <Button size="sm" variant="ghost" color="danger" isIconOnly onPress={() => openCancel(ev)}>
                                <Icon.CalendarX2 />
                              </Button>
                            )}
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
        </>
      )}

      <EventFormModal
        open={modalOpen}
        mode={modalMode}
        event={selectedEvent}
        venues={venues}
        categories={categories}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <ModalCancelEvent
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={confirmCancel}
        eventName={eventToCancel?.name}
        canceling={canceling}
      />
    </div>
  );
}
