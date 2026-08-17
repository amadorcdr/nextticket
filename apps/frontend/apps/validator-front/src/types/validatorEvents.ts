/**
 * Tipos y utilidades del catálogo de eventos del Validador.
 * Los eventos se consultan en tiempo real a venues-events-service (ver ../api.ts);
 * este archivo solo define su forma y la lógica de disponibilidad/filtrado en memoria.
 */

/**
 * Derivado en el cliente a partir del EventStatus real y de startsAt/endsAt:
 * venues-events-service no tiene un estado "en curso" explícito.
 */
export type ValidatorEventStatus = "IN_PROGRESS" | "UPCOMING" | "BLOCKED" | "FINISHED";

export type ValidatorEventFilter = "today" | "tomorrow" | "upcoming";

/** Zona comercial del evento, tal como la expone venues-events-service. */
export interface ValidatorEventZone {
    id: string;
    name: string;
}

export interface ValidatorEvent {
    id: string;
    name: string;
    venue: string;
    address: string;
    city: string;
    /** ISO string — solo para mostrar fecha y hora en la interfaz. */
    startsAt: string;
    endsAt: string;
    status: ValidatorEventStatus;
    imageUrl: string;
    /** Degradado de respaldo: se ve mientras carga la imagen o si la URL falla. */
    cover: { from: string; to: string };
    /** Zonas del evento — se usan para mostrar tipo de boleto/zona al validar. */
    zones: ValidatorEventZone[];
}

export interface EventAvailability {
    canValidate: boolean;
    /** Texto corto del estado, usado en el chip de la card. */
    label: string;
    /** Mensaje que explica por qué se puede o no validar. */
    message: string;
    color: "success" | "warning" | "danger" | "default" | "accent";
}

const AVAILABILITY: Record<ValidatorEventStatus, EventAvailability> = {
    IN_PROGRESS: {
        canValidate: true,
        label: "En curso",
        message: "Disponible para validar",
        color: "success",
    },
    UPCOMING: {
        canValidate: false,
        label: "Próximo",
        message: "La validación aún no está disponible",
        color: "default",
    },
    BLOCKED: {
        canValidate: false,
        label: "Cancelado",
        message: "Evento cancelado por el organizador",
        color: "warning",
    },
    FINISHED: {
        canValidate: false,
        label: "Finalizado",
        message: "Evento finalizado",
        color: "default",
    },
};

export function getEventAvailability(event: ValidatorEvent): EventAvailability {
    return AVAILABILITY[event.status];
}

function dayKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Filtrado en memoria por fecha: hoy, mañana o próximos. */
export function filterEventsByDate(
    events: ValidatorEvent[],
    filter: ValidatorEventFilter,
): ValidatorEvent[] {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    dayAfterTomorrow.setHours(0, 0, 0, 0);

    return events.filter((event) => {
        const starts = new Date(event.startsAt);
        if (filter === "today") return dayKey(starts) === dayKey(today);
        if (filter === "tomorrow") return dayKey(starts) === dayKey(tomorrow);
        return starts >= dayAfterTomorrow;
    });
}

export const EVENT_FILTERS: { id: ValidatorEventFilter; label: string }[] = [
    { id: "today", label: "Hoy" },
    { id: "tomorrow", label: "Mañana" },
    { id: "upcoming", label: "Próximos" },
];
