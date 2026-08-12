import type { EventSalesSummary, Purchase, ZoneSales } from "../types/adminTickets";

function summary(input: Omit<EventSalesSummary, "occupancyPct">): EventSalesSummary {
    const occupancyPct = input.totalTickets > 0 ? Math.round((input.sold / input.totalTickets) * 100) : 0;
    return { ...input, occupancyPct };
}

export const EVENT_SALES_SUMMARIES: EventSalesSummary[] = [
    summary({
        eventId: "neon-genesis-live-tour",
        eventName: "Neon Genesis Live Tour",
        date: "15 Oct, 2026",
        venue: "Arena Digital",
        totalTickets: 1200,
        sold: 850,
        used: 400,
        pending: 450,
        available: 350,
        canceled: 0,
        revenue: 722500,
    }),
    summary({
        eventId: "midnight-jazz-collective",
        eventName: "Midnight Jazz Collective",
        date: "02 Sep, 2026",
        venue: "The Blue Note Venue",
        totalTickets: 500,
        sold: 320,
        used: 150,
        pending: 170,
        available: 180,
        canceled: 0,
        revenue: 198400,
    }),
    summary({
        eventId: "final-cup-2026",
        eventName: "Final Cup 2026",
        date: "12 Nov, 2026",
        venue: "Estadio Nacional",
        totalTickets: 3000,
        sold: 2180,
        used: 2000,
        pending: 180,
        available: 820,
        canceled: 0,
        revenue: 981000,
    }),
    summary({
        eventId: "stand-up-night",
        eventName: "Stand Up Night: Sin Filtro",
        date: "28 Sep, 2026",
        venue: "Teatro Metropólitan",
        totalTickets: 800,
        sold: 590,
        used: 300,
        pending: 290,
        available: 210,
        canceled: 0,
        revenue: 224200,
    }),
    summary({
        eventId: "tech-summit-2026",
        eventName: "Tech Summit 2026",
        date: "20 Ago, 2026",
        venue: "Convention Center X",
        totalTickets: 900,
        sold: 900,
        used: 900,
        pending: 0,
        available: 0,
        canceled: 0,
        revenue: 1080000,
    }),
    summary({
        eventId: "maraton-monterrey",
        eventName: "Maratón Monterrey",
        date: "08 Dic, 2026",
        venue: "Parque Fundidora",
        totalTickets: 5000,
        sold: 3500,
        used: 3500,
        pending: 0,
        available: 1500,
        canceled: 0,
        revenue: 1050000,
    }),
    summary({
        eventId: "clasico-de-otono",
        eventName: "Clásico de Otoño",
        date: "05 Oct, 2026",
        venue: "Auditorio Nacional",
        totalTickets: 2400,
        sold: 0,
        used: 0,
        pending: 0,
        available: 2400,
        canceled: 0,
        revenue: 0,
    }),
    summary({
        eventId: "electronic-sunset",
        eventName: "Electronic Sunset",
        date: "22 Nov, 2026",
        venue: "Foro Sol",
        totalTickets: 65000,
        sold: 4200,
        used: 0,
        pending: 0,
        available: 60800,
        canceled: 4200,
        revenue: 0,
    }),
];

export const RECENT_PURCHASES: Record<string, Purchase[]> = {
    "neon-genesis-live-tour": [
        { folio: "TK-NG0021", buyer: "María López", quantity: 4, total: 3400, purchaseDate: "10 Ago, 2026", status: "completada" },
        { folio: "TK-NG0022", buyer: "Jorge Hernández", quantity: 2, total: 1700, purchaseDate: "11 Ago, 2026", status: "completada" },
        { folio: "TK-NG0023", buyer: "Ana Martínez", quantity: 1, total: 850, purchaseDate: "12 Ago, 2026", status: "pendiente" },
        { folio: "TK-NG0024", buyer: "Diego Torres", quantity: 3, total: 2550, purchaseDate: "13 Ago, 2026", status: "completada" },
    ],
    "final-cup-2026": [
        { folio: "TK-FC0101", buyer: "Roberto Sánchez", quantity: 6, total: 2700, purchaseDate: "01 Sep, 2026", status: "completada" },
        { folio: "TK-FC0102", buyer: "Camila Vega", quantity: 2, total: 900, purchaseDate: "03 Sep, 2026", status: "completada" },
        { folio: "TK-FC0103", buyer: "Andrés Morales", quantity: 4, total: 1800, purchaseDate: "05 Sep, 2026", status: "cancelada" },
    ],
    "stand-up-night": [
        { folio: "TK-SU0301", buyer: "Paola Jiménez", quantity: 2, total: 760, purchaseDate: "20 Ago, 2026", status: "completada" },
        { folio: "TK-SU0302", buyer: "Ricardo Ortiz", quantity: 1, total: 380, purchaseDate: "21 Ago, 2026", status: "pendiente" },
    ],
    "tech-summit-2026": [
        { folio: "TK-TS0501", buyer: "Isabel Navarro", quantity: 1, total: 1200, purchaseDate: "01 Ago, 2026", status: "completada" },
        { folio: "TK-TS0502", buyer: "Emilio Reyes", quantity: 2, total: 2400, purchaseDate: "03 Ago, 2026", status: "completada" },
        { folio: "TK-TS0503", buyer: "Daniela Cruz", quantity: 1, total: 1200, purchaseDate: "05 Ago, 2026", status: "completada" },
    ],
};

export const ZONE_DISTRIBUTION: Record<string, ZoneSales[]> = {
    "neon-genesis-live-tour": [
        { zone: "General", capacity: 700, sold: 520, available: 180, revenue: 442000 },
        { zone: "VIP Premium", capacity: 300, sold: 250, available: 50, revenue: 250000 },
        { zone: "Palcos", capacity: 200, sold: 80, available: 120, revenue: 30500 },
    ],
    "final-cup-2026": [
        { zone: "General", capacity: 2200, sold: 1650, available: 550, revenue: 495000 },
        { zone: "Platea", capacity: 500, sold: 400, available: 100, revenue: 320000 },
        { zone: "Palcos", capacity: 300, sold: 130, available: 170, revenue: 166000 },
    ],
    "stand-up-night": [
        { zone: "General", capacity: 600, sold: 450, available: 150, revenue: 171000 },
        { zone: "VIP Premium", capacity: 200, sold: 140, available: 60, revenue: 53200 },
    ],
    "tech-summit-2026": [
        { zone: "General", capacity: 900, sold: 900, available: 0, revenue: 1080000 },
    ],
};
