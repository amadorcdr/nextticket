import { useEffect, useState } from "react";
import {
    ApiError,
    Button,
    Chip,
    Description,
    Icon,
    Router,
    Separator,
    useApi,
    useCart,
} from "@nextticket-frontend/commons";
import { toClientEventDetail, type ApiEvent } from "../api";
import type { ClientEventDetail } from "../types/client";

function formatPrice(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(value);
}

export function EventDetail() {
    const { eventId } = Router.useParams();
    const navigate = Router.useNavigate();
    const api = useApi();
    const { setEvent } = useCart();

    const [event, setEventDetail] = useState<ClientEventDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    const load = () => {
        if (!eventId) return;

        setLoading(true);
        setError(null);
        setNotFound(false);

        api.get<ApiEvent>(`/events/${eventId}`)
            .then((res) => setEventDetail(toClientEventDetail(res)))
            .catch((err) => {
                if (err instanceof ApiError && err.status === 404) {
                    setNotFound(true);
                    return;
                }
                setError(err instanceof ApiError ? err.message : "No se pudo cargar el evento");
            })
            .finally(() => setLoading(false));
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, [eventId]);

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
        // Solo cuando cambia el evento: setEvent es estable por evento.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event?.id]);

    if (loading) {
        return <p className="text-muted text-xs py-16 text-center">Cargando evento...</p>;
    }

    if (notFound || (!loading && !error && !event)) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <Icon.CalendarX className="size-8 text-muted" />
                <h4>Evento no encontrado</h4>
                <p className="text-muted md:text-sm text-xs">
                    Puede que el evento ya no esté disponible.
                </p>
                <Button variant="secondary" onPress={() => navigate("/eventos")}>
                    <Icon.ArrowLeft />
                    Volver al catálogo
                </Button>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <Icon.CircleAlert className="size-8 text-muted" />
                <p className="text-muted md:text-sm text-xs">{error}</p>
                <Button size="sm" onPress={load}>
                    Reintentar
                </Button>
            </div>
        );
    }

    if (!event) return null;

    const isSoldOut = event.status === "sold-out";
    const minPrice = event.zones.length > 0 ? Math.min(...event.zones.map((zone) => zone.price)) : 0;

    return (
        <div className="flex flex-col gap-6 pb-6">
            <div className="relative overflow-hidden rounded-[10px] h-[220px] md:h-[320px] shrink-0">
                <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 md:p-6">
                    <Chip variant="soft" size="sm" className="w-fit">
                        {event.category}
                    </Chip>
                    <h1 className="text-white">{event.title}</h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/80 md:text-sm text-xs">
                        <span className="flex items-center gap-1.5">
                            <Icon.Calendar className="size-4" />
                            {event.date} • {event.time} hrs
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Icon.MapPin className="size-4" />
                            {event.venue}, {event.city}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
                <div className="flex flex-col gap-6 min-w-0">
                    <section className="flex flex-col gap-3">
                        <h3>Sobre el evento</h3>
                        <p className="text-muted">
                            {event.description || "Este evento todavía no tiene una descripción."}
                        </p>
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-3">
                        <h3>El recinto</h3>
                        <div className="rounded-[10px] bg-surface shadow-surface p-4 flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <Icon.Building2 className="size-4 text-muted" />
                                <h4>{event.venueInfo.name}</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Description>Dirección</Description>
                                    <p className="md:text-sm text-xs">
                                        {event.venueInfo.address || "Sin dirección registrada"}
                                    </p>
                                </div>
                                <div>
                                    <Description>Aforo total</Description>
                                    <p className="md:text-sm text-xs">
                                        {event.venueInfo.totalCapacity.toLocaleString("es-MX")} personas
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Resumen de compra: se queda fijo al hacer scroll en escritorio */}
                <aside className="lg:sticky lg:top-0 lg:self-start">
                    <div className="rounded-[10px] bg-surface shadow-surface p-4 flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <Description>Entradas desde</Description>
                                <p className="text-2xl font-semibold">
                                    {formatPrice(minPrice, event.currency)}
                                </p>
                            </div>
                            <Chip
                                variant="soft"
                                size="sm"
                                color={isSoldOut ? "danger" : "success"}
                            >
                                {isSoldOut ? "Agotado" : "Disponible"}
                            </Chip>
                        </div>

                        <div className="flex flex-col gap-2">
                            {event.zones.map((zone) => (
                                <div
                                    key={zone.id}
                                    className="flex items-center justify-between gap-3 rounded-[10px] bg-surface-secondary px-3 py-2"
                                >
                                    <div className="min-w-0">
                                        <p className="md:text-sm text-xs font-medium truncate">
                                            {zone.name}
                                        </p>
                                        <p className="text-xs text-muted truncate">
                                            {zone.description}
                                        </p>
                                    </div>
                                    <span className="md:text-sm text-xs font-semibold shrink-0">
                                        {formatPrice(zone.price, event.currency)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <Button
                            className="w-full"
                            isDisabled={isSoldOut || event.zones.length === 0}
                            onPress={() => navigate(`/event/${event.id}/fila`)}
                        >
                            <Icon.Armchair />
                            {isSoldOut ? "Agotado" : "Elegir asientos"}
                        </Button>

                        <p className="text-xs text-muted text-center">
                            {event.availableSeats.toLocaleString("es-MX")} lugares
                            disponibles de {event.totalSeats.toLocaleString("es-MX")}
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}
