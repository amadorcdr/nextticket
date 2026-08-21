import type { PhysicalVenueState } from "@nextticket-frontend/commons";
import type { Venue, VenueFormValues, VenueStatus } from "./types/venue";

/** Forma real que devuelve GET /venues (listado paginado) del venues-events-service. */
export interface ApiVenueListItem {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string | null;
    country: string;
    totalCapacity: number;
    description: string | null;
    status: VenueStatus;
    createdAt: string;
    updatedAt: string;
    _count: { floors: number; sections: number };
}

/** Forma real que devuelve POST/PATCH/GET /venues/:id (árbol completo). */
export interface ApiVenueDetail {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string | null;
    country: string;
    totalCapacity: number;
    description: string | null;
    status: VenueStatus;
    createdAt: string;
    updatedAt: string;
    floors: { id: string; sections: unknown[] }[];
}

export function toVenue(v: ApiVenueListItem): Venue {
    return {
        id: v.id,
        name: v.name,
        address: v.address,
        city: v.city,
        state: v.state ?? "",
        total_capacity: v.totalCapacity,
        createdAt: v.createdAt,
        status: v.status,
        description: v.description ?? undefined,
        floorsCount: v._count.floors,
        sectionsCount: v._count.sections,
    };
}

export function toVenueFromDetail(v: ApiVenueDetail): Venue {
    return {
        id: v.id,
        name: v.name,
        address: v.address,
        city: v.city,
        state: v.state ?? "",
        total_capacity: v.totalCapacity,
        createdAt: v.createdAt,
        status: v.status,
        description: v.description ?? undefined,
        floorsCount: v.floors.length,
        sectionsCount: v.floors.reduce((acc, f) => acc + f.sections.length, 0),
    };
}

// ── Árbol completo del recinto (GET /venues/:id) para el editor de canvas ──

export interface ApiGeometryPoint {
    id?: string;
    pointIndex: number;
    x: number;
    y: number;
    controlX: number | null;
    controlY: number | null;
    borderRadius: number;
}

export interface ApiSeat {
    id: string;
    sectionId: string;
    row: string;
    number: string;
    type: "STANDARD" | "VIP" | "PREMIUM" | "ACCESSIBLE";
    coordinateX: number | null;
    coordinateY: number | null;
    status: "AVAILABLE" | "UNAVAILABLE" | "OUT_OF_SERVICE" | "REMOVED";
}

export interface ApiSection {
    id: string;
    venueId: string;
    floorId: string;
    name: string;
    description: string | null;
    capacity: number;
    status: "ACTIVE" | "INACTIVE" | "REMOVED";
    color: string | null;
    prefix: string | null;
    coordinateX: number | null;
    coordinateY: number | null;
    width: number | null;
    height: number | null;
    /** Prisma Decimal viaja como string en el JSON. */
    rotationDegrees: string | number;
    isEllipse: boolean;
    geometryPoints: ApiGeometryPoint[] | null;
    seats: ApiSeat[];
}

export interface ApiCanvasElement {
    id: string;
    floorId: string;
    elementType: "STAGE" | "SCREEN" | "SPEAKER" | "ENTRANCE" | "EXIT" | "CORRIDOR" | "BATHROOM" | "BAR" | "TEXT" | "SHAPE" | "CUSTOM";
    name: string;
    status: boolean;
    color: string | null;
    coordinateX: number;
    coordinateY: number;
    width: number | null;
    height: number | null;
    rotationDegrees: string | number;
    isEllipse: boolean;
    geometryPoints: ApiGeometryPoint[] | null;
}

export interface ApiFloor {
    id: string;
    venueId: string;
    name: string;
    levelIndex: number;
    sections: ApiSection[];
    canvasElements: ApiCanvasElement[];
}

export interface ApiVenueTree {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string | null;
    country: string;
    totalCapacity: number;
    description: string | null;
    status: VenueStatus;
    floors: ApiFloor[];
}

/** El editor exige `id` en cada punto de geometría; el JSON del backend no siempre lo trae. */
function withPointIds(points: ApiGeometryPoint[] | null) {
    return (points ?? []).map((p, i) => ({ ...p, id: p.id ?? `pt_${i}` }));
}

