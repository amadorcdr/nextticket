import { Button, Icon, Router } from "@nextticket-frontend/commons";
import { TicketSummaryStats } from "../components/TicketSummaryStats";
import { PurchaseTable } from "../components/PurchaseTable";
import { ZoneDistributionTable } from "../components/ZoneDistributionTable";
import { EVENT_SALES_SUMMARIES, RECENT_PURCHASES, ZONE_DISTRIBUTION } from "../mocks/adminTicketsMocks";

export function AdminEventTicketsDetail() {
    const { eventId } = Router.useParams<{ eventId: string }>();
    const navigate = Router.useNavigate();

    const summary = EVENT_SALES_SUMMARIES.find((s) => s.eventId === eventId);

    if (!summary) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <p className="text-foreground font-semibold">Evento no encontrado</p>
                <Button size="sm" variant="secondary" onPress={() => navigate("/tickets")}>
                    <Icon.ArrowLeft />
                    Volver a Tickets
                </Button>
            </div>
        );
    }

    const purchases = RECENT_PURCHASES[summary.eventId] ?? [];
    const zones = ZONE_DISTRIBUTION[summary.eventId] ?? [];

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <Button size="sm" variant="ghost" isIconOnly onPress={() => navigate("/tickets")}>
                    <Icon.ArrowLeft />
                </Button>
                <div>
                    <h3>{summary.eventName}</h3>
                    <p className="text-muted text-xs mt-0.5 flex items-center gap-2">
                        <Icon.Calendar className="size-3.5" />
                        {summary.date}
                        <span>·</span>
                        <Icon.MapPin className="size-3.5" />
                        {summary.venue}
                    </p>
                </div>
            </div>

            <TicketSummaryStats summary={summary} />

            <div className="flex flex-col gap-1.5">
                <p className="text-foreground font-semibold text-xs">Compras Recientes</p>
                <PurchaseTable purchases={purchases} />
            </div>

            <div className="flex flex-col gap-1.5">
                <p className="text-foreground font-semibold text-xs">Distribución por Zona</p>
                <ZoneDistributionTable zones={zones} />
            </div>
        </div>
    );
}
