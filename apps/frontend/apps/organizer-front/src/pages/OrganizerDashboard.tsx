import { useEffect, useMemo, useState, type ComponentType } from "react";
import { ApiError, Button, Icon, useApi, useSession } from "@nextticket-frontend/commons";
import { toOrganizerEventRow, type ApiEvent, type ApiTicketsEventZoneStats, type OrganizerEventRow } from "../api";

// El backend no soporta busqueda por texto en la query todavia (solo
// page/limit): se trae una sola pagina grande, mismo patron que MyEvents.
const FETCH_LIMIT = 100;
// Mismos topes que el Dashboard de Admin: listas cortas y legibles en vez de
// volcar todo lo que exista.
const OCCUPANCY_LIMIT = 4;
const UPCOMING_LIMIT = 4;

interface Paginated<T> {
  data: T[];
}

const EMPTY_TICKET_STATS: ApiTicketsEventZoneStats = { total: 0, sold: 0, validated: 0, unvalidated: 0, canceled: 0, byEventZone: [] };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

function StatCard({ label, value, icon: StatIcon }: { label: string; value: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-surface border border-border rounded-[10px] p-3 flex items-center gap-3">
      <div className="shrink-0 size-9 rounded-[10px] bg-accent/10 text-accent flex items-center justify-center">
        <StatIcon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-muted text-[11px] font-semibold uppercase tracking-wide mb-1 truncate">{label}</p>
        <p className="text-foreground text-lg font-bold truncate">{value}</p>
      </div>
    </div>
  );
}

interface ApiPurchasesStats {
  totalRevenue: number;
}

/*
 * purchases-service ya deja a un ORGANIZER pedir /purchases/stats?eventId=
 * de un evento propio (verifica dueño contra venues-events-service), así
 * que "Ventas Totales" y el "Top Evento" ya son ingreso real, no estimado.
 * Como ese endpoint solo acepta UN eventId a la vez (no hay variante en
 * lote), se pide uno por evento en paralelo — están linear pero razonable
 * para la cantidad de eventos que maneja un organizador.
 */
