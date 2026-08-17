/**
 * "soon" no tiene equivalente real en venues-events-service (todo evento
 * PUBLISHED se muestra igual, esté cerca o lejos su fecha): solo existen
 * "available" (PUBLISHED) y "sold-out" (SOLD_OUT).
 */
export type ClientEventStatus = "available" | "sold-out";

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
