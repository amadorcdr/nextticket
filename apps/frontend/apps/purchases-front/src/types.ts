/** Formas reales de purchases-service (POST/GET /purchases). Decimales llegan como string. */

export type ApiPurchaseStatus = "PENDING" | "CONFIRMED" | "CANCELED" | "REFUNDED";

export interface ApiPurchaseDetail {
    id: string;
    eventZoneId: string;
    eventSeatId: string | null;
    unitPrice: string;
    discountAmount: string;
    finalPrice: string;
    taxAmount: string;
    quantity: number;
    subtotal: string;
}

export interface ApiPurchasePayment {
    id: string;
    paymentMethod: string;
    status: string;
    amount: string;
}

export interface ApiPurchaseTicket {
    id: string;
    folio: string;
    qrCode?: string;
    status: "ISSUED";
    eventSeatId: string | null;
    eventZoneId: string;
    currentHolderId: string;
}

/** GET /purchases/:id y GET /purchases (listado): sin tickets ni paymentResult. */
export interface ApiPurchaseSummary {
    id: string;
    userId: string;
    eventId: string;
    folio: string | number | null;
    status: ApiPurchaseStatus;
    grossSubtotal: string;
    discountAmount: string;
    netSubtotal: string;
    taxAmount: string;
    total: string;
    createdAt: string;
    details: ApiPurchaseDetail[];
    payments: ApiPurchasePayment[];
}

/** POST /purchases: la única respuesta que trae tickets y el resultado del pago simulado. */
export interface ApiPurchaseResult extends ApiPurchaseSummary {
    tickets: ApiPurchaseTicket[];
    paymentResult: { approved: boolean; status: string; message: string };
}
