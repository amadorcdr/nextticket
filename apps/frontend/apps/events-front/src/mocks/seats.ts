import type { CartSeat } from "@nextticket-frontend/commons";

export type SeatAvailability = "available" | "occupied";

export interface MapSeat extends CartSeat {
    availability: SeatAvailability;
}

const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const COLUMNS = 16;

/** Asientos ya vendidos en el mock, para que el mapa no se vea vacío. */
const OCCUPIED = new Set([
    "A3", "A4", "B6", "C8", "D10", "E5", "F7", "G9", "H4", "I6", "J11",
    "A12", "B13", "C2", "D5", "F14", "G3", "H15", "I9", "J7",
]);

/*
 * Las primeras filas son la zona cara y las de atrás la general, igual que
 * en el diseño anterior. Los precios coinciden con las zonas del detalle.
 */
function zoneFor(rowIndex: number) {
    if (rowIndex < 2) return { zone: "VIP Experience", price: 2500 };
    if (rowIndex < 6) return { zone: "Preferente", price: 1600 };
    return { zone: "General A", price: 850 };
}

export function buildSeatMap(): MapSeat[] {
    return ROWS.flatMap((row, rowIndex) =>
        Array.from({ length: COLUMNS }, (_, index) => {
            const number = index + 1;
            const id = `${row}${number}`;
            const { zone, price } = zoneFor(rowIndex);

            return {
                id,
                row,
                number,
                zone,
                price,
                availability: OCCUPIED.has(id) ? "occupied" : "available",
            } satisfies MapSeat;
        }),
    );
}

export const SEAT_ROWS = ROWS;
export const SEAT_COLUMNS = COLUMNS;
