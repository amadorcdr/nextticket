export type ClientEventStatus = "available" | "soon" | "sold-out";

/**
 * Evento tal como lo ve un cliente en el catálogo.
 * Los nombres de los campos siguen al modelo Event del backend
 * (venues-events-service) para que conectar la API despues sea directo.
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
