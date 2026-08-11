import {
    createContext,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";

export interface CartSeat {
    id: string;
    row: string;
    number: number;
    zone: string;
    price: number;
}

export interface CartEvent {
    id: string;
    title: string;
    venue: string;
    city: string;
    date: string;
    time: string;
    imageUrl: string;
}

interface CartContextValue {
    event: CartEvent | null;
    seats: CartSeat[];
    subtotal: number;
    serviceFee: number;
    total: number;
    setEvent: (event: CartEvent) => void;
    toggleSeat: (seat: CartSeat) => void;
    isSelected: (seatId: string) => boolean;
    clear: () => void;
}

/** Cargo por servicio de la compra simulada. */
const SERVICE_FEE_RATE = 0.08;

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Carrito del cliente: vive entre el detalle del evento, la selección de
 * asientos y el checkout. Es estado en memoria, igual que el resto del
 * flujo simulado; al recargar la página se vacía.
 *
 * Vive en commons porque lo comparten events-front y purchases-front, y así
 * ningún microfrontend depende de otro.
 */
export function CartProvider({ children }: { children: ReactNode }) {
    const [event, setEventState] = useState<CartEvent | null>(null);
    const [seats, setSeats] = useState<CartSeat[]>([]);

    const value = useMemo<CartContextValue>(() => {
        const subtotal = seats.reduce((sum, seat) => sum + seat.price, 0);
        const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);

        return {
            event,
            seats,
            subtotal,
            serviceFee,
            total: subtotal + serviceFee,
            setEvent: (nextEvent: CartEvent) => {
                // Cambiar de evento vacía los asientos: son de otro mapa.
                if (event && event.id !== nextEvent.id) {
                    setSeats([]);
                }
                setEventState(nextEvent);
            },
            toggleSeat: (seat: CartSeat) => {
                setSeats((current) =>
                    current.some((item) => item.id === seat.id)
                        ? current.filter((item) => item.id !== seat.id)
                        : [...current, seat],
                );
            },
            isSelected: (seatId: string) =>
                seats.some((seat) => seat.id === seatId),
            clear: () => {
                setSeats([]);
                setEventState(null);
            },
        };
    }, [event, seats]);

    return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartContextValue {
    const context = useContext(CartContext);

    if (!context) {
        throw new Error("useCart debe usarse dentro de <CartProvider>");
    }

    return context;
}