export function OrganizerDashboard() {
  const api = useApi();
  const { user } = useSession();

  const [rows, setRows] = useState<OrganizerEventRow[]>([]);
  const [revenueByEventId, setRevenueByEventId] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const [ticketStats, revenueEntries] = await Promise.all([
          zoneIds.length > 0
            ? api.get<ApiTicketsEventZoneStats>(`/tickets/stats/by-event-zones?eventZoneIds=${encodeURIComponent(zoneIds.join(","))}`)
            : Promise.resolve(EMPTY_TICKET_STATS),
          Promise.all(
            eventsRes.data.map((ev) =>
              api
                .get<ApiPurchasesStats>(`/purchases/stats?eventId=${ev.id}`)
                .then((stats): [string, number] => [ev.id, stats.totalRevenue])
                .catch((): [string, number] => [ev.id, 0]),
            ),
          ),
        ]);

        const zoneMap = new Map(ticketStats.byEventZone.map((z) => [z.eventZoneId, z.sold]));
        setRevenueByEventId(new Map(revenueEntries));
        setRows(eventsRes.data.map((ev) => toOrganizerEventRow(ev, zoneMap)));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudieron cargar tus eventos"))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [user?.id]);

  const totalEvents = rows.length;
  const activeEvents = rows.filter((r) => r.status === "Activo").length;
  const ticketsSold = rows.reduce((sum, r) => sum + r.sold, 0);
  const totalRevenue = [...revenueByEventId.values()].reduce((sum, v) => sum + v, 0);

  // Cancelado o finalizado ya no genera ventas nuevas ni tiene caso destacarlo
  // en estas listas: mismo criterio que ya se usa en Zonas de Venta y Ventas.
  const activeRows = useMemo(
    () => rows.filter((r) => r.rawStatus !== "CANCELED" && r.rawStatus !== "COMPLETED"),
    [rows],
  );

  const occupancyByEvent = useMemo(
    () =>
      activeRows
        .filter((r) => r.total > 0)
        .map((r) => ({ id: r.id, name: r.name, pct: Math.round((r.sold / r.total) * 100) }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, OCCUPANCY_LIMIT),
    [activeRows],
  );

  const topEvent = useMemo(() => {
    let best: { row: OrganizerEventRow; revenue: number } | null = null;
    for (const row of activeRows) {
      const revenue = revenueByEventId.get(row.id) ?? 0;
      if (!best || revenue > best.revenue) best = { row, revenue };
    }
    return best;
  }, [activeRows, revenueByEventId]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return activeRows
      .filter((r) => new Date(r.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, UPCOMING_LIMIT);
  }, [activeRows]);

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-500">
      {/* Título */}
      <div>
        <h3>Resumen de Gestión</h3>
        <p className="text-muted text-xs mt-0.5">Monitorea el rendimiento de tus producciones en tiempo real.</p>
      </div>

      {loading && <p className="text-muted text-xs py-8 text-center">Cargando resumen...</p>}

      {!loading && error && (
        <div className="bg-surface border border-border rounded-[10px] p-6 flex flex-col items-center gap-3">
          <p className="text-muted text-xs text-center">{error}</p>
          <Button size="sm" onPress={load}>
            Reintentar
          </Button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-muted text-xs py-8 text-center bg-surface border border-border rounded-[10px]">
          Todavía no tienes eventos. Crea el primero en "Mis Eventos".
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="flex flex-col gap-2">
            <p className="text-muted text-[11px] font-semibold uppercase tracking-wide">Resumen general</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatCard label="Total Eventos" value={totalEvents.toLocaleString()} icon={Icon.Calendar} />
              <StatCard label="Eventos Activos" value={activeEvents.toLocaleString()} icon={Icon.CalendarCheck} />
              <StatCard label="Boletos Vendidos" value={ticketsSold.toLocaleString()} icon={Icon.Ticket} />
              <StatCard label="Ventas Totales" value={formatCurrency(totalRevenue)} icon={Icon.Wallet} />
            </div>
          </div>

          {/* Próximos eventos + Top evento */}
          <div className="grid lg:grid-cols-2 gap-2">
            <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col gap-2">
              <p className="text-foreground font-semibold text-xs">Próximos Eventos</p>
              {upcomingEvents.length === 0 ? (
                <p className="text-muted text-xs py-4 text-center">No tienes eventos activos próximos.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcomingEvents.map((ev) => {
                    const pct = ev.total > 0 ? Math.round((ev.sold / ev.total) * 100) : 0;
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-surface p-3 hover:bg-surface-secondary transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground text-xs font-medium truncate">{ev.name}</p>
                          <p className="text-muted text-[11px] flex items-center gap-1.5 mt-0.5">
                            <Icon.Calendar className="size-3" />
                            {ev.date}
                            <span className="mx-0.5">·</span>
                            <Icon.MapPin className="size-3" />
                            <span className="truncate">{ev.venue}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-muted text-[11px] font-mono hidden sm:inline">
                            {ev.sold.toLocaleString()} / {ev.total.toLocaleString()} ({pct}%)
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-success">
                            <span className="size-1.5 rounded-full bg-success" />
                            Activo
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col justify-center">
              <p className="text-muted text-[11px] font-semibold uppercase tracking-wide">Top Evento (Ventas)</p>
              {topEvent ? (
                <>
                  <p className="text-foreground text-sm font-semibold mt-1">{topEvent.row.name}</p>
                  <p className="text-foreground text-xl font-bold my-1">{formatCurrency(topEvent.revenue)}</p>
                  <p className="text-muted text-xs">
                    {topEvent.row.venue} · {topEvent.row.date}
                  </p>
                </>
              ) : (
                <p className="text-muted text-xs">Sin datos todavía.</p>
              )}
            </div>
          </div>

          {/* Ocupación por evento */}
          <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col gap-2">
            <p className="text-foreground font-semibold text-xs">Ocupación por Evento</p>
            {occupancyByEvent.length === 0 ? (
              <p className="text-muted text-xs py-4 text-center">Todavía no hay zonas configuradas en tus eventos.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {occupancyByEvent.map(({ id, name, pct }) => (
                  <div key={id} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted truncate">{name}</span>
                      <span className="text-foreground font-medium shrink-0">{pct}% ocupado</span>
                    </div>
                    <div className="h-1 rounded-full bg-default overflow-hidden">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
