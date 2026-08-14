/**
 * constants.ts — Constantes del editor de recintos NextTicket.
 */

import type { CanvasElementType } from "./types";

export const STROKE_COLOR = 0x808080;
export const BRAND_COLOR = 0x2563eb;
export const SELECTION_COLOR = 0x2563eb;
export const GUIDE_COLOR = 0xec4899;

export const SECTION_PALETTE = [
  "#2563eb",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
];
export const sectionColorFor = (index: number) =>
  SECTION_PALETTE[index % SECTION_PALETTE.length];

export const ZONE_INNER_PADDING = 20;
export const SECTION_SEAT_PADDING = 40;
export const SEAT_RADIUS = 10;
export const SEAT_MIN_SPACING = 20;
export const BBOX_PADDING = 14;
export const BBOX_ROTATE_OFFSET = 26;
export const HANDLE_HIT_RADIUS = 10;
export const RULER_SIZE = 8;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 10;
export const HISTORY_LIMIT = 60;

export const ELEMENT_TYPE_LABEL: Record<CanvasElementType, string> = {
  STAGE: "Escenario",
  SCREEN: "Pantalla",
  SPEAKER: "Bocina",
  ENTRANCE: "Entrada",
  EXIT: "Salida",
  CORRIDOR: "Pasillo",
  BATHROOM: "Baño",
  BAR: "Barra",
  TEXT: "Texto",
  SHAPE: "Figura",
  CUSTOM: "Personalizado",
};

export const ELEMENT_TYPE_DEFAULT_COLOR: Record<CanvasElementType, string> = {
  STAGE: "#4c1d95",
  SCREEN: "#1e3a5f",
  SPEAKER: "#374151",
  ENTRANCE: "#166534",
  EXIT: "#991b1b",
  CORRIDOR: "#78716c",
  BATHROOM: "#0e7490",
  BAR: "#9a3412",
  TEXT: "#334155",
  SHAPE: "#475569",
  CUSTOM: "#3f3f46",
};

/** Claves de Section/CanvasElementModel que son solo-editor: nunca se envían
 * a las tablas físicas de la BD. */
export const EDITOR_ONLY_SECTION_KEYS = [
  "locked",
  "lockAspect",
  "rowSeatCounts",
  "rowNames",
] as const;
