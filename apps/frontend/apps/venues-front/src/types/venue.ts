import type { ReactNode } from "react";

export type VenueStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE" | "REMOVED";

export interface Venue {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    total_capacity: number;
    createdAt?: string;
    status: VenueStatus;
    description?: string;
    images: ReactNode[];
}

type ChipColor = "default" | "success" | "warning" | "danger" | "accent";

export const VENUE_STATUS_OPTIONS: { id: VenueStatus; label: string; color: ChipColor }[] = [
    { id: "DRAFT", label: "Borrador", color: "accent" },
    { id: "ACTIVE", label: "Activo", color: "success" },
    { id: "INACTIVE", label: "Inactivo", color: "default" },
    { id: "UNDER_MAINTENANCE", label: "Mantenimiento", color: "warning" },
    { id: "REMOVED", label: "Eliminado", color: "danger" },
];
