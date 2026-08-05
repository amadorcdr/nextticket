/**
 * Boletos simulados y lógica local de validación.
 * No se realizan solicitudes HTTP: todo se resuelve con este arreglo en memoria.
 */

export type ValidationOutcome = "VALID" | "USED" | "INVALID" | "NOT_FOUND";

export interface ValidatorTicket {
    folio: string;
    outcome: Exclude<ValidationOutcome, "NOT_FOUND">;
    attendeeName: string;
    ticketType: string;
    section: string;
    /** Hora simulada de uso, solo para boletos ya utilizados. */
    usedAt?: string;
    /** Motivo mostrado cuando el boleto es inválido. */
    reason?: string;
}

export const VALIDATOR_TICKETS: ValidatorTicket[] = [
    {
        folio: "VALIDO001",
        outcome: "VALID",
        attendeeName: "María Fernanda Ríos",
        ticketType: "General",
        section: "Sección A · Fila 12 · Asiento 8",
    },
    {
        folio: "VALIDO002",
        outcome: "VALID",
        attendeeName: "Diego Alcántara Nava",
        ticketType: "VIP",
        section: "Palco 3 · Asiento 4",
    },
    {
        folio: "USADO001",
        outcome: "USED",
        attendeeName: "Carlos Mendoza Ruiz",
        ticketType: "General",
        section: "Sección C · Fila 4 · Asiento 21",
        usedAt: "19:42",
    },
    {
        folio: "USADO002",
        outcome: "USED",
        attendeeName: "Ana Sofía Lara",
        ticketType: "Preferente",
        section: "Sección B · Fila 8 · Asiento 15",
        usedAt: "20:05",
    },
    {
        folio: "INVALIDO001",
        outcome: "INVALID",
        attendeeName: "—",
        ticketType: "—",
        section: "—",
        reason: "El boleto no pertenece a este evento.",
    },
    {
        folio: "INVALIDO002",
        outcome: "INVALID",
        attendeeName: "—",
        ticketType: "—",
        section: "—",
        reason: "El código escaneado no corresponde a un boleto emitido.",
    },
];

export interface ValidationResult {
    outcome: ValidationOutcome;
    folio: string;
    ticket?: ValidatorTicket;
    /** Método con el que se ejecutó la validación simulada. */
    method: "qr" | "folio";
}

/** Resuelve un folio contra los boletos mock. Cualquier folio desconocido no existe. */
export function validateFolio(folio: string, method: "qr" | "folio" = "folio"): ValidationResult {
    const normalized = folio.trim().toUpperCase();
    const ticket = VALIDATOR_TICKETS.find((item) => item.folio === normalized);

    if (!ticket) {
        return { outcome: "NOT_FOUND", folio: normalized, method };
    }

    return { outcome: ticket.outcome, folio: ticket.folio, ticket, method };
}

/** Folios usados por el lector QR simulado, según el resultado que se quiere demostrar. */
export const QR_SIMULATION_OPTIONS: {
    id: "valid" | "used" | "invalid";
    label: string;
    folio: string;
}[] = [
    { id: "valid", label: "Boleto válido", folio: "VALIDO002" },
    { id: "used", label: "Boleto ya utilizado", folio: "USADO002" },
    { id: "invalid", label: "Boleto inválido", folio: "INVALIDO002" },
];
