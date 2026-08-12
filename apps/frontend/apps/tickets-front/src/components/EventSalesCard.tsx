import { Button, Icon, Router } from "@nextticket-frontend/commons";
import type { EventSalesSummary } from "../types/adminTickets";

function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

export function EventSalesCard({ summary }: { summary: EventSalesSummary }) {
    const navigate = Router.useNavigate();

    return (
        <button
            type="button"
            onClick={() => navigate(summary.eventId)}
            className="text-left w-full rounded-[10px] bg-surface border border-border p-4 flex flex-col gap-3 transition-all hover:shadow-overlay hover:border-accent/40"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h4 className="line-clamp-1">{summary.eventName}</h4>
                    <p className="flex items-center gap-2 text-muted text-xs mt-1">
                        <Icon.Calendar className="size-3.5 shrink-0" />
                        <span className="truncate">{summary.date}</span>
                        <span>·</span>
                        <Icon.MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{summary.venue}</span>
                    </p>
                </div>
                <span className="shrink-0 text-foreground font-bold text-sm">{summary.occupancyPct}%</span>
            </div>

            <div className="h-1 rounded-full bg-default overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: `${summary.occupancyPct}%` }} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                    <p className="text-muted uppercase tracking-wide">Disponibles</p>
                    <p className="text-foreground font-semibold">{summary.available.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-muted uppercase tracking-wide">Vendidos</p>
                    <p className="text-foreground font-semibold">{summary.sold.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-muted uppercase tracking-wide">Utilizados</p>
                    <p className="text-foreground font-semibold">{summary.used.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-muted uppercase tracking-wide">Pendientes</p>
                    <p className="text-foreground font-semibold">{summary.pending.toLocaleString()}</p>
                </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-muted text-[11px]">Ingreso total</span>
                <span className="text-foreground font-bold text-sm">{formatCurrency(summary.revenue)}</span>
            </div>

            <Button size="sm" variant="secondary" fullWidth>
                <Icon.BarChart3 />
                Ver resumen de ventas
            </Button>
        </button>
    );
}
