import { Chip, Icon } from "@nextticket-frontend/commons";
import type { UpcomingEventStatus, UpcomingEventSummary } from "../../types/dashboard";

type ChipColor = "default" | "success" | "warning" | "danger" | "accent";

const STATUS_META: Record<UpcomingEventStatus, { label: string; color: ChipColor }> = {
    proximo: { label: "Próximo", color: "accent" },
    activo: { label: "Activo", color: "success" },
    finalizado: { label: "Finalizado", color: "default" },
    cancelado: { label: "Cancelado", color: "danger" },
    borrador: { label: "Borrador", color: "warning" },
};

export function UpcomingEventsList({ events }: { events: UpcomingEventSummary[] }) {
    return (
        <div className="flex flex-col gap-2">
            {events.map((ev) => {
                const status = STATUS_META[ev.status];
                const pct = ev.totalSeats > 0 ? Math.round((ev.ticketsSold / ev.totalSeats) * 100) : 0;
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
                                {ev.venue}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <span className="text-muted text-[11px] font-mono hidden sm:inline">
                                {ev.ticketsSold.toLocaleString()} / {ev.totalSeats.toLocaleString()} ({pct}%)
                            </span>
                            <Chip size="sm" variant="soft" color={status.color}>
                                {status.label}
                            </Chip>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
