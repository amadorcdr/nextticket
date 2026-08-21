import { Button, Chip, Icon, Router } from "@nextticket-frontend/commons";
import type { ClientEvent, ClientEventStatus } from "../types/client";

type EventCardProps = Readonly<{
    event: ClientEvent;
}>;

/** El color sale de los tokens del tema, no de hex fijos como en el diseño anterior. */
const STATUS_META: Record<
    ClientEventStatus,
    { label: string; color: "success" | "danger" }
> = {
    available: { label: "Disponible", color: "success" },
    "sold-out": { label: "Agotado", color: "danger" },
    // El catálogo nunca lista eventos cancelados, pero el tipo lo exige.
    canceled: { label: "Cancelado", color: "danger" },
};

function formatPrice(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(value);
}

export function EventCard({ event }: EventCardProps) {
    const status = STATUS_META[event.status];
    const isSoldOut = event.status === "sold-out";

    return (
        <article className="group relative flex flex-col overflow-hidden rounded-[10px] bg-surface shadow-surface transition-shadow hover:shadow-overlay">
            <div className="relative aspect-[16/10] overflow-hidden">
                <img
                    src={event.imageUrl}
                    alt={event.title}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Los chips van sobre la imagen: sin un fondo propio no se leen
                    en fotos claras. */}
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
                        <span className="truncate">
                            {event.venue}, {event.city}
                        </span>
                    </p>
                </div>

                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <div className="flex flex-col">
                        <span className="text-xs text-muted">Desde</span>
                        <span className="font-semibold">
                            {formatPrice(event.minPrice, event.currency)}
                        </span>
                    </div>

                    <Button
                        size="sm"
                        isDisabled={isSoldOut}
                        render={(domProps: any) => (
                            <Router.Link to={`/event/${event.id}`} {...domProps} />
                        )}
                    >
                        {isSoldOut ? "Agotado" : "Ver detalles"}
                    </Button>
                </div>
            </div>
        </article>
    );
}
