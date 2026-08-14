export type AdminEventStatus = "proximo" | "activo" | "finalizado" | "cancelado" | "borrador";

export interface AdminEvent {
    id: string;
    title: string;
    imageUrl: string;
    category: string;
    date: string;
    time: string;
    venue: string;
    status: AdminEventStatus;
    ticketsSold: number;
    totalSeats: number;
}
