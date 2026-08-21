/**
 * "soon" no tiene equivalente real en venues-events-service (todo evento
 * PUBLISHED se muestra igual, esté cerca o lejos su fecha): solo existen
 * "available" (PUBLISHED), "sold-out" (SOLD_OUT) y "canceled" (CANCELED).
 * El catálogo nunca lista eventos CANCELED, pero la vista de detalle sí
 * puede recibir uno si alguien entra por URL directa a un evento viejo.
 */
export type ClientEventStatus = "available" | "sold-out" | "canceled";

/**
 * Evento tal como lo ve un cliente en el catálogo. Los nombres de los
 * campos siguen al modelo Event del backend (venues-events-service); ver
 * `toClientEvent` en ../api.ts para el mapeo real.
 */
export interface ClientEvent {
    id: string;
    title: string;
    category: string;
    venue: string;
    city: string;
    date: string;
    time: string;
    imageUrl: string;
    description: string;
    status: ClientEventStatus;
    minPrice: number;
    currency: string;
    availableSeats: number;
    totalSeats: number;
}

/**
 * Zona tal como se muestra en el detalle del evento y en la selección de
 * asientos. No existe un campo "descripción" en EventZone del backend: la
 * describe `describeZone` en ../api.ts a partir de admissionType/capacidad.
 */
export interface ClientEventZone {
    id: string;
    name: string;
    description: string;
    price: number;
    admissionType: "RESERVED" | "GENERAL";
    availableCapacity: number;
    maxTicketsPerPurchase: number;
    /**
     * Una zona puede agrupar varias secciones físicas del recinto (p. ej.
     * "VIP Izquierda" + "VIP Derecha"): cada una numera sus filas/asientos
     * de forma independiente, así que dos secciones pueden compartir fila y
     * número. Este mapa deja distinguirlas al agrupar la selección de asientos.
     */
    sectionNameById: Record<string, string>;
    /** Ids de sección física que forman esta zona — para pintar el mapa de asientos. */
    sectionIds: string[];
    mapColor: string | null;
    status: "ACTIVE" | "INACTIVE" | "SOLD_OUT";
}

export interface ClientEventDetail extends ClientEvent {
    zones: ClientEventZone[];
    venueInfo: {
        name: string;
        address: string;
        city: string;
        totalCapacity: number;
    };
}
