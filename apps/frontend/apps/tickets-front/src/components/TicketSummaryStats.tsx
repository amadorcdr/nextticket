import type { EventSalesSummary } from "../types/adminTickets";

function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-surface border border-border rounded-[10px] p-3">
            <p className="text-muted text-[11px] font-semibold uppercase tracking-wide mb-1">{label}</p>
            <p className="text-foreground text-lg font-bold">{value}</p>
        </div>
    );
}

export function TicketSummaryStats({ summary }: { summary: EventSalesSummary }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="Boletos totales" value={summary.totalTickets.toLocaleString()} />
            <StatCard label="Vendidos" value={summary.sold.toLocaleString()} />
            <StatCard label="Validados" value={summary.used.toLocaleString()} />
            <StatCard label="Sin validar" value={summary.pending.toLocaleString()} />
            <StatCard label="Disponibles" value={summary.available.toLocaleString()} />
            <StatCard label="Cancelados" value={summary.canceled.toLocaleString()} />
            <StatCard label="Ocupación" value={`${summary.occupancyPct}%`} />
            <StatCard label="Ingreso generado" value={formatCurrency(summary.revenue)} />
        </div>
    );
}
