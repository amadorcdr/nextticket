import { useEffect, useMemo, useState } from "react";
import {
    ApiError,
    Button,
    Description,
    Icon,
    Router,
    ScrollShadow,
    setStoredHold,
    useApi,
    useCart,
    type HeldSeatInfo,
} from "@nextticket-frontend/commons";
import type { CartSeat } from "@nextticket-frontend/commons";
import { toClientEventDetail, type ApiEvent, type ApiEventSeat, type Paginated } from "../api";
import type { ClientEventDetail, ClientEventZone } from "../types/client";

function formatPrice(value: number) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0,
    }).format(value);
}

function chunk<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}

/** Prefijo de los ids sintéticos que representan un boleto de admisión general en el carrito. */
const GENERAL_PREFIX = "general-";

function generalSeatId(eventZoneId: string, index: number): string {
    return `${GENERAL_PREFIX}${eventZoneId}-${index}`;
}

/**
 * El eventZoneId es un UUID (trae guiones), así que no se puede partir el id
 * sintético por "-" a secas: se recorta el prefijo fijo y el índice final.
 */
function zoneIdFromGeneralSeatId(seatId: string): string | null {
    if (!seatId.startsWith(GENERAL_PREFIX)) return null;
    const withoutPrefix = seatId.slice(GENERAL_PREFIX.length);
    const lastDash = withoutPrefix.lastIndexOf("-");
    return lastDash === -1 ? null : withoutPrefix.slice(0, lastDash);
}

interface TemporaryBlockResponse {
    holdId: string;
    eventId: string;
    eventZoneId: string;
    status: "HELD";
    expiresAt: string;
    blocks: Array<{ blockId: string; eventSeatId: string | null; quantity: number }>;
}

type HoldErrorKind = "forbidden" | "conflict" | "generic";

/** Selector de cantidad para zonas de admisión general (sin asientos físicos que elegir). */
function GeneralAdmissionStepper({
    zone,
    quantity,
    onChange,
}: {
    zone: ClientEventZone;
    quantity: number;
    onChange: (next: number) => void;
}) {
    const max = Math.min(zone.maxTicketsPerPurchase, zone.availableCapacity);

    return (
        <div className="flex items-center justify-between gap-3 rounded-[10px] bg-surface-secondary px-3 py-2.5">
            <div className="min-w-0">
                <p className="md:text-sm text-xs font-medium truncate">{zone.name}</p>
                <p className="text-xs text-muted truncate">
                    {zone.description} · {formatPrice(zone.price)}
                </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    isDisabled={quantity <= 0}
                    aria-label={`Quitar un boleto de ${zone.name}`}
                    onPress={() => onChange(Math.max(0, quantity - 1))}
                >
                    <Icon.Minus />
                </Button>
                <span className="w-6 text-center md:text-sm text-xs font-semibold">{quantity}</span>
                <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    isDisabled={quantity >= max}
                    aria-label={`Agregar un boleto de ${zone.name}`}
                    onPress={() => onChange(Math.min(max, quantity + 1))}
                >
                    <Icon.Plus />
                </Button>
            </div>
        </div>
    );
}

/**
 * El endpoint de asientos limita `limit` a 100 (ver MAX_LIMIT en el backend),
 * así que una zona con más de 100 asientos necesita varias páginas: se pide
 * una página a la vez hasta que `hasNextPage` sea false.
 */
const SEATS_PAGE_LIMIT = 100;

async function fetchAllSeats(
    api: ReturnType<typeof useApi>,
    eventId: string,
    eventZoneId: string,
): Promise<ApiEventSeat[]> {
    const seats: ApiEventSeat[] = [];
    let page = 1;

    while (true) {
        const result = await api.get<Paginated<ApiEventSeat>>(
            `/events/${eventId}/seats?eventZoneId=${eventZoneId}&limit=${SEATS_PAGE_LIMIT}&page=${page}`,
        );
        seats.push(...result.data);
        if (!result.meta?.hasNextPage) break;
        page += 1;
    }

    return seats;
}

