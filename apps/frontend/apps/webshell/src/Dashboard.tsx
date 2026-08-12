import { Icon } from "@nextticket-frontend/commons";
import { StatCard } from "./components/dashboard/StatCard";
import { UpcomingEventsList } from "./components/dashboard/UpcomingEventsList";
import { RecentActivityList } from "./components/dashboard/RecentActivityList";
import { SalesSummary } from "./components/dashboard/SalesSummary";
import { DASHBOARD_METRICS, UPCOMING_EVENTS, RECENT_ACTIVITY, SALES_BY_EVENT } from "./mocks/dashboardMocks";

function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
    }).format(value);
}

export function Dashboard() {
    const m = DASHBOARD_METRICS;

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500">
            <div>
                <h3>Dashboard</h3>
                <p className="text-muted text-xs mt-0.5">Resumen general de la operación de Nextticket.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatCard label="Total Eventos" value={m.totalEvents.toString()} icon={Icon.Calendar} />
                <StatCard label="Eventos Activos" value={m.activeEvents.toString()} icon={Icon.CalendarCheck} />
                <StatCard label="Eventos Próximos" value={m.upcomingEvents.toString()} icon={Icon.CalendarClock} />
                <StatCard label="Total Usuarios" value={m.totalUsers.toLocaleString()} icon={Icon.Users} />
                <StatCard label="Boletos Vendidos" value={m.ticketsSold.toLocaleString()} icon={Icon.Ticket} />
                <StatCard label="Ingresos Simulados" value={formatCurrency(m.simulatedRevenue)} icon={Icon.Wallet} />
                <StatCard label="Compras Recientes" value={m.recentPurchasesCount.toString()} icon={Icon.ShoppingCart} />
            </div>

            <div className="grid lg:grid-cols-2 gap-2">
                <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col gap-2">
                    <p className="text-foreground font-semibold text-xs">Eventos Próximos</p>
                    <UpcomingEventsList events={UPCOMING_EVENTS} />
                </div>

                <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col gap-2">
                    <p className="text-foreground font-semibold text-xs">Actividad Reciente</p>
                    <RecentActivityList items={RECENT_ACTIVITY} />
                </div>
            </div>

            <div className="bg-surface border border-border rounded-[10px] p-3 flex flex-col gap-2">
                <p className="text-foreground font-semibold text-xs">Resumen de Ventas</p>
                <SalesSummary items={SALES_BY_EVENT} />
            </div>
        </div>
    );
}
