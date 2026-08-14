import { Button, Chip, Icon, Router, Table } from "@nextticket-frontend/commons";
import { useEventSalesSummary } from "../hooks/useEventSalesSummary";
import type { ApiPurchaseStatus } from "../types/eventSales";

type ChipColor = "default" | "success" | "warning" | "danger" | "accent";

const PURCHASE_STATUS_COLOR: Record<ApiPurchaseStatus, ChipColor> = {
    PENDING: "warning",
    CONFIRMED: "success",
    CANCELED: "danger",
    REFUNDED: "default",
};

function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
    }).format(value);
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-surface border border-border rounded-[10px] p-3">
            <p className="text-muted text-[11px] font-semibold uppercase tracking-wide mb-1 truncate">{label}</p>
            <p className="text-foreground text-lg font-bold truncate">{value}</p>
        </div>
    );
}

export function EventSalesSummary() {
    const { eventId } = Router.useParams<{ eventId: string }>();
    const navigate = Router.useNavigate();
    const { data, loading, error, notFound, retry } = useEventSalesSummary(eventId);

    if (loading) {
        return <p className="text-muted text-xs py-16 text-center">Cargando resumen de ventas...</p>;
    }

    if (notFound) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <p className="text-foreground font-semibold">Evento no encontrado</p>
                <Button size="sm" variant="secondary" onPress={() => navigate("/events")}>
                    <Icon.ArrowLeft />
                    Volver a Eventos
                </Button>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <p className="text-muted text-xs">{error ?? "No se pudo cargar el resumen de ventas"}</p>
                <Button size="sm" onPress={retry}>
                    Reintentar
                </Button>
            </div>
        );
    }

    const { event, metrics, zones, recentPurchases } = data;

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <Button size="sm" variant="ghost" isIconOnly onPress={() => navigate("/events")}>
                    <Icon.ArrowLeft />
                </Button>
                <div>
                    <h3>{event.name}</h3>
                    <p className="text-muted text-xs mt-0.5 flex items-center gap-1.5">
                        <Icon.Calendar className="size-3" />
                        {event.date}
                        <span className="mx-0.5">·</span>
                        <Icon.MapPin className="size-3" />
                        {event.venue}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatCard label="Boletos Totales" value={metrics.totalTickets.toLocaleString()} />
                <StatCard label="Vendidos" value={metrics.sold.toLocaleString()} />
                <StatCard label="Validados" value={metrics.validated.toLocaleString()} />
                <StatCard label="Sin Validar" value={metrics.unvalidated.toLocaleString()} />
                <StatCard label="Disponibles" value={metrics.available.toLocaleString()} />
                <StatCard label="Cancelados" value={metrics.canceled.toLocaleString()} />
                <StatCard label="Ocupación" value={`${metrics.occupancyPercentage}%`} />
                <StatCard label="Ingreso Generado" value={formatCurrency(metrics.totalRevenue)} />
            </div>

            <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col gap-2">
                <p className="text-foreground font-semibold text-xs">Compras Recientes</p>
                {recentPurchases.length === 0 ? (
                    <p className="text-muted text-xs py-4 text-center">Este evento todavía no tiene compras.</p>
                ) : (
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
                                <Table.Body items={recentPurchases}>
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
                )}
            </div>

            <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col gap-2">
                <p className="text-foreground font-semibold text-xs">Distribución por Zona</p>
                {zones.length === 0 ? (
                    <p className="text-muted text-xs py-4 text-center">Este evento no tiene zonas configuradas.</p>
                ) : (
                    <Table>
                        <Table.ScrollContainer>
                            <Table.Content aria-label="Distribución por zona" className="min-w-140 text-xs">
                                <Table.Header>
                                    <Table.Column isRowHeader id="zone" minWidth={120} className="text-center">
                                        Zona
                                    </Table.Column>
                                    <Table.Column id="capacity" minWidth={90} className="text-center">
                                        Capacidad
                                    </Table.Column>
                                    <Table.Column id="sold" minWidth={90} className="text-center">
                                        Vendidos
                                    </Table.Column>
                                    <Table.Column id="available" minWidth={90} className="text-center">
                                        Disponibles
                                    </Table.Column>
                                    <Table.Column id="revenue" minWidth={100} className="text-center">
                                        Ingreso
                                    </Table.Column>
                                </Table.Header>
                                <Table.Body items={zones}>
                                    {(zone) => (
                                        <Table.Row>
                                            <Table.Cell className="text-center">
                                                <span className="text-xs font-medium text-foreground">{zone.label}</span>
                                            </Table.Cell>
                                            <Table.Cell className="text-center">
                                                <span className="text-xs">{zone.capacity.toLocaleString()}</span>
                                            </Table.Cell>
                                            <Table.Cell className="text-center">
                                                <span className="text-xs">{zone.sold.toLocaleString()}</span>
                                            </Table.Cell>
                                            <Table.Cell className="text-center">
                                                <span className="text-xs">{zone.available.toLocaleString()}</span>
                                            </Table.Cell>
                                            <Table.Cell className="text-center">
                                                <span className="text-foreground text-xs font-semibold">{formatCurrency(zone.revenue)}</span>
                                            </Table.Cell>
                                        </Table.Row>
                                    )}
                                </Table.Body>
                            </Table.Content>
                        </Table.ScrollContainer>
                    </Table>
                )}
            </div>
        </div>
    );
}