/**
 * rowSeatCounts/rowNames son campos SOLO-EDITOR (no existe columna para
 * ellos en la BD): la única fuente de verdad real es la lista de asientos ya
 * generados. Sin esto, una sección con asientos reales se veía como "Sin
 * asientos" cada vez que se recargaba el recinto desde el servidor.
 * El orden de las filas se infiere por su posición Y promedio (arriba→abajo),
 * que es como las genera el propio editor.
 */
function deriveRowConfig(seats: ApiSeat[]): { rowSeatCounts: number[]; rowNames: string[] } {
    if (seats.length === 0) return { rowSeatCounts: [], rowNames: [] };

    const seatsByRow = new Map<string, ApiSeat[]>();
    for (const seat of seats) {
        const rowSeats = seatsByRow.get(seat.row) ?? [];
        rowSeats.push(seat);
        seatsByRow.set(seat.row, rowSeats);
    }

    const rows = [...seatsByRow.entries()].map(([row, rowSeats]) => ({
        row,
        count: rowSeats.length,
        avgY: rowSeats.reduce((sum, s) => sum + (s.coordinateY ?? 0), 0) / rowSeats.length,
    }));
    rows.sort((a, b) => a.avgY - b.avgY);

    return {
        rowNames: rows.map((r) => r.row),
        rowSeatCounts: rows.map((r) => r.count),
    };
}

/** Convierte el árbol real del backend al modelo que consume PhysicalEditor. */
export function toPhysicalVenueState(v: ApiVenueTree): PhysicalVenueState {
    return {
        venue: {
            id: v.id,
            name: v.name,
            address: v.address,
            city: v.city,
            addressState: v.state,
            country: v.country,
            totalCapacity: v.totalCapacity,
            description: v.description,
            status: v.status,
        },
        floors: v.floors.map((f) => ({ id: f.id, venueId: f.venueId, name: f.name, levelIndex: f.levelIndex })),
        sections: v.floors.flatMap((f) =>
            f.sections.map((s) => {
                const { rowSeatCounts, rowNames } = deriveRowConfig(s.seats);
                return {
                    id: s.id,
                    venueId: s.venueId,
                    floorId: s.floorId,
                    name: s.name,
                    description: s.description,
                    capacity: s.capacity,
                    status: s.status,
                    color: s.color,
                    prefix: s.prefix,
                    coordinateX: s.coordinateX,
                    coordinateY: s.coordinateY,
                    width: s.width,
                    height: s.height,
                    rotationDegrees: Number(s.rotationDegrees),
                    isEllipse: s.isEllipse,
                    points: withPointIds(s.geometryPoints),
                    rowSeatCounts,
                    rowNames,
                    locked: false,
                    lockAspect: false,
                };
            }),
        ),
        seats: v.floors.flatMap((f) =>
            f.sections.flatMap((s) =>
                s.seats.map((seat) => ({
                    id: seat.id,
                    sectionId: seat.sectionId,
                    row: seat.row,
                    number: seat.number,
                    type: seat.type,
                    coordinateX: seat.coordinateX,
                    coordinateY: seat.coordinateY,
                    status: seat.status,
                })),
            ),
        ),
        canvasElements: v.floors.flatMap((f) =>
            f.canvasElements.map((el) => ({
                id: el.id,
                floorId: el.floorId,
                elementType: el.elementType,
                name: el.name,
                status: el.status,
                color: el.color,
                coordinateX: el.coordinateX,
                coordinateY: el.coordinateY,
                width: el.width,
                height: el.height,
                rotationDegrees: Number(el.rotationDegrees),
                isEllipse: el.isEllipse,
                points: withPointIds(el.geometryPoints),
                locked: false,
                lockAspect: false,
            })),
        ),
    };
}

export function toVenueDto(draft: VenueFormValues) {
    return {
        name: draft.name,
        address: draft.address,
        city: draft.city,
        state: draft.state || undefined,
        totalCapacity: draft.total_capacity,
        description: draft.description || undefined,
        status: draft.status,
    };
}
