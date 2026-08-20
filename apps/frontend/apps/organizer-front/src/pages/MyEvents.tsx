import { useEffect, useMemo, useState } from "react";
import { ApiError, Button, Icon, ListBox, Pagination, Select, SearchField, ScrollShadow, Router, toast, useApi, useSession } from "@nextticket-frontend/commons";
import { ModalCancelEvent } from "../components/ModalCancelEvent";
import { OrganizerEventCard } from "../components/OrganizerEventCard";
import { toOrganizerEventRow, type ApiEvent, type ApiTicketsEventZoneStats, type OrganizerEventRow, type OrganizerEventStatus } from "../api";

const ALL_STATUSES: OrganizerEventStatus[] = ["Activo", "Inactivo"];

const PAGE_SIZE = 8;
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
  const navigate = Router.useNavigate();

  const [events, setEvents] = useState<OrganizerEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(ALL_STATUSES));
  const [venueFilter, setVenueFilter] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

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
  const start = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openCreate = () => navigate("/organizer/myEvents/new");
  const openEdit = (ev: OrganizerEventRow) => navigate(`/organizer/myEvents/${ev.id}/edit`);

  const openCancel = (ev: OrganizerEventRow) => {
    setEventToCancel(ev);
    setCancelOpen(true);
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
    <div className="flex flex-col gap-3 h-full animate-in fade-in duration-500">
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
          <ScrollShadow className="flex-1 overflow-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginated.map((ev) => (
                <OrganizerEventCard key={ev.id} event={ev} onEdit={openEdit} onCancel={openCancel} />
              ))}
            </div>
          </ScrollShadow>

          <div className="shrink-0 flex justify-center md:justify-between items-center flex-wrap gap-4">
            <Pagination size="sm">
              <Pagination.Summary>
                <div className="flex items-center gap-4">
                  <span className="text-muted">
                    <span className="text-foreground font-medium">{start}</span> al{" "}
                    <span className="text-foreground font-medium">{end}</span> de{" "}
                    <span className="text-foreground font-medium">{filtered.length}</span> resultados
                  </span>
                </div>
              </Pagination.Summary>
              <Pagination.Content>
                <Pagination.Item>
                  <Pagination.Previous isDisabled={currentPage <= 1} onPress={() => setPage((p) => p - 1)}>
                    <Pagination.PreviousIcon />
                    Anterior
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
                    Siguiente
                    <Pagination.NextIcon />
                  </Pagination.Next>
                </Pagination.Item>
              </Pagination.Content>
            </Pagination>
          </div>
        </>
      )}

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
