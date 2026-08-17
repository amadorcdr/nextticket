import type { useApi } from "@nextticket-frontend/commons";
import type { ValidatorEvent, ValidatorEventStatus } from "./types/validatorEvents";
import type { ValidationOutcome, ValidationResult, ValidatorTicket } from "./types/validatorTickets";

type Api = ReturnType<typeof useApi>;

/** Forma real de EventStatus en venues-events-service. */
export type ApiEventStatus = "DRAFT" | "PUBLISHED" | "CANCELED" | "SOLD_OUT" | "COMPLETED";

export interface ApiEventZone {
    id: string;
    publicName?: string;
}

export interface ApiEventVenue {
    id?: string;
    name: string;
    address?: string;
    city?: string;
}

/** Forma real de GET /events (venues-events-service). */
export interface ApiEvent {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    imageUrl?: string | null;
    status: ApiEventStatus;
    venue: ApiEventVenue;
    zones: ApiEventZone[];
}

/** Forma genérica de una respuesta paginada del gateway ({data, meta}). */
export interface Paginated<T> {
    data: T[];
    meta?: {
        total?: number;
        page?: number;
        limit?: number;
        hasNextPage?: boolean;
    };
}

const FALLBACK_IMAGE_URL =
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop";

/** Paleta fija: solo decora la card mientras carga/si falla la imagen, no viene del backend. */
const COVER_GRADIENTS: { from: string; to: string }[] = [
    { from: "#7c3aed", to: "#db2777" },
    { from: "#0ea5e9", to: "#14b8a6" },
    { from: "#f59e0b", to: "#ef4444" },
    { from: "#6366f1", to: "#22d3ee" },
    { from: "#8b5cf6", to: "#3b82f6" },
    { from: "#f97316", to: "#facc15" },
    { from: "#10b981", to: "#0ea5e9" },
    { from: "#ec4899", to: "#6366f1" },
];

function coverForEvent(eventId: string): { from: string; to: string } {
    let hash = 0;
    for (let i = 0; i < eventId.length; i += 1) {
        hash = (hash * 31 + eventId.charCodeAt(i)) >>> 0;
    }
    return COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
}

/**
 * venues-events-service no expone un estado "en curso": se deriva del
 * status real y de la ventana startsAt/endsAt. CANCELED bloquea sin
 * importar la hora; COMPLETED (o haber pasado endsAt) cierra el evento.
 */
function deriveValidatorStatus(event: ApiEvent, now: Date): ValidatorEventStatus {
    if (event.status === "CANCELED") return "BLOCKED";
    if (event.status === "COMPLETED") return "FINISHED";

    const starts = new Date(event.startsAt);
    const ends = new Date(event.endsAt);

    if (now > ends) return "FINISHED";
    if (now >= starts) return "IN_PROGRESS";
    return "UPCOMING";
}

export function toValidatorEvent(event: ApiEvent, now: Date = new Date()): ValidatorEvent {
    return {
        id: event.id,
        name: event.name,
        venue: event.venue?.name ?? "Recinto sin asignar",
        address: event.venue?.address ?? "",
        city: event.venue?.city ?? "",
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: deriveValidatorStatus(event, now),
        imageUrl: event.imageUrl || FALLBACK_IMAGE_URL,
        cover: coverForEvent(event.id),
        zones: event.zones.map((zone) => ({ id: zone.id, name: zone.publicName ?? "General" })),
    };
}

/** Forma real de TicketStatus en tickets-service. */
export type ApiTicketStatus = "ISSUED" | "USED" | "CANCELED" | "EXPIRED";

export interface ApiTicket {
    id: string;
    folio: string;
    status: ApiTicketStatus;
    eventZoneId: string;
    eventSeatId: string | null;
}

export interface ApiValidation {
    id: string;
    result: number;
    rejectionReason: string | null;
    validatedAt: string;
}

/** Forma real de la respuesta de POST /tickets/validations. */
export type ApiValidateResponse =
    | { success: false; result: 0; rejectionReason: string; validatedAt: string }
    | { success: boolean; ticket: ApiTicket; validation: ApiValidation };

const USED_REASON = "Ticket has already been used";
const OTHER_EVENT_REASON = "Ticket does not belong to the selected event";

function humanizeRejectionReason(reason: string): string {
    if (reason === OTHER_EVENT_REASON) return "El boleto no pertenece a este evento.";
    if (reason.startsWith("Ticket status is CANCELED")) return "El boleto fue cancelado.";
    if (reason.startsWith("Ticket status is EXPIRED")) return "El boleto expiró.";
    if (reason === "Ticket was already validated successfully") return "Este boleto ya fue validado.";
    return "El boleto no es válido para este evento.";
}

/** Best-effort: busca la hora de la validación aceptada original para mostrarla en "ya utilizado". */
async function findAcceptedValidationTime(api: Api, ticketId: string): Promise<string | undefined> {
    try {
        const history = await api.get<ApiValidation[]>(`/tickets/validations/ticket/${ticketId}`);
        const accepted = history.find((item) => item.result === 1);
        if (!accepted) return undefined;
        return new Date(accepted.validatedAt).toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return undefined;
    }
}

function describeTicket(ticket: ApiTicket, event: ValidatorEvent): { ticketType: string; section: string } {
    const zone = event.zones.find((z) => z.id === ticket.eventZoneId);
    const ticketType = zone?.name ?? "General";
    const section = ticket.eventSeatId ? `${ticketType} · Asiento asignado` : ticketType;
    return { ticketType, section };
}

/** Traduce la respuesta cruda de POST /tickets/validations a lo que consume la UI. */
export async function toValidationResult(
    response: ApiValidateResponse,
    requestedFolio: string,
    method: "qr" | "folio",
    event: ValidatorEvent,
    api: Api,
): Promise<ValidationResult> {
    if (!("ticket" in response)) {
        return { outcome: "NOT_FOUND", folio: requestedFolio, method };
    }

    const { ticket, validation } = response;
    const { ticketType, section } = describeTicket(ticket, event);

    if (response.success) {
        return {
            outcome: "VALID",
            folio: ticket.folio,
            method,
            ticket: { folio: ticket.folio, outcome: "VALID", ticketType, section },
        };
    }

    const reason = validation?.rejectionReason ?? "";

    if (reason === USED_REASON) {
        const usedAt = await findAcceptedValidationTime(api, ticket.id);
        return {
            outcome: "USED",
            folio: ticket.folio,
            method,
            ticket: { folio: ticket.folio, outcome: "USED", ticketType, section, usedAt },
        };
    }

    const outcome: ValidationOutcome = "INVALID";
    const ticketDetail: ValidatorTicket = {
        folio: ticket.folio,
        outcome,
        ticketType,
        section,
        reason: humanizeRejectionReason(reason),
    };

    return { outcome, folio: ticket.folio, method, ticket: ticketDetail };
}

/** Ejecuta la validación real contra tickets-service para el evento seleccionado. */
export async function validateTicket(
    api: Api,
    event: ValidatorEvent,
    payload: { folio?: string; qrHash?: string },
    method: "qr" | "folio",
): Promise<ValidationResult> {
    const response = await api.post<ApiValidateResponse>("/tickets/validations", {
        eventId: event.id,
        ...payload,
    });

    return toValidationResult(response, payload.folio ?? payload.qrHash ?? "", method, event, api);
}
