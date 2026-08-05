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
        <Card variant="default">
            <Card.Header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Card.Title className="text-lg">{event.name}</Card.Title>
                        <Chip variant="soft" color={availability.color} size="sm">
                            {availability.label}
                        </Chip>
                    </div>
                    <Card.Description>{availability.message}</Card.Description>
                </div>

                <Button variant="secondary" size="sm" onPress={onChangeEvent} className="shrink-0">
                    <Icon.ArrowLeft />
                    Cambiar evento
                </Button>
            </Card.Header>

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
