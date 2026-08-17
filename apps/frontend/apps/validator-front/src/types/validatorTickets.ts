/**
 * Tipos del resultado de validación. La resolución real ocurre en
 * ../api.ts contra POST /tickets/validations (tickets-service); este
 * archivo solo define la forma que consumen los componentes de UI.
 */

export type ValidationOutcome = "VALID" | "USED" | "INVALID" | "NOT_FOUND";

export interface ValidatorTicket {
    folio: string;
    outcome: Exclude<ValidationOutcome, "NOT_FOUND">;
    /** Nombre público de la zona/admisión del boleto (p. ej. "General", "VIP"). */
    ticketType: string;
    /** Zona y, si aplica, fila/asiento asignado. */
    section: string;
    /** Hora de uso, solo cuando el boleto ya estaba validado antes. */
    usedAt?: string;
    /** Motivo mostrado cuando el boleto es inválido. */
    reason?: string;
}

export interface ValidationResult {
    outcome: ValidationOutcome;
    folio: string;
    ticket?: ValidatorTicket;
    /** Método con el que se ejecutó la validación. */
    method: "qr" | "folio";
}
