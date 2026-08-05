import { useEffect, useMemo } from "react";
import {
    Button,
    Description,
    Icon,
    Router,
    ScrollShadow,
    useCart,
} from "@nextticket-frontend/commons";
import { getEventDetail } from "../mocks/eventDetail";
import { buildSeatMap, SEAT_ROWS } from "../mocks/seats";

function formatPrice(value: number) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
    }).format(value);
}

export function SeatSelection() {
    const { eventId } = Router.useParams();
    const navigate = Router.useNavigate();
    const {
        seats: cartSeats,
        toggleSeat,
        isSelected,
        subtotal,
        setEvent,
    } = useCart();

    const event = eventId ? getEventDetail(eventId) : undefined;
    const seatMap = useMemo(() => buildSeatMap(), []);

    /*
     * También se registra el evento aquí, no solo en el detalle: se puede
     * llegar directo a esta URL y el checkout necesita saber de qué evento
     * son los asientos.
     */
    useEffect(() => {
        if (!event) return;

        setEvent({
            id: event.id,
            title: event.title,
            venue: event.venue,
            city: event.city,
            date: event.date,
            time: event.time,
            imageUrl: event.imageUrl,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event?.id]);

    const seatsByRow = useMemo(() => {
        return SEAT_ROWS.map((row) => ({
            row,
            seats: seatMap.filter((seat) => seat.row === row),
        }));
    }, [seatMap]);

    if (!event) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <Icon.CalendarX className="size-8 text-muted" />
                <h4>Evento no encontrado</h4>
                <Button variant="secondary" onPress={() => navigate("/eventos")}>
                    <Icon.ArrowLeft />
                    Volver al catálogo
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center gap-2 shrink-0">
                <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    onPress={() => navigate(`/event/${event.id}`)}
                >
                    <Icon.ArrowLeft />
                </Button>
                <div className="min-w-0">
                    <h2 className="truncate">Elige tus asientos</h2>
                    <p className="text-muted md:text-sm text-xs truncate">
                        {event.title} • {event.date}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 flex-1 min-h-0">
                <div className="flex flex-col gap-4 min-w-0">
                    <div className="rounded-[10px] bg-surface-secondary py-2 text-center">
                        <span className="text-xs uppercase tracking-widest text-muted">
                            Escenario
                        </span>
                    </div>

                    <ScrollShadow className="flex-1 overflow-auto" orientation="horizontal">
                        <div className="flex flex-col gap-1.5 w-fit mx-auto p-1">
                            {seatsByRow.map(({ row, seats }) => (
                                <div key={row} className="flex items-center gap-1.5">
                                    <span className="w-4 text-xs text-muted shrink-0">
                                        {row}
                                    </span>
                                    {seats.map((seat) => {
                                        const occupied = seat.availability === "occupied";
                                        const selected = isSelected(seat.id);

                                        return (
                                            <button
                                                key={seat.id}
                                                type="button"
                                                disabled={occupied}
                                                aria-label={`Fila ${seat.row}, asiento ${seat.number}, ${seat.zone}, ${formatPrice(seat.price)}`}
                                                aria-pressed={selected}
                                                onClick={() => toggleSeat(seat)}
                                                title={`${seat.zone} — ${formatPrice(seat.price)}`}
                                                className={[
                                                    "size-6 rounded-[4px] text-[10px] transition-colors",
                                                    occupied
                                                        ? "bg-default cursor-not-allowed opacity-40"
                                                        : selected
                                                            ? "bg-accent text-accent-foreground"
                                                            : "bg-surface-secondary hover:bg-default cursor-pointer",
                                                ].join(" ")}
                                            >
                                                {seat.number}
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </ScrollShadow>

                    <div className="flex flex-wrap items-center gap-4 shrink-0">
                        <span className="flex items-center gap-2 text-xs text-muted">
                            <span className="size-3 rounded-[3px] bg-surface-secondary" />
                            Disponible
                        </span>
                        <span className="flex items-center gap-2 text-xs text-muted">
                            <span className="size-3 rounded-[3px] bg-accent" />
                            Seleccionado
                        </span>
                        <span className="flex items-center gap-2 text-xs text-muted">
                            <span className="size-3 rounded-[3px] bg-default opacity-40" />
                            Ocupado
                        </span>
                    </div>
                </div>

                <aside className="rounded-[10px] bg-surface shadow-surface p-4 flex flex-col gap-4 lg:self-start">
                    <div>
                        <h4>Tu selección</h4>
                        <Description>
                            {cartSeats.length === 0
                                ? "Toca un asiento en el mapa"
                                : `${cartSeats.length} ${cartSeats.length === 1 ? "asiento" : "asientos"}`}
                        </Description>
                    </div>

                    {cartSeats.length > 0 && (
                        <div className="flex flex-col gap-2 max-h-[240px] overflow-auto">
                            {cartSeats.map((seat) => (
                                <div
                                    key={seat.id}
                                    className="flex items-center justify-between gap-2 rounded-[10px] bg-surface-secondary px-3 py-2"
                                >
                                    <div className="min-w-0">
                                        <p className="md:text-sm text-xs font-medium">
                                            Fila {seat.row} · Asiento {seat.number}
                                        </p>
                                        <p className="text-xs text-muted truncate">{seat.zone}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className="md:text-sm text-xs">
                                            {formatPrice(seat.price)}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            isIconOnly
                                            aria-label={`Quitar asiento ${seat.id}`}
                                            onPress={() => toggleSeat(seat)}
                                        >
                                            <Icon.X />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <span className="text-muted md:text-sm text-xs">Subtotal</span>
                        <span className="font-semibold">{formatPrice(subtotal)}</span>
                    </div>

                    <Button
                        className="w-full"
                        isDisabled={cartSeats.length === 0}
                        onPress={() => navigate("/checkout")}
                    >
                        Continuar
                        <Icon.ArrowRight />
                    </Button>
                </aside>
            </div>
        </div>
    );
}
