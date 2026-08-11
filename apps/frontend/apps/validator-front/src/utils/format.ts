const LOCALE = "es-MX";

export function formatEventDate(iso: string): string {
    return new Date(iso).toLocaleDateString(LOCALE, {
        weekday: "short",
        day: "numeric",
        month: "long",
    });
}

export function formatEventTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatEventSchedule(startsAt: string, endsAt: string): string {
    return `${formatEventTime(startsAt)} — ${formatEventTime(endsAt)} h`;
}
