import type { HoloCardDisplayData } from "../components/HoloCard/HoloCard";

/** Forma real de GET /tickets/user/:userId (tickets-service). No trae qrCode: se oculta siempre en listados. */
export type ApiTicketStatus = "ISSUED" | "USED" | "CANCELED" | "EXPIRED";

export interface ApiTicket {
    id: string;
    folio: string;
    status: ApiTicketStatus;
    originType: "PURCHASE" | "COMPLIMENTARY" | "STAFF" | "TRANSFER";
    purchaseId: string | null;
    purchaseDetailId: string | null;
    eventZoneId: string;
    eventSeatId: string | null;
    issuedAt: string;
}

/** Solo lo que necesitamos de GET /purchases/:id para resolver el eventId del ticket. */
export interface ApiPurchaseMinimal {
    id: string;
    eventId: string;
}

/** Solo lo que necesitamos de GET /events/:eventId para enriquecer la tarjeta. */
export interface ApiEventMinimal {
    id: string;
    name: string;
    startsAt: string;
    venue: {
        name: string;
        address?: string;
        city?: string;
        state?: string;
        country?: string;
    };
    zones: Array<{ id: string; publicName?: string }>;
}

/** Solo lo que necesitamos de GET /events/:eventId/seats/by-event-seat-ids. */
export interface ApiEventSeatMinimal {
    id: string;
    eventZoneId: string;
    seat: { row: string; number: string; type: string };
}

export interface EnrichedTicket {
    ticket: ApiTicket;
    eventName: string;
    eventDateTime: string;
    venueName: string;
    venueAddress: string;
    venueCity: string;
    venueState: string;
    venueCountry: string;
    zoneName: string;
    row: string | null;
    seatNumber: string | null;
    seatType: string | null;
}

/** "17/07/2026 • 20:00 hrs", igual formato que ya usaba la maqueta. */
export function formatEventDateTime(iso: string): string {
    const date = new Date(iso);
    const day = date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
    const time = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${day} • ${time} hrs`;
}

/**
 * Piso/sección física no se resolvieron (harían falta endpoints de
 * venues-events-service fuera del alcance de esta pantalla): floorName se
 * deja vacío (la tarjeta ya muestra "—") en vez de inventar un valor.
 */
export function toHoloCardData(enriched: EnrichedTicket, qrImageUrl?: string): HoloCardDisplayData {
    const { ticket } = enriched;

    return {
        eventName: enriched.eventName,
        eventDateTime: enriched.eventDateTime,
        sectionPrefix: enriched.zoneName,
        row: enriched.row ?? undefined,
        seat: enriched.seatNumber ?? undefined,
        seatType: enriched.seatType ?? "GENERAL",
        venueName: enriched.venueName,
        venueAddress: enriched.venueAddress,
        venueCity: enriched.venueCity,
        venueState: enriched.venueState,
        venueCountry: enriched.venueCountry,
        folio: ticket.folio,
        status: ticket.status,
        badge: ticket.status,
        qrImageUrl,
    };
}
