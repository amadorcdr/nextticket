/**
 * Datos simulados del módulo Validador.
 * Todo el flujo funciona en memoria: no hay APIs, servicios HTTP ni backend.
 */

export type ValidatorEventStatus =
    | "IN_PROGRESS"
    | "AVAILABLE"
    | "UPCOMING"
    | "BLOCKED"
    | "FINISHED";

export type ValidatorEventFilter = "today" | "tomorrow" | "upcoming";

export interface ValidatorEvent {
    id: string;
    name: string;
    venue: string;
    /** Zona o ubicación asignada al validador dentro del recinto. */
    area: string;
    city: string;
    /** ISO string — solo para mostrar fecha y hora en la interfaz. */
    startsAt: string;
    endsAt: string;
    status: ValidatorEventStatus;
    /** Portada simulada: degradado local, sin imágenes remotas. */
    cover: { from: string; to: string };
}

/** Minutos a partir de "ahora", acotados al día en curso para que los filtros sean estables. */
function todayAt(minutesFromNow: number): string {
    const now = new Date();
    const target = new Date(now.getTime() + minutesFromNow * 60_000);

    const dayStart = new Date(now);
    dayStart.setHours(0, 15, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(23, 45, 0, 0);

    if (target < dayStart) return dayStart.toISOString();
    if (target > dayEnd) return dayEnd.toISOString();
    return target.toISOString();
}

/** Fecha fija dentro de un día futuro (mañana o próximos). */
function dayAt(offsetDays: number, hours: number, minutes = 0): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
}

export const VALIDATOR_EVENTS: ValidatorEvent[] = [
    {
        id: "evt-rock-nacional",
        name: "Noche de Rock · Gira Nacional",
        venue: "Auditorio Nacional",
        area: "Acceso B · Cancha General",
        city: "Ciudad de México",
        startsAt: todayAt(-45),
        endsAt: todayAt(150),
        status: "IN_PROGRESS",
        cover: { from: "#7c3aed", to: "#db2777" },
    },
    {
        id: "evt-clasico-nacional",
        name: "Clásico Nacional · Jornada 12",
        venue: "Estadio Azteca",
        area: "Acceso 7 · Cabecera Sur",
        city: "Ciudad de México",
        startsAt: todayAt(40),
        endsAt: todayAt(220),
        status: "AVAILABLE",
        cover: { from: "#0ea5e9", to: "#14b8a6" },
    },
    {
        id: "evt-stand-up",
        name: "Stand Up: Risas en Vivo",
        venue: "Teatro Metropólitan",
        area: "Acceso principal · Luneta",
        city: "Ciudad de México",
        startsAt: todayAt(330),
        endsAt: todayAt(450),
        status: "UPCOMING",
        cover: { from: "#f59e0b", to: "#ef4444" },
    },
    {
        id: "evt-expo-anime",
        name: "Expo Anime & Games",
        venue: "Pepsi Center WTC",
        area: "Salón A · Puerta 2",
        city: "Ciudad de México",
        startsAt: todayAt(200),
        endsAt: todayAt(420),
        status: "BLOCKED",
        cover: { from: "#6366f1", to: "#22d3ee" },
    },
    {
        id: "evt-dev-summit",
        name: "Congreso Dev Summit · Día 1",
        venue: "Auditorio Telmex",
        area: "Sala Principal",
        city: "Guadalajara",
        startsAt: todayAt(-360),
        endsAt: todayAt(-180),
        status: "FINISHED",
        cover: { from: "#334155", to: "#0f172a" },
    },
    {
        id: "evt-sinfonica",
        name: "Sinfónica de la Ciudad",
        venue: "Auditorio Nacional",
        area: "Acceso A · Luneta A",
        city: "Ciudad de México",
        startsAt: dayAt(1, 19, 30),
        endsAt: dayAt(1, 21, 30),
        status: "UPCOMING",
        cover: { from: "#8b5cf6", to: "#3b82f6" },
    },
    {
        id: "evt-lucha-libre",
        name: "Lucha Libre: Máscara vs Cabellera",
        venue: "Arena CDMX",
        area: "Acceso 3 · Ring Side",
        city: "Ciudad de México",
        startsAt: dayAt(1, 21, 0),
        endsAt: dayAt(1, 23, 30),
        status: "UPCOMING",
        cover: { from: "#f97316", to: "#facc15" },
    },
    {
        id: "evt-festival-indie",
        name: "Festival Indie · Día 1",
        venue: "Parque Fundidora",
        area: "Escenario Norte",
        city: "Monterrey",
        startsAt: dayAt(6, 18, 0),
        endsAt: dayAt(6, 23, 59),
        status: "UPCOMING",
        cover: { from: "#10b981", to: "#0ea5e9" },
    },
    {
        id: "evt-esports-finals",
        name: "Torneo Esports · Finales",
        venue: "Arena Monterrey",
        area: "Grada Baja · Acceso 1",
        city: "Monterrey",
        startsAt: dayAt(9, 16, 0),
        endsAt: dayAt(9, 22, 0),
        status: "BLOCKED",
        cover: { from: "#ec4899", to: "#6366f1" },
    },
    {
        id: "evt-gira-mundial",
        name: "Gira Mundial · Fecha CDMX",
        venue: "Foro Sol",
        area: "General A · Acceso 12",
        city: "Ciudad de México",
        startsAt: dayAt(12, 20, 30),
        endsAt: dayAt(12, 23, 59),
        status: "UPCOMING",
        cover: { from: "#22c55e", to: "#84cc16" },
    },
];

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
    AVAILABLE: {
        canValidate: true,
        label: "Acceso abierto",
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
        label: "Bloqueado",
        message: "Validación bloqueada por el organizador",
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
