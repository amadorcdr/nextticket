/**
 * serialization.ts — Import/export JSON, SVG, y conversión a forma relacional SQL.
 */

import type {
  Id, Section, Seat, CanvasElementModel, PhysicalVenueState,
  CommercialEventState, EventZone, EventZonePriceTier, EventSeat,
  GeometryPoint, VenueEditorFile, Pt,
} from "./types";
import { uid } from "./types";
import { worldOutline, localBounds } from "./geometry";
import { sectionColorFor, ELEMENT_TYPE_DEFAULT_COLOR, SEAT_RADIUS } from "./constants";

// ── Forma relacional del esquema SQL ──────────────────────────────────────

interface SectionRow extends Omit<
  Section,
  | "points"
  | "rowSeatCounts"
  | "rowNames"
  | "locked"
  | "lockAspect"
> { }
interface CanvasElementRow extends Omit<
  CanvasElementModel,
  "points" | "locked" | "lockAspect"
> { }

interface PhysicalSqlShape {
  floors: PhysicalVenueState["floors"];
  sections: SectionRow[];
  section_geometry_points: (GeometryPoint & { sectionId: Id })[];
  seats: Seat[];
  canvas_elements: CanvasElementRow[];
  canvas_element_geometry_points: (GeometryPoint & { canvasElementId: Id })[];
}

export const toPhysicalSqlShape = (state: PhysicalVenueState): PhysicalSqlShape => {
  const sections: SectionRow[] = state.sections.map(
    ({
      points,
      rowSeatCounts,
      rowNames,
      locked,
      lockAspect,
      ...rest
    }) => rest,
  );
  const section_geometry_points = state.sections.flatMap((z) =>
    z.points.map((p) => ({ ...p, sectionId: z.id })),
  );
  const canvas_elements: CanvasElementRow[] = state.canvasElements.map(
    ({ points, locked, lockAspect, ...rest }) => rest,
  );
  const canvas_element_geometry_points = state.canvasElements.flatMap((s) =>
    s.points.map((p) => ({ ...p, canvasElementId: s.id })),
  );
  return {
    floors: state.floors,
    sections,
    section_geometry_points,
    seats: state.seats,
    canvas_elements,
    canvas_element_geometry_points,
  };
};

interface CommercialSqlShape {
  event_zones: Omit<EventZone, "sectionIds">[];
  event_zone_sections: {
    id: Id;
    eventZoneId: Id;
    eventId: Id;
    sectionId: Id;
  }[];
  event_zone_price_tiers: EventZonePriceTier[];
  event_seats: EventSeat[];
}

export const toCommercialSqlShape = (
  state: CommercialEventState,
): CommercialSqlShape => {
  const event_zones = state.zones.map(({ sectionIds, ...rest }) => rest);
  const event_zone_sections = state.zones.flatMap((z) =>
    z.sectionIds.map((sectionId) => ({
      id: uid("ezs"),
      eventZoneId: z.id,
      eventId: z.eventId,
      sectionId,
    })),
  );
  return {
    event_zones,
    event_zone_sections,
    event_zone_price_tiers: state.priceTiers,
    event_seats: state.eventSeats,
  };
};

export const exportVenueEditorFile = (
  physical: PhysicalVenueState,
  commercial?: CommercialEventState,
): VenueEditorFile => ({
  formatVersion: "nextticket-canvas-v12",
  physical,
  commercial,
});

export const downloadJSON = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const readJSONFile = <T,>(file: File): Promise<T> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)) as T);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });

export const exportCanvasAsSvg = (
  state: PhysicalVenueState,
  sectionColorOf: (id: Id) => string,
): string => {
  const pts: Pt[] = [];
  for (const z of state.sections) {
    if (!z.width || !z.height) continue;
    pts.push(
      ...worldOutline({
        coordinateX: z.coordinateX ?? 0,
        coordinateY: z.coordinateY ?? 0,
        width: z.width,
        height: z.height,
        rotationDegrees: z.rotationDegrees,
        isEllipse: z.isEllipse,
        points: z.points,
      }),
    );
  }
  for (const s of state.canvasElements) {
    if (!s.width || !s.height) continue;
    pts.push(
      ...worldOutline({
        coordinateX: s.coordinateX,
        coordinateY: s.coordinateY,
        width: s.width,
        height: s.height,
        rotationDegrees: s.rotationDegrees,
        isEllipse: s.isEllipse,
        points: s.points,
      }),
    );
  }
  for (const s of state.seats)
    pts.push({ x: s.coordinateX ?? 0, y: s.coordinateY ?? 0 });
  if (pts.length === 0) pts.push({ x: 0, y: 0 }, { x: 800, y: 600 });
  const bounds = localBounds(pts);
  const pad = 80;
  const minX = bounds.minX - pad,
    minY = bounds.minY - pad;
  const w = bounds.width + pad * 2,
    h = bounds.height + pad * 2;

  const poly = (outline: Pt[], fill: string, opacity: number) =>
    `<polygon points="${outline.map((p) => `${p.x},${p.y}`).join(" ")}" fill="${fill}" fill-opacity="${opacity}" stroke="${fill}" stroke-opacity="0.7" stroke-width="2" />`;

  let body = "";
  state.sections.forEach((z, i) => {
    if (!z.width || !z.height) return;
    const outline = worldOutline({
      coordinateX: z.coordinateX ?? 0,
      coordinateY: z.coordinateY ?? 0,
      width: z.width,
      height: z.height,
      rotationDegrees: z.rotationDegrees,
      isEllipse: z.isEllipse,
      points: z.points,
    });
    body += poly(outline, sectionColorOf(z.id) || sectionColorFor(i), 0.22);
    body += `<text x="${(z.coordinateX ?? 0) + (z.width ?? 0) / 2}" y="${(z.coordinateY ?? 0) + (z.height ?? 0) / 2}" text-anchor="middle" font-size="14" font-family="sans-serif" fill="#111">${z.name}</text>`;
  });
  state.canvasElements.forEach((s) => {
    if (!s.width || !s.height) return;
    const outline = worldOutline({
      coordinateX: s.coordinateX,
      coordinateY: s.coordinateY,
      width: s.width,
      height: s.height,
      rotationDegrees: s.rotationDegrees,
      isEllipse: s.isEllipse,
      points: s.points,
    });
    body += poly(
      outline,
      s.color || ELEMENT_TYPE_DEFAULT_COLOR[s.elementType],
      0.55,
    );
    body += `<text x="${s.coordinateX + (s.width ?? 0) / 2}" y="${s.coordinateY + (s.height ?? 0) / 2}" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#111">${s.name}</text>`;
  });
  state.seats.forEach((s) => {
    body += `<circle cx="${s.coordinateX}" cy="${s.coordinateY}" r="${SEAT_RADIUS}" fill="${sectionColorOf(s.sectionId)}" fill-opacity="0.85" />`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${w}" height="${h}" style="background:#ffffff;font-family:sans-serif;">${body}</svg>`;
};

export const downloadSvg = (svg: string, filename: string) => {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
