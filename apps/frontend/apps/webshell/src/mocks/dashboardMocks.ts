export interface DashboardMetrics {
    totalEvents: number;
    activeEvents: number;
    upcomingEvents: number;
    totalUsers: number;
    ticketsSold: number;
    simulatedRevenue: number;
    recentPurchasesCount: number;
}

export const DASHBOARD_METRICS: DashboardMetrics = {
    totalEvents: 24,
    activeEvents: 9,
    upcomingEvents: 6,
    totalUsers: 1284,
    ticketsSold: 18560,
    simulatedRevenue: 3420500,
    recentPurchasesCount: 37,
};

export type UpcomingEventStatus = "proximo" | "activo" | "finalizado" | "cancelado" | "borrador";

export interface UpcomingEventSummary {
    id: string;
    name: string;
    date: string;
    venue: string;
    status: UpcomingEventStatus;
    ticketsSold: number;
    totalSeats: number;
}

export const UPCOMING_EVENTS: UpcomingEventSummary[] = [
    { id: "neon-genesis-live-tour", name: "Neon Genesis Live Tour", date: "15 Oct, 2026", venue: "Arena Digital", status: "proximo", ticketsSold: 850, totalSeats: 1200 },
    { id: "midnight-jazz-collective", name: "Midnight Jazz Collective", date: "02 Sep, 2026", venue: "The Blue Note Venue", status: "proximo", ticketsSold: 320, totalSeats: 500 },
    { id: "final-cup-2026", name: "Final Cup 2026", date: "12 Nov, 2026", venue: "Estadio Nacional", status: "activo", ticketsSold: 2180, totalSeats: 3000 },
    { id: "stand-up-night", name: "Stand Up Night: Sin Filtro", date: "28 Sep, 2026", venue: "Teatro Metropólitan", status: "activo", ticketsSold: 590, totalSeats: 800 },
    { id: "clasico-de-otono", name: "Clásico de Otoño", date: "05 Oct, 2026", venue: "Auditorio Nacional", status: "borrador", ticketsSold: 0, totalSeats: 2400 },
];

export type ActivityType = "compra" | "evento_creado" | "usuario_registrado" | "evento_actualizado";

export interface RecentActivityItem {
    id: string;
    type: ActivityType;
    description: string;
    date: string;
}

export const RECENT_ACTIVITY: RecentActivityItem[] = [
    { id: "act-1", type: "compra", description: "María López compró 4 boletos para Neon Genesis Live Tour", date: "Hace 12 min" },
    { id: "act-2", type: "usuario_registrado", description: "Nuevo organizador registrado: Producciones Aurora", date: "Hace 48 min" },
    { id: "act-3", type: "evento_actualizado", description: "Se actualizó el horario de Midnight Jazz Collective", date: "Hace 2 h" },
    { id: "act-4", type: "evento_creado", description: "Se creó el evento Final Cup 2026", date: "Hace 5 h" },
    { id: "act-5", type: "compra", description: "Jorge Hernández compró 2 boletos para Stand Up Night", date: "Hace 6 h" },
    { id: "act-6", type: "usuario_registrado", description: "Nuevo cliente registrado: ana.martinez@mail.com", date: "Hace 1 día" },
];

export interface SalesByEvent {
    label: string;
    projected: number;
    revenue: number;
}

export const SALES_BY_EVENT: SalesByEvent[] = [
    { label: "Neon Genesis Live Tour", projected: 75, revenue: 71 },
    { label: "Final Cup 2026", projected: 90, revenue: 73 },
    { label: "Stand Up Night: Sin Filtro", projected: 65, revenue: 74 },
    { label: "Midnight Jazz Collective", projected: 55, revenue: 64 },
    { label: "Electronic Sunset", projected: 40, revenue: 6 },
];
