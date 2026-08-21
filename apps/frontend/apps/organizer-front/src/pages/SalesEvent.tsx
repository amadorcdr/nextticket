import { useEffect, useState } from "react";
import { ApiError, Button, Chip, Icon, ListBox, Select, Table, useApi, useSession } from "@nextticket-frontend/commons";
import { useEventSalesSummary, type ApiPurchaseStatus } from "@nextticket-frontend/tickets-front";
import type { ApiEvent } from "../api";

// El backend no soporta busqueda por texto en la query todavia (solo
// page/limit): se trae una sola pagina grande, mismo patron que MyEvents.
const FETCH_LIMIT = 100;

interface Paginated<T> {
  data: T[];
}

interface EventOption {
  id: string;
  name: string;
}

type ChipColor = "default" | "success" | "warning" | "danger" | "accent";

const PURCHASE_STATUS_COLOR: Record<ApiPurchaseStatus, ChipColor> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CANCELED: "danger",
  REFUNDED: "default",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-[10px] p-3">
      <p className="text-muted text-[11px] font-semibold uppercase tracking-wide mb-1 truncate">{label}</p>
      <p className="text-foreground text-lg font-bold truncate">{value}</p>
    </div>
  );
}

/*
 * purchases-service ahora deja a un ORGANIZER consultar /purchases y
 * /purchases/stats de un eventId, pero solo si ese evento es suyo (verifica
 * organizerId llamando a venues-events-service). Por eso ya se puede volver
 * a usar el mismo hook que Admin ("Ver ventas"), con ingreso real (no
 * estimado) y el listado real de compras.
 *
 * Único hueco que queda: el nombre del comprador puede salir como "Un
 * usuario" en vez del nombre real — GET /users/:id sigue siendo solo
 * uno-mismo-o-ADMIN, así que si el organizador no es esa persona, la
 * búsqueda del nombre falla en silencio (el hook ya lo maneja con fallback).
 */
