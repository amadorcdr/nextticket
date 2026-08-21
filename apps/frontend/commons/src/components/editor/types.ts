/**
 * types.ts — Modelo de datos espejo 1:1 del esquema SQL `nextticket` v12.
 *
 * NOTA: El campo `admission` (NUMBERED/GENERAL) NO existe aquí.
 * Se deriva del modelo de datos: si una sección tiene seats → numerada;
 * si no tiene → general. Esto coincide con el esquema SQL donde no hay
 * columna `admission` en `sections`.
 */

/** BINARY(16) en SQL se representa como string (uuid-like). */
export type Id = string;
export type Nullable<T> = T | null;

// ── ENUMs del esquema ──────────────────────────────────────────────────────
export type VenueStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE" | "REMOVED";
export type SectionStatus = "ACTIVE" | "INACTIVE" | "REMOVED";
export type SeatType = "STANDARD" | "VIP" | "PREMIUM" | "ACCESSIBLE";
export type SeatStatus =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "OUT_OF_SERVICE"
  | "REMOVED";
export type CanvasElementType =
  | "STAGE"
  | "SCREEN"
  | "SPEAKER"
  | "ENTRANCE"
  | "EXIT"
  | "CORRIDOR"
  | "BATHROOM"
  | "BAR"
  | "TEXT"
  | "SHAPE"
  | "CUSTOM";
export type EventZoneAdmissionType = "RESERVED" | "GENERAL";
export type EventZoneStatus = "ACTIVE" | "INACTIVE" | "SOLD_OUT";
export type PriceTierStatus = "PENDING" | "ACTIVE" | "EXHAUSTED" | "CLOSED";
export type EventSeatStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "DISABLED";

/** `floors` — capas de renderizado (Planta Baja, Balcón, ...). */
export interface Floor {
  id: Id;
  venueId: Id;
  name: string;
  levelIndex: number;
}

/**
 * `section_geometry_points` / `canvas_element_geometry_points`
 * Un punto de un polígono, en coordenadas LOCALES (relativas a la esquina
 * superior izquierda del objeto dueño). controlX/controlY = punto de control
 * Bézier cuadrático de la arista que sale de este vértice (NULL = arista recta).
 */
export interface GeometryPoint {
  id: Id;
  pointIndex: number;
  x: number;
  y: number;
  controlX: Nullable<number>;
  controlY: Nullable<number>;
  /** Radio de redondeo para esta esquina (0 = esquina recta). */
  borderRadius: number;
}

/**
 * `sections` — zona física del recinto (columnas de geometría del editor).
 *
 * `rowSeatCounts` y `rowNames` son campos SOLO-EDITOR que configuran la
 * generación de asientos. Si `rowSeatCounts.length > 0`, la sección es
 * "numerada" (tiene asientos); si está vacía, es "general" (solo aforo).
 */
export interface Section {
  id: Id;
  baseId?: Id;
  venueId: Id;
  floorId: Id;
  name: string;
  description: Nullable<string>;
  capacity: number;
  status: SectionStatus;
  color: Nullable<string>;
  prefix: Nullable<string>;
  coordinateX: Nullable<number>;
  coordinateY: Nullable<number>;
  width: Nullable<number>;
  height: Nullable<number>;
  rotationDegrees: number;
  isEllipse: boolean;
  /** Vacío cuando isEllipse = true (una elipse no tiene vértices). */
  points: GeometryPoint[];
  /** Config de filas usada para generar `seats`. Si length>0 → numerada. */
  rowSeatCounts: number[];
  rowNames: string[];
  /** Solo-editor: no persiste en BD. */
  locked?: boolean;
  lockAspect?: boolean;
}

/** `seats` — asiento individual, agrupado lógicamente por sección. */
export interface Seat {
  id: Id;
  sectionId: Id;
  row: string;
  number: string;
  type: SeatType;
  coordinateX: Nullable<number>;
  coordinateY: Nullable<number>;
  rotationDegrees?: number;
  status: SeatStatus;
}

