import type { ClientEvent } from "../types/client";
import { CLIENT_EVENTS } from "./clientEvents";

export interface EventZone {
    id: string;
    name: string;
    description: string;
    price: number;
}

export interface EventVenueInfo {
    name: string;
    address: string;
    area: string;
    access: string;
}

export interface EventDetailData extends ClientEvent {
    about: string;
    highlights: string[];
    zones: EventZone[];
    venueInfo: EventVenueInfo;
}

/**
 * El detalle añade lo que el catálogo no trae. Cuando se conecte la API,
 * esto sale de GET /events/:id, que ya devuelve venue y zones con precios.
 */
const DETAIL_EXTRAS: Pick<
    EventDetailData,
    "about" | "highlights" | "zones" | "venueInfo"
> = {
    about:
        "Una producción pensada para vivirse de principio a fin: apertura de puertas dos horas antes, zona de food trucks y guardarropa disponible. El acceso es con boleto digital, directo desde tu celular.",
    highlights: [
        "Apertura de puertas 2 horas antes",
        "Zona de alimentos y bebidas",
        "Acceso con boleto digital",
        "Estacionamiento con costo",
    ],
    zones: [
        {
            id: "vip",
            name: "VIP Experience",
            description: "Filas 1 a 5, acceso prioritario",
            price: 2500,
        },
        {
            id: "preferente",
            name: "Preferente",
            description: "Zona central, nivel bajo",
            price: 1600,
        },
        {
            id: "general",
            name: "General A",
            description: "Frente al escenario",
            price: 850,
        },
    ],
    venueInfo: {
        name: "",
        address: "Calzada de Tlalpan 3465, Coyoacán",
        area: "Zona sur de la ciudad",
        access: "Metro y Metrobús a 5 minutos caminando",
    },
};

export function getEventDetail(eventId: string): EventDetailData | undefined {
    const event = CLIENT_EVENTS.find((item) => item.id === eventId);

    if (!event) return undefined;

    return {
        ...event,
        ...DETAIL_EXTRAS,
        venueInfo: { ...DETAIL_EXTRAS.venueInfo, name: event.venue },
    };
}
