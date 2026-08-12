import { Button, Chip, Icon, Router } from "@nextticket-frontend/commons";
import type { AdminEvent, AdminEventStatus } from "../types/admin";

type ChipColor = "default" | "success" | "warning" | "danger" | "accent";

const STATUS_META: Record<AdminEventStatus, { label: string; color: ChipColor }> = {
    proximo: { label: "Próximo", color: "accent" },
    activo: { label: "Activo", color: "success" },
    finalizado: { label: "Finalizado", color: "default" },
    cancelado: { label: "Cancelado", color: "danger" },
    borrador: { label: "Borrador", color: "warning" },
};

export function AdminEventCard({ event }: { event: AdminEvent }) {
    const status = STATUS_META[event.status];
    const pct = event.totalSeats > 0 ? Math.round((event.ticketsSold / event.totalSeats) * 100) : 0;

    return (
        <article className="group relative flex flex-col overflow-hidden rounded-[10px] bg-surface shadow-surface transition-shadow hover:shadow-overlay">
            <div className="relative aspect-[16/10] overflow-hidden">
                <img
                    src={event.imageUrl}
                    alt={event.title}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute left-3 top-3 rounded-full bg-surface/85 backdrop-blur-sm">
                    <Chip variant="soft" size="sm">
                        {event.category}
                    </Chip>
                </div>
                <div className="absolute right-3 top-3 rounded-full bg-surface/85 backdrop-blur-sm">
                    <Chip variant="soft" size="sm" color={status.color}>
                        {status.label}
                    </Chip>
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-col gap-1">
                    <h4 className="line-clamp-2">{event.title}</h4>
                    <p className="flex items-center gap-2 text-muted md:text-sm text-xs">
                        <Icon.Calendar className="size-4 shrink-0" />
                        <span className="truncate">
                            {event.date} • {event.time} hrs
                        </span>
                    </p>
                    <p className="flex items-center gap-2 text-muted md:text-sm text-xs">
                        <Icon.MapPin className="size-4 shrink-0" />
                        <span className="truncate">{event.venue}</span>
                    </p>
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[11px]">
                        <span className="text-muted font-mono">
                            {event.ticketsSold.toLocaleString()} / {event.totalSeats.toLocaleString()}
                        </span>
                        <span className="text-foreground font-medium">{pct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-default overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                </div>

                <div className="mt-auto flex items-center gap-2 pt-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        fullWidth
                        render={(domProps: any) => <Router.Link to={`/event/${event.id}`} {...domProps} />}
                    >
                        Ver detalles
                    </Button>
                </div>
            </div>
        </article>
    );
}
