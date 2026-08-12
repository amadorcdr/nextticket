export interface EventSalesSummary {
    eventId: string;
    eventName: string;
    date: string;
    venue: string;
    totalTickets: number;
    sold: number;
    used: number;
    pending: number;
    available: number;
    canceled: number;
    revenue: number;
    occupancyPct: number;
}

export type PurchaseStatus = "completada" | "pendiente" | "cancelada";

export interface Purchase {
    folio: string;
    buyer: string;
    quantity: number;
    total: number;
    purchaseDate: string;
    status: PurchaseStatus;
}

export interface ZoneSales {
    zone: string;
    capacity: number;
    sold: number;
    available: number;
    revenue: number;
}