/** `canvas_elements` — obstáculos/referencias visuales (sin precio/estado). */
export interface CanvasElementModel {
  id: Id;
  baseId?: Id;
  floorId: Id;
  elementType: CanvasElementType;
  name: string;
  status: boolean;
  color: Nullable<string>;
  coordinateX: number;
  coordinateY: number;
  width: Nullable<number>;
  height: Nullable<number>;
  rotationDegrees: number;
  isEllipse: boolean;
  points: GeometryPoint[];
  locked?: boolean;
  lockAspect?: boolean;
}

/** `venues` (subconjunto de columnas relevantes al editor). */
export interface VenueModel {
  id: Id;
  name: string;
  address: string;
  city: string;
  addressState: Nullable<string>;
  country: string;
  totalCapacity: number;
  description: Nullable<string>;
  status: VenueStatus;
}

/** Estado físico completo que produce/consume el editor administrador. */
export interface PhysicalVenueState {
  venue: VenueModel;
  floors: Floor[];
  sections: Section[];
  seats: Seat[];
  canvasElements: CanvasElementModel[];
}

/** `event_zones` (+ `event_zone_sections` como sectionIds embebido). */
export interface EventZone {
  id: Id;
  eventId: Id;
  publicName: string;
  admissionType: EventZoneAdmissionType;
  eventPrice: number;
  availableCapacity: number;
  mapColor: Nullable<string>;
  maxTicketsPerPurchase: number;
  status: EventZoneStatus;
  sectionIds: Id[];
  /**
   * Solo se usa al IMPORTAR un archivo de zonas de venta (nunca se persiste
   * ni se exporta desde datos reales): nombres de sección a resolver contra
   * el recinto físico del evento actual. Un mismo archivo de zonas puede
   * reutilizarse en cualquier recinto que tenga secciones con esos nombres,
   * sin importar que cada recinto nuevo tenga sus propios ids reales.
   */
  sectionNames?: string[];
}

/** `event_zone_price_tiers`. */
export interface EventZonePriceTier {
  id: Id;
  eventZoneId: Id;
  name: string;
  price: number;
  initialCapacity: Nullable<number>;
  availableCapacity: Nullable<number>;
  startsAt: Nullable<string>;
  endsAt: Nullable<string>;
  sortOrder: number;
  status: PriceTierStatus;
}

/** Estado comercial completo que produce/consume el editor organizador. */
export interface CommercialEventState {
  eventId: Id;
  eventName: string;
  zones: EventZone[];
  priceTiers: EventZonePriceTier[];
  /** Asientos de evento generados por el organizador (disabled, etc). */
  eventSeats: EventSeat[];
}

/** `event_seats` — disponibilidad de cada asiento para un evento puntual. */
export interface EventSeat {
  id: Id;
  eventZoneId: Id;
  seatId: Id;
  sectionId: Id;
  lockedUntil: Nullable<string>;
  status: EventSeatStatus;
}

/** Estado combinado que consume la vista previa del cliente final. */
export interface PreviewState {
  physical: PhysicalVenueState;
  commercial: CommercialEventState;
  eventSeats: EventSeat[];
}

/** Archivo de intercambio del editor (import/export .json). */
export interface VenueEditorFile {
  formatVersion: "nextticket-canvas-v12";
  physical: PhysicalVenueState;
  commercial?: CommercialEventState;
}

// ── Tipos auxiliares de geometría ───────────────────────────────────────────

export interface Pt {
  x: number;
  y: number;
}

/** Objeto genérico con geometría (Section o CanvasElementModel comparten forma). */
export interface GeometricObject {
  coordinateX: number;
  coordinateY: number;
  width: number;
  height: number;
  rotationDegrees: number;
  isEllipse: boolean;
  points: GeometryPoint[];
}

/** Oriented bounding box para asas de selección/redimensión/rotación. */
export interface OBB {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  rotation: number;
}

// ── Helpers para saber el tipo de admisión de una sección ─────────────────

/** Una sección es "numerada" si tiene rowSeatCounts configurados. */
export const sectionIsNumbered = (section: Section): boolean =>
  section.rowSeatCounts.length > 0;

/** Una sección es "general" si NO tiene rowSeatCounts. */
export const sectionIsGeneral = (section: Section): boolean =>
  section.rowSeatCounts.length === 0;

// ── UID generator ─────────────────────────────────────────────────────────

let _seq = 0;
export const uid = (prefix = "id"): Id => {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq.toString(36)}`;
};
