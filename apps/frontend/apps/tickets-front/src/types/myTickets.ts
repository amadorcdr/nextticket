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
    venueId: string;
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
    sectionId: string;
    seat: { row: string; number: string; type: string };
}

/** Solo lo que necesitamos de GET /venues/:venueId, para resolver el piso de una sección. */
export interface ApiVenueFloorsMinimal {
    floors: Array<{ id: string; name: string; sections: Array<{ id: string }> }>;
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
    floorName: string | null;
    row: string | null;
    seatNumber: string | null;
    seatType: string | null;
}

/** Mismo status real del backend, en español, para mostrar en la tarjeta. */
const TICKET_STATUS_LABEL: Record<ApiTicketStatus, string> = {
    ISSUED: "Emitido",
    USED: "Usado",
    CANCELED: "Cancelado",
    EXPIRED: "Expirado",
};

/** "17/07/2026 • 20:00 hrs", igual formato que ya usaba la maqueta. */
export function formatEventDateTime(iso: string): string {
    const date = new Date(iso);
    const day = date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
    const time = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${day} • ${time} hrs`;
}

export function toHoloCardData(enriched: EnrichedTicket, qrImageUrl?: string): HoloCardDisplayData {
    const { ticket } = enriched;

    return {
        eventName: enriched.eventName,
        eventDateTime: enriched.eventDateTime,
        floorName: enriched.floorName ?? undefined,
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
        badge: TICKET_STATUS_LABEL[ticket.status],
        qrImageUrl,
    };
}
