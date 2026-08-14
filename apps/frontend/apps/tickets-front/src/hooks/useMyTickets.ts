import { useEffect, useState } from "react";
import { ApiError, fetchAuthenticatedBlobUrl, useApi, useSession } from "@nextticket-frontend/commons";
import {
    formatEventDateTime,
    type ApiEventMinimal,
    type ApiEventSeatMinimal,
    type ApiPurchaseMinimal,
    type ApiTicket,
    type EnrichedTicket,
} from "../types/myTickets";

/**
 * Ticket no trae nombre de evento/recinto/asiento (son referencias opacas a
 * otros servicios): hay que cruzar Ticket -> Purchase -> Event -> EventSeat
 * a mano. No es un problema de miles de boletos (es una demo), así que no
 * se optimiza más allá de deduplicar ids antes de pedirlos.
 */
export function useMyTickets() {
    const api = useApi();
    const { user } = useSession();

    const [tickets, setTickets] = useState<EnrichedTicket[]>([]);
    const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        if (!user?.id) return;

        setLoading(true);
        setError(null);

        api.get<ApiTicket[]>(`/tickets/user/${user.id}`)
            .then(async (rawTickets) => {
                const purchaseIds = [
                    ...new Set(rawTickets.map((t) => t.purchaseId).filter((id): id is string => Boolean(id))),
                ];
                const purchases = await Promise.all(
                    purchaseIds.map((id) => api.get<ApiPurchaseMinimal>(`/purchases/${id}`).catch(() => null)),
                );
                const eventIdByPurchaseId = new Map(
                    purchases
                        .filter((purchase): purchase is ApiPurchaseMinimal => purchase !== null)
                        .map((purchase) => [purchase.id, purchase.eventId]),
                );

                const eventIds = [
                    ...new Set(
                        rawTickets
                            .map((t) => (t.purchaseId ? eventIdByPurchaseId.get(t.purchaseId) : undefined))
                            .filter((id): id is string => Boolean(id)),
                    ),
                ];
                const events = await Promise.all(
                    eventIds.map((id) => api.get<ApiEventMinimal>(`/events/${id}`).catch(() => null)),
                );
                const eventById = new Map(
                    events.filter((event): event is ApiEventMinimal => event !== null).map((event) => [event.id, event]),
                );

                // EventSeat.id -> fila/número real, agrupado por evento (el
                // endpoint de venues-events-service exige un eventId por llamada).
                const seatsByEvent = new Map<string, Map<string, ApiEventSeatMinimal>>();
                await Promise.all(
                    eventIds.map(async (eventId) => {
                        const seatIds = [
                            ...new Set(
                                rawTickets
                                    .filter(
                                        (t) =>
                                            t.eventSeatId &&
                                            t.purchaseId &&
                                            eventIdByPurchaseId.get(t.purchaseId) === eventId,
                                    )
                                    .map((t) => t.eventSeatId as string),
                            ),
                        ];
                        if (seatIds.length === 0) return;

                        const seats = await api
                            .get<ApiEventSeatMinimal[]>(
                                `/events/${eventId}/seats/by-event-seat-ids?ids=${encodeURIComponent(seatIds.join(","))}`,
                            )
                            .catch(() => [] as ApiEventSeatMinimal[]);
                        seatsByEvent.set(eventId, new Map(seats.map((seat) => [seat.id, seat])));
                    }),
                );

                const enriched: EnrichedTicket[] = rawTickets.map((ticket) => {
                    const eventId = ticket.purchaseId ? eventIdByPurchaseId.get(ticket.purchaseId) : undefined;
                    const event = eventId ? eventById.get(eventId) : undefined;
                    const zone = event?.zones.find((z) => z.id === ticket.eventZoneId);
                    const seat =
                        eventId && ticket.eventSeatId ? seatsByEvent.get(eventId)?.get(ticket.eventSeatId) : undefined;

                    return {
                        ticket,
                        eventName: event?.name ?? "Evento",
                        eventDateTime: event ? formatEventDateTime(event.startsAt) : "",
                        venueName: event?.venue.name ?? "—",
                        venueAddress: event?.venue.address ?? "",
                        venueCity: event?.venue.city ?? "",
                        venueState: event?.venue.state ?? "",
                        venueCountry: event?.venue.country ?? "México",
                        zoneName: zone?.publicName ?? "General",
                        row: seat?.seat.row ?? null,
                        seatNumber: seat?.seat.number ?? null,
                        seatType: seat?.seat.type ?? null,
                    };
                });

                setTickets(enriched);
            })
            .catch((err) => {
                setError(err instanceof ApiError ? err.message : "No se pudieron cargar tus boletos");
            })
            .finally(() => setLoading(false));
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, [user?.id]);

    // El QR se carga aparte: una imagen lenta o que falle no debe bloquear
    // el resto de la tarjeta (se queda con el placeholder de HoloCard).
    useEffect(() => {
        let cancelled = false;
        const createdUrls: string[] = [];
        setQrUrls({});

        tickets.forEach(({ ticket }) => {
            fetchAuthenticatedBlobUrl(`/tickets/${ticket.id}/qr`, user?.token)
                .then((url) => {
                    if (cancelled) {
                        URL.revokeObjectURL(url);
                        return;
                    }
                    createdUrls.push(url);
                    setQrUrls((current) => ({ ...current, [ticket.id]: url }));
                })
                .catch(() => {
                    // Sin QR la tarjeta se queda con el placeholder, no se bloquea la vista.
                });
        });

        return () => {
            cancelled = true;
            createdUrls.forEach((url) => URL.revokeObjectURL(url));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tickets]);

    return { tickets, qrUrls, loading, error, retry: load };
}
