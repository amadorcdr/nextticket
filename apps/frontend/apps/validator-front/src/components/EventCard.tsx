import { useState } from "react";
import { Button, Card, Chip, Icon } from "@nextticket-frontend/commons";
import { getEventAvailability, type ValidatorEvent } from "../mocks/validatorEvents";
import { formatEventDate, formatEventSchedule } from "../utils/format";

interface EventCardProps {
    event: ValidatorEvent;
    onSelect: (event: ValidatorEvent) => void;
}

export function EventCard({ event, onSelect }: EventCardProps) {
    const availability = getEventAvailability(event);
    const isBlocked = !availability.canValidate;
    const [imageFailed, setImageFailed] = useState(false);

    return (
        <Card
            variant="default"
            className={`group flex flex-col overflow-hidden h-full transition-shadow ${isBlocked ? "opacity-60" : "hover:shadow-overlay"
                }`}
        >
            <div
                className="relative aspect-[16/10] overflow-hidden"
                style={{
                    backgroundImage: `linear-gradient(135deg, ${event.cover.from}, ${event.cover.to})`,
                }}
            >
                {/* Degradado de fondo visible mientras carga la imagen o como
                    alternativa si la URL falla (imageFailed). */}
                {!imageFailed && (
                    <img
                        src={event.imageUrl}
                        alt={event.name}
                        loading="lazy"
                        onError={() => setImageFailed(true)}
                        className={`size-full object-cover transition-transform duration-500 ${isBlocked ? "" : "group-hover:scale-105"
                            }`}
                    />
                )}
                {imageFailed && (
                    <Icon.ImageOff className="absolute inset-0 m-auto size-8! text-white/70" />
                )}
                <div className="absolute inset-0 bg-black/25" />

                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-surface/85 px-2 py-1 backdrop-blur-sm">
                    <Icon.MapPin className="size-3.5 shrink-0" />
                    <span className="text-xs font-medium">{event.city}</span>
                </div>
                <div className="absolute right-3 top-3 rounded-full bg-surface/85 backdrop-blur-sm">
                    <Chip variant="soft" color={availability.color} size="sm">
                        {isBlocked ? <Icon.Lock /> : <Icon.CircleCheck />}
                        {availability.label}
                    </Chip>
                </div>
            </div>

            <Card.Header>
                <Card.Title className="text-base leading-snug line-clamp-2">{event.name}</Card.Title>
            </Card.Header>

            <Card.Content className="flex-1 flex flex-col gap-2 text-sm text-muted">
                <span className="flex items-center gap-2">
                    <Icon.CalendarDays className="size-4 shrink-0" />
                    <span className="truncate">{formatEventDate(event.startsAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                    <Icon.Clock className="size-4 shrink-0" />
                    <span className="truncate">{formatEventSchedule(event.startsAt, event.endsAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                    <Icon.Building2 className="size-4 shrink-0" />
                    <span className="truncate">{event.venue}</span>
                </span>
                <span className="flex items-center gap-2">
                    <Icon.MapPin className="size-4 shrink-0" />
                    <span className="truncate">{event.area}</span>
                </span>
            </Card.Content>

            <Card.Footer className="flex flex-col items-stretch gap-3">
                <span
                    className={`flex items-center gap-2 text-xs ${isBlocked ? "text-muted" : "text-success"
                        }`}
                >
                    {isBlocked ? (
                        <Icon.TriangleAlert className="size-4 shrink-0" />
                    ) : (
                        <Icon.CircleCheck className="size-4 shrink-0" />
                    )}
                    {availability.message}
                </span>

                <Button
                    fullWidth
                    variant={isBlocked ? "secondary" : "primary"}
                    isDisabled={isBlocked}
                    onPress={() => onSelect(event)}
                >
                    {isBlocked ? "No disponible" : "Seleccionar evento"}
                    {!isBlocked && <Icon.ChevronRight />}
                </Button>
            </Card.Footer>
        </Card>
    );
}
