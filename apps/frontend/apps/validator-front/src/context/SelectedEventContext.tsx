import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ValidatorEvent } from "../types/validatorEvents";

interface SelectedEventContextValue {
    selectedEvent: ValidatorEvent | null;
    selectEvent: (event: ValidatorEvent) => void;
    clearEvent: () => void;
}

const SelectedEventContext = createContext<SelectedEventContextValue | null>(null);

/**
 * Estado local del evento seleccionado. Vive mientras el módulo esté montado:
 * no se persiste ni se sincroniza con ningún servicio.
 */
export function SelectedEventProvider({ children }: { children: ReactNode }) {
    const [selectedEvent, setSelectedEvent] = useState<ValidatorEvent | null>(null);

    const value = useMemo<SelectedEventContextValue>(
        () => ({
            selectedEvent,
            selectEvent: setSelectedEvent,
            clearEvent: () => setSelectedEvent(null),
        }),
        [selectedEvent],
    );

    return <SelectedEventContext value={value}>{children}</SelectedEventContext>;
}

export function useSelectedEvent(): SelectedEventContextValue {
    const context = useContext(SelectedEventContext);

    if (!context) {
        throw new Error("useSelectedEvent debe usarse dentro de <SelectedEventProvider>");
    }

    return context;
}
