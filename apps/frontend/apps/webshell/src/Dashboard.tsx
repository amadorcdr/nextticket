import { Button, Icon } from "@nextticket-frontend/commons";
import { StatCard } from "./components/dashboard/StatCard";
import { UpcomingEventsList } from "./components/dashboard/UpcomingEventsList";
import { RecentActivityList } from "./components/dashboard/RecentActivityList";
import { SalesSummary } from "./components/dashboard/SalesSummary";
import { useDashboardData } from "./hooks/useDashboardData";

function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
    }).format(value);
}

export function Dashboard() {
    const { data, loading, error, retry } = useDashboardData();

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500">
            <div>
                <h3>Dashboard</h3>
                <p className="text-muted text-xs mt-0.5">Resumen general de la operación de Nextticket.</p>
            </div>

            {loading && <p className="text-muted text-xs py-8 text-center">Cargando panel...</p>}

            {!loading && error && (
                <div className="bg-surface border border-border rounded-[10px] p-6 flex flex-col items-center gap-3">
                    <p className="text-muted text-xs text-center">{error}</p>
                    <Button size="sm" onPress={retry}>
                        Reintentar
                    </Button>
                </div>
            )}

            {!loading && !error && data && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <StatCard label="Total Eventos" value={data.metrics.totalEvents.toString()} icon={Icon.Calendar} />
                        <StatCard label="Eventos Activos" value={data.metrics.activeEvents.toString()} icon={Icon.CalendarCheck} />
                        <StatCard label="Eventos Próximos" value={data.metrics.upcomingEvents.toString()} icon={Icon.CalendarClock} />
                        <StatCard label="Total Usuarios" value={data.metrics.totalUsers.toLocaleString()} icon={Icon.Users} />
                        <StatCard label="Boletos Vendidos" value={data.metrics.ticketsSold.toLocaleString()} icon={Icon.Ticket} />
                        <StatCard label="Ingresos Totales" value={formatCurrency(data.metrics.totalRevenue)} icon={Icon.Wallet} />
                        <StatCard label="Compras Recientes" value={data.metrics.recentPurchasesCount.toString()} icon={Icon.ShoppingCart} />
                    </div>

                    <div className="grid lg:grid-cols-2 gap-2">
                        <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col gap-2">
                            <p className="text-foreground font-semibold text-xs">Eventos Próximos</p>
                            {data.upcomingEvents.length === 0 ? (
                                <p className="text-muted text-xs py-4 text-center">Sin eventos próximos</p>
                            ) : (
                                <UpcomingEventsList events={data.upcomingEvents} />
                            )}
                        </div>

                        <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col gap-2">
                            <p className="text-foreground font-semibold text-xs">Actividad Reciente</p>
                            {data.activity.length === 0 ? (
                                <p className="text-muted text-xs py-4 text-center">Sin actividad reciente</p>
                            ) : (
                                <RecentActivityList items={data.activity} />
                            )}
                        </div>
                    </div>

                    <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col gap-2">
                        <p className="text-foreground font-semibold text-xs">Resumen de Ventas</p>
                        {data.occupancy.length === 0 ? (
                            <p className="text-muted text-xs py-4 text-center">Sin datos de ventas aún</p>
                        ) : (
                            <SalesSummary items={data.occupancy} />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
