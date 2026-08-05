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

    return (
        <Card
            variant="default"
            className={`flex flex-col overflow-hidden h-full transition-opacity ${isBlocked ? "opacity-60" : ""
                }`}
        >
            {/* Portada simulada */}
            <div
                className="relative h-32 flex items-end p-3"
                style={{
                    backgroundImage: `linear-gradient(135deg, ${event.cover.from}, ${event.cover.to})`,
                }}
                aria-hidden="true"
            >
                <div className="absolute inset-0 bg-black/25" />
                <Icon.Ticket className="absolute top-3 left-3 size-6! text-white/80" />
                <span className="relative text-xs font-medium text-white/90">{event.city}</span>
            </div>

            <Card.Header className="flex items-start justify-between gap-2">
                <Card.Title className="text-base leading-snug">{event.name}</Card.Title>
                <Chip variant="soft" color={availability.color} size="sm" className="shrink-0">
                    {isBlocked ? <Icon.Lock /> : <Icon.CircleCheck />}
                    {availability.label}
                </Chip>
            </Card.Header>

            <Card.Content className="flex-1 flex flex-col gap-2 text-sm text-muted">
                <span className="flex items-center gap-2">
                    <Icon.CalendarDays className="size-4 shrink-0" />
                    {formatEventDate(event.startsAt)}
                </span>
                <span className="flex items-center gap-2">
                    <Icon.Clock className="size-4 shrink-0" />
                    {formatEventSchedule(event.startsAt, event.endsAt)}
                </span>
                <span className="flex items-center gap-2">
                    <Icon.Building2 className="size-4 shrink-0" />
                    {event.venue}
                </span>
                <span className="flex items-center gap-2">
                    <Icon.MapPin className="size-4 shrink-0" />
                    {event.area}
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