export function SeatSelection() {
    const { eventId } = Router.useParams();
    const navigate = Router.useNavigate();
    const api = useApi();
    const {
        seats: cartSeats,
        toggleSeat,
        isSelected,
        subtotal,
        setEvent,
    } = useCart();

    const [event, setEventDetail] = useState<ClientEventDetail | null>(null);
    const [seatsByZone, setSeatsByZone] = useState<Record<string, ApiEventSeat[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    const [isCreatingHold, setIsCreatingHold] = useState(false);
    const [holdError, setHoldError] = useState<{ kind: HoldErrorKind; message: string } | null>(null);

    const load = () => {
        if (!eventId) return;

        setLoading(true);
        setError(null);
        setNotFound(false);

        api.get<ApiEvent>(`/events/${eventId}`)
            .then(async (res) => {
                const detail = toClientEventDetail(res);
                setEventDetail(detail);

                const reservedZones = detail.zones.filter((zone) => zone.admissionType === "RESERVED");
                if (reservedZones.length === 0) {
                    setSeatsByZone({});
                    return;
                }

                const results = await Promise.all(
                    reservedZones.map((zone) =>
                        fetchAllSeats(api, eventId, zone.id).then((seats) => [zone.id, seats] as const),
                    ),
                );
                setSeatsByZone(Object.fromEntries(results));
            })
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

    /** EventSeat.id -> el asiento completo, para resolver zona/fila/número al armar el hold. */
    const seatsById = useMemo(() => {
        const map = new Map<string, ApiEventSeat>();
        Object.values(seatsByZone).forEach((seats) => {
            seats.forEach((seat) => map.set(seat.id, seat));
        });
        return map;
    }, [seatsByZone]);

    const resolveZoneId = (cartSeatId: string): string | null => {
        const generalZoneId = zoneIdFromGeneralSeatId(cartSeatId);
        if (generalZoneId) return generalZoneId;
        return seatsById.get(cartSeatId)?.eventZoneId ?? null;
    };

    const generalQuantityByZone = useMemo(() => {
        const counts: Record<string, number> = {};
        cartSeats.forEach((seat) => {
            const zoneId = zoneIdFromGeneralSeatId(seat.id);
            if (zoneId) counts[zoneId] = (counts[zoneId] ?? 0) + 1;
        });
        return counts;
    }, [cartSeats]);

    const setGeneralQuantity = (zone: ClientEventZone, nextQuantity: number) => {
        const current = generalQuantityByZone[zone.id] ?? 0;

        if (nextQuantity > current) {
            for (let i = current; i < nextQuantity; i++) {
                const seat: CartSeat = {
                    id: generalSeatId(zone.id, i),
                    row: "GA",
                    number: i + 1,
                    zone: zone.name,
                    price: zone.price,
                };
                toggleSeat(seat);
            }
        } else if (nextQuantity < current) {
            for (let i = current - 1; i >= nextQuantity; i--) {
                const seat = cartSeats.find((s) => s.id === generalSeatId(zone.id, i));
                if (seat) toggleSeat(seat);
            }
        }
    };

    const handleContinue = async () => {
        if (!event || cartSeats.length === 0) return;

        setHoldError(null);
        setIsCreatingHold(true);

        interface ZoneGroup {
            zone: ClientEventZone;
            seatIds: string[];
            generalCount: number;
        }

        const groups = new Map<string, ZoneGroup>();
        for (const seat of cartSeats) {
            const zoneId = resolveZoneId(seat.id);
            const zone = event.zones.find((z) => z.id === zoneId);
            if (!zoneId || !zone) continue;

            const group = groups.get(zoneId) ?? { zone, seatIds: [], generalCount: 0 };
            if (zone.admissionType === "GENERAL") {
                group.generalCount += 1;
            } else {
                group.seatIds.push(seat.id);
            }
            groups.set(zoneId, group);
        }

        const calls: Array<() => Promise<TemporaryBlockResponse>> = [];
        for (const group of groups.values()) {
            if (group.zone.admissionType === "GENERAL") {
                calls.push(() =>
                    api.post<TemporaryBlockResponse>("/purchases/temporary-blocks", {
                        eventId: event.id,
                        eventZoneId: group.zone.id,
                        quantity: group.generalCount,
                    }),
                );
            } else {
                // El backend rechaza más de 10 eventSeatIds por llamada: se
                // reparte en varias si el usuario eligió más de 10 asientos.
                for (const seatIdsChunk of chunk(group.seatIds, 10)) {
                    calls.push(() =>
                        api.post<TemporaryBlockResponse>("/purchases/temporary-blocks", {
                            eventId: event.id,
                            eventZoneId: group.zone.id,
                            eventSeatIds: seatIdsChunk,
                        }),
                    );
                }
            }
        }

        const settled = await Promise.allSettled(calls.map((call) => call()));
        const fulfilled = settled.filter(
            (r): r is PromiseFulfilledResult<TemporaryBlockResponse> => r.status === "fulfilled",
        );
        const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");

        if (rejected.length > 0) {
            // Best-effort: libera lo que sí se alcanzó a bloquear, para no dejar
            // asientos apartados que el usuario no sabe que tiene (expiran solos,
            // pero es mejor soltarlos de inmediato).
            await Promise.allSettled(
                fulfilled.flatMap((r) => r.value.blocks.map((b) => api.del(`/purchases/temporary-blocks/${b.blockId}`))),
            );

            const firstError = rejected[0].reason;
            setIsCreatingHold(false);

            if (firstError instanceof ApiError && firstError.status === 403) {
                setHoldError({
                    kind: "forbidden",
                    message: "Tu turno en la fila virtual ya no está activo.",
                });
            } else if (firstError instanceof ApiError && firstError.status === 409) {
                setHoldError({
                    kind: "conflict",
                    message: "Alguien más apartó uno de estos asientos justo antes que tú. Elige otros.",
                });
            } else {
                setHoldError({
                    kind: "generic",
                    message: firstError instanceof ApiError ? firstError.message : "No se pudo apartar tu selección.",
                });
            }
            return;
        }

        const seatMap: Record<string, HeldSeatInfo> = {};
        const blockIds: string[] = [];
        let earliestExpiryMs: number | null = null;

        for (const response of fulfilled.map((r) => r.value)) {
            const zone = groups.get(response.eventZoneId)?.zone;
            const unitPrice = zone?.price ?? 0;
            const expiryMs = new Date(response.expiresAt).getTime();
            if (earliestExpiryMs === null || expiryMs < earliestExpiryMs) earliestExpiryMs = expiryMs;

            const isGeneralZone = zone?.admissionType === "GENERAL";
            if (isGeneralZone) {
                // Un solo block cubre toda la cantidad: se reparte entre los N
                // asientos sintéticos de esa zona que sí están en el carrito.
                cartSeats
                    .filter((seat) => zoneIdFromGeneralSeatId(seat.id) === response.eventZoneId)
                    .forEach((seat) => {
                        seatMap[seat.id] = { eventZoneId: response.eventZoneId, eventSeatId: null, unitPrice };
                    });
            } else {
                response.blocks.forEach((block) => {
                    if (block.eventSeatId) {
                        seatMap[block.eventSeatId] = {
                            eventZoneId: response.eventZoneId,
                            eventSeatId: block.eventSeatId,
                            unitPrice,
                        };
                    }
                });
            }

            blockIds.push(...response.blocks.map((b) => b.blockId));
        }

        setStoredHold({
            eventId: event.id,
            expiresAt: new Date(earliestExpiryMs ?? Date.now()).toISOString(),
            blockIds,
            seatMap,
        });

        setIsCreatingHold(false);
        navigate("/checkout");
    };

    if (loading) {
        return <p className="text-muted text-xs py-16 text-center">Cargando asientos...</p>;
    }

    if (notFound || (!loading && !error && !event)) {
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

    const reservedZones = event.zones.filter((zone) => zone.admissionType === "RESERVED");
    const generalZones = event.zones.filter((zone) => zone.admissionType === "GENERAL");
    const hasSeatMap = reservedZones.some((zone) => (seatsByZone[zone.id]?.length ?? 0) > 0);

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

            {holdError && (
                <div className="flex items-center justify-between gap-3 rounded-[10px] bg-danger/10 px-3 py-2.5 shrink-0">
                    <p className="text-danger md:text-sm text-xs">{holdError.message}</p>
                    {holdError.kind === "forbidden" ? (
                        <Button size="sm" onPress={() => navigate(`/event/${event.id}/fila`)}>
                            Ir a la fila
                        </Button>
                    ) : (
                        <Button size="sm" variant="secondary" onPress={() => setHoldError(null)}>
                            Entendido
                        </Button>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 flex-1 min-h-0">
                <div className="flex flex-col gap-4 min-w-0">
                    {event.zones.length === 0 && (
                        <p className="text-muted text-xs py-16 text-center">
                            Este evento no tiene zonas disponibles para la venta.
                        </p>
                    )}

                    {generalZones.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <h4>Admisión general</h4>
                            {generalZones.map((zone) => (
                                <GeneralAdmissionStepper
                                    key={zone.id}
                                    zone={zone}
                                    quantity={generalQuantityByZone[zone.id] ?? 0}
                                    onChange={(next) => setGeneralQuantity(zone, next)}
                                />
                            ))}
                        </div>
                    )}

                    {reservedZones.length > 0 && (
                        <div className="rounded-[10px] bg-surface-secondary py-2 text-center">
                            <span className="text-xs uppercase tracking-widest text-muted">
                                Escenario
                            </span>
                        </div>
                    )}

                    <ScrollShadow className="flex-1 overflow-auto" orientation="horizontal">
                        <div className="flex flex-col gap-6 w-fit mx-auto p-1">
                            {reservedZones.map((zone) => {
                                const zoneSeats = seatsByZone[zone.id] ?? [];
                                const rows = Array.from(new Set(zoneSeats.map((s) => s.seat.row))).sort();

                                return (
                                    <div key={zone.id} className="flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between gap-2 pb-1">
                                            <h4>{zone.name}</h4>
                                            <span className="text-xs text-muted">{formatPrice(zone.price)}</span>
                                        </div>

                                        {rows.length === 0 && (
                                            <p className="text-muted text-xs py-4 text-center">
                                                No hay asientos configurados en esta zona.
                                            </p>
                                        )}

                                        {rows.map((row) => {
                                            const rowSeats = zoneSeats
                                                .filter((s) => s.seat.row === row)
                                                .sort((a, b) => Number(a.seat.number) - Number(b.seat.number));

                                            return (
                                                <div key={row} className="flex items-center gap-1.5">
                                                    <span className="w-4 text-xs text-muted shrink-0">{row}</span>
                                                    {rowSeats.map((apiSeat) => {
                                                        const occupied = apiSeat.status !== "AVAILABLE";
                                                        const selected = isSelected(apiSeat.id);
                                                        const seatNumber = Number(apiSeat.seat.number) || 0;

                                                        return (
                                                            <button
                                                                key={apiSeat.id}
                                                                type="button"
                                                                disabled={occupied}
                                                                aria-label={`Fila ${row}, asiento ${apiSeat.seat.number}, ${zone.name}, ${formatPrice(zone.price)}`}
                                                                aria-pressed={selected}
                                                                onClick={() =>
                                                                    toggleSeat({
                                                                        id: apiSeat.id,
                                                                        row,
                                                                        number: seatNumber,
                                                                        zone: zone.name,
                                                                        price: zone.price,
                                                                    })
                                                                }
                                                                title={`${zone.name} — ${formatPrice(zone.price)}`}
                                                                className={[
                                                                    "size-6 rounded-[4px] text-[10px] transition-colors",
                                                                    occupied
                                                                        ? "border border-dashed border-muted/50 text-muted/50 cursor-not-allowed"
                                                                        : selected
                                                                            ? "bg-accent text-accent-foreground"
                                                                            : "bg-surface-secondary hover:bg-default cursor-pointer",
                                                                ].join(" ")}
                                                            >
                                                                {apiSeat.seat.number}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollShadow>

                    {hasSeatMap && (
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
                                <span className="size-3 rounded-[3px] border border-dashed border-muted/50" />
                                Ocupado
                            </span>
                        </div>
                    )}
                </div>

                <aside className="rounded-[10px] bg-surface shadow-surface p-4 flex flex-col gap-4 lg:self-start">
                    <div>
                        <h4>Tu selección</h4>
                        <Description>
                            {cartSeats.length === 0
                                ? "Elige un asiento o boleto"
                                : `${cartSeats.length} ${cartSeats.length === 1 ? "boleto" : "boletos"}`}
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
                                            {seat.row === "GA"
                                                ? `Admisión general #${seat.number}`
                                                : `Fila ${seat.row} · Asiento ${seat.number}`}
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
                                            aria-label={`Quitar ${seat.id}`}
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
                        isDisabled={cartSeats.length === 0 || isCreatingHold}
                        onPress={handleContinue}
                    >
                        {isCreatingHold ? (
                            <>
                                <Icon.LoaderCircle className="animate-spin" />
                                Apartando...
                            </>
                        ) : (
                            <>
                                Continuar
                                <Icon.ArrowRight />
                            </>
                        )}
                    </Button>
                </aside>
            </div>
        </div>
    );
}
