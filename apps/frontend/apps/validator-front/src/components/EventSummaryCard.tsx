import { Button, Card, Chip, Icon } from "@nextticket-frontend/commons";
import { getEventAvailability, type ValidatorEvent } from "../mocks/validatorEvents";
import { formatEventDate, formatEventSchedule } from "../utils/format";

interface EventSummaryCardProps {
    event: ValidatorEvent;
    onChangeEvent: () => void;
}

export function EventSummaryCard({ event, onChangeEvent }: EventSummaryCardProps) {
    const availability = getEventAvailability(event);

    return (
        <Card variant="default" className="overflow-hidden">
            {/* Portada del evento en events-front: imagen + degradado inferior con el contenido encima. */}
            <div className="relative h-[180px] md:h-[240px] shrink-0">
                <img src={event.imageUrl} alt={event.name} className="size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <Button
                    variant="secondary"
                    size="sm"
                    onPress={onChangeEvent}
                    className="absolute right-3 top-3 shrink-0"
                >
                    <Icon.ArrowLeft />
                    Cambiar evento
                </Button>

                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 md:p-6">
                    <Chip variant="soft" color={availability.color} size="sm" className="w-fit">
                        {availability.label}
                    </Chip>
                    <Card.Title className="text-white text-lg">{event.name}</Card.Title>
                    <p className="text-white/80 text-sm">{availability.message}</p>
                </div>
            </div>

            <Card.Content className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <Icon.CalendarDays className="size-4 shrink-0 text-muted" />
                    <span>{formatEventDate(event.startsAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Icon.Clock className="size-4 shrink-0 text-muted" />
                    <span>{formatEventSchedule(event.startsAt, event.endsAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Icon.Building2 className="size-4 shrink-0 text-muted" />
                    <span>{event.venue}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Icon.MapPin className="size-4 shrink-0 text-muted" />
                    <span>{event.area}</span>
                </div>
            </Card.Content>
        </Card>
    );
}