export function SalesEvent() {
  const api = useApi();
  const { user } = useSession();

  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user?.id) {
      setEventsLoading(false);
      setEventsError("Tu sesión no tiene un id de usuario válido. Cierra sesión y vuelve a iniciarla.");
      return;
    }

    setEventsLoading(true);
    setEventsError(null);
    api
      .get<Paginated<ApiEvent>>(`/events?organizerId=${user.id}&limit=${FETCH_LIMIT}`)
      .then((res) => {
        // Mismo criterio que Zonas de Venta: un evento cancelado o finalizado
        // no tiene ventas que siga generando, no tiene caso mostrarlo aquí.
        const options = res.data
          .filter((ev) => ev.status !== "CANCELED" && ev.status !== "COMPLETED")
          .map((ev) => ({ id: ev.id, name: ev.name }));
        setEvents(options);
        setSelectedEventId((prev) => prev ?? options[0]?.id);
      })
      .catch((err) => setEventsError(err instanceof ApiError ? err.message : "No se pudieron cargar tus eventos"))
      .finally(() => setEventsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const { data, loading, error, notFound, retry } = useEventSalesSummary(selectedEventId);

  return (
    <div className="flex flex-col gap-3 animate-in fade-in duration-500">
      {/* Título + selector de evento */}
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h3>Ventas por Evento</h3>
          <p className="text-muted text-xs mt-0.5">
            {data ? `${data.event.name} — resumen de boletos y transacciones` : "Selecciona un evento para ver su resumen de ventas"}
          </p>
        </div>

        <Select
          className="w-fit"
          aria-label="Evento"
          value={selectedEventId}
          onChange={(v) => v && setSelectedEventId(v as string)}
          isDisabled={eventsLoading || events.length === 0}
        >
          <Select.Trigger>
            <div className="flex items-center gap-2">
              <Icon.Calendar className="shrink-0 size-3.5" />
              <Select.Value className="line-clamp-1 max-w-50 text-xs">
                {() => events.find((e) => e.id === selectedEventId)?.name ?? "Sin eventos"}
              </Select.Value>
            </div>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {events.map((e) => (
                <ListBox.Item key={e.id} id={e.id} textValue={e.name}>
                  {e.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {eventsLoading && <p className="text-muted text-xs py-8 text-center">Cargando tus eventos...</p>}

      {!eventsLoading && eventsError && <p className="text-muted text-xs py-8 text-center">{eventsError}</p>}

      {!eventsLoading && !eventsError && events.length === 0 && (
        <p className="text-muted text-xs py-8 text-center">Todavía no tienes eventos. Crea uno en "Mis Eventos" para ver sus ventas aquí.</p>
      )}

      {!eventsLoading && !eventsError && events.length > 0 && loading && (
        <p className="text-muted text-xs py-8 text-center">Cargando resumen de ventas...</p>
      )}

      {!eventsLoading && !eventsError && events.length > 0 && notFound && (
        <p className="text-muted text-xs py-8 text-center">Este evento ya no existe.</p>
      )}

      {!eventsLoading && !eventsError && events.length > 0 && !loading && !notFound && (error || !data) && (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-muted text-xs text-center">{error ?? "No se pudo cargar el resumen de ventas"}</p>
          <Button size="sm" onPress={retry}>
            Reintentar
          </Button>
        </div>
      )}

      {!eventsLoading && !eventsError && data && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="Boletos Vendidos" value={data.metrics.sold.toLocaleString()} />
            <StatCard label="Ventas Totales" value={formatCurrency(data.metrics.totalRevenue)} />
            <StatCard label="Ocupación" value={`${data.metrics.occupancyPercentage}%`} />
            <StatCard label="Asientos Disponibles" value={data.metrics.available.toLocaleString()} />
          </div>

          {/* Ventas por zona + compras recientes */}
          <div className="grid md:grid-cols-[240px_1fr] gap-2">
            <div className="bg-surface border border-border rounded-[10px] p-3">
              <p className="text-foreground font-semibold text-xs mb-2">Ventas por Zona</p>
              {data.zones.length === 0 ? (
                <p className="text-muted text-xs py-4 text-center">Sin zonas configuradas.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.zones.map((z) => {
                    const pct = z.capacity > 0 ? Math.round((z.sold / z.capacity) * 100) : 0;
                    return (
                      <div key={z.zoneId} className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted truncate">{z.label}</span>
                          <span className="text-foreground font-medium">{z.sold.toLocaleString()}</span>
                        </div>
                        <div className="h-1 rounded-full bg-default overflow-hidden">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 pt-2 border-t border-border flex justify-between text-[11px]">
                <span className="text-muted uppercase tracking-wide font-semibold">Total</span>
                <span className="text-foreground font-bold">{data.metrics.sold.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Compras recientes" className="min-w-140 text-xs">
                    <Table.Header>
                      <Table.Column isRowHeader id="folio" minWidth={90} className="text-center">
                        Folio
                      </Table.Column>
                      <Table.Column id="buyer" minWidth={140} className="text-center">
                        Comprador
                      </Table.Column>
                      <Table.Column id="quantity" minWidth={80} className="text-center">
                        Cantidad
                      </Table.Column>
                      <Table.Column id="total" minWidth={90} className="text-center">
                        Total
                      </Table.Column>
                      <Table.Column id="date" minWidth={110} className="text-center">
                        Fecha
                      </Table.Column>
                      <Table.Column id="status" minWidth={100} className="text-center">
                        Estado
                      </Table.Column>
                    </Table.Header>
                    <Table.Body items={data.recentPurchases}>
                      {(purchase) => (
                        <Table.Row>
                          <Table.Cell className="text-center">
                            <span className="font-mono text-xs text-foreground">{purchase.folio}</span>
                          </Table.Cell>
                          <Table.Cell className="text-center">
                            <span className="text-xs">{purchase.buyer}</span>
                          </Table.Cell>
                          <Table.Cell className="text-center">
                            <span className="text-xs">{purchase.quantity}</span>
                          </Table.Cell>
                          <Table.Cell className="text-center">
                            <span className="text-foreground text-xs font-semibold">{formatCurrency(purchase.total)}</span>
                          </Table.Cell>
                          <Table.Cell className="text-center">
                            <span className="text-xs">{purchase.date}</span>
                          </Table.Cell>
                          <Table.Cell className="text-center">
                            <Chip size="sm" variant="soft" color={PURCHASE_STATUS_COLOR[purchase.status]}>
                              {purchase.statusLabel}
                            </Chip>
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
              {data.recentPurchases.length === 0 && <p className="text-muted text-xs py-4 text-center">Este evento todavía no tiene compras.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
