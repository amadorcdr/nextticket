/**
 * selection.ts — OBB de selección, bounding box, marquee, hit-testing, utilidades.
 */

import { Graphics } from "pixi.js";
import type { Pt, Id, Section, CanvasElementModel, Seat, OBB, PhysicalVenueState, GeometryPoint, EventZone } from "./types";
import { sectionIsNumbered } from "./types";
import { norm360, deg2rad, worldOutline, localBounds, obbLocalToWorld, worldToObbLocal, pointInObject } from "./geometry";
import { collectGeomEntries } from "./collisions";
import { polygonsOverlap } from "./geometry";
import { BBOX_PADDING, BBOX_ROTATE_OFFSET, HANDLE_HIT_RADIUS, SELECTION_COLOR, SEAT_RADIUS } from "./constants";

export type HandleHit = "rotate" | 0 | 1 | 2 | 3 | null;

export const computeSelectionOBB = (
  sections: Section[],
  elements: CanvasElementModel[],
  seats: Seat[],
  selectedIds: Set<Id>,
): OBB | null => {
  const selSections = sections.filter((z) => selectedIds.has(z.id) && z.width && z.height);
  const selElements = elements.filter((s) => selectedIds.has(s.id) && s.width && s.height);
  const selSeats = seats.filter((s) => selectedIds.has(s.id));
  const rotatable = [...selSections, ...selElements];
  if (rotatable.length === 0 && selSeats.length === 0) return null;

  let sharedRotation: number | null = null;
  if (rotatable.length > 0) {
    const first = norm360(rotatable[0].rotationDegrees);
    const allSame = rotatable.every((o) => Math.abs(norm360(o.rotationDegrees) - first) < 0.01);
    if (allSame) sharedRotation = rotatable[0].rotationDegrees;
  }

  if (
    sharedRotation !== null &&
    Math.abs(norm360(sharedRotation)) > 0.01 &&
    selSeats.length === 0
  ) {
    const invRad = -deg2rad(sharedRotation);
    const c = Math.cos(invRad), s = Math.sin(invRad);
    const localPts: Pt[] = [];
    for (const o of rotatable) {
      const geom = {
        coordinateX: (o as Section).coordinateX ?? (o as CanvasElementModel).coordinateX ?? 0,
        coordinateY: (o as Section).coordinateY ?? (o as CanvasElementModel).coordinateY ?? 0,
        width: o.width ?? 0, height: o.height ?? 0,
        rotationDegrees: o.rotationDegrees, isEllipse: o.isEllipse, points: o.points,
      };
      for (const wp of worldOutline(geom))
        localPts.push({ x: wp.x * c - wp.y * s, y: wp.x * s + wp.y * c });
    }
    const b = localBounds(localPts);
    const localCx = (b.minX + b.maxX) / 2, localCy = (b.minY + b.maxY) / 2;
    const rad = deg2rad(sharedRotation);
    const wc = Math.cos(rad), ws = Math.sin(rad);
    return {
      cx: localCx * wc - localCy * ws, cy: localCx * ws + localCy * wc,
      hw: (b.maxX - b.minX) / 2 + BBOX_PADDING, hh: (b.maxY - b.minY) / 2 + BBOX_PADDING,
      rotation: sharedRotation,
    };
  }

  const worldPts: Pt[] = [];
  for (const s of selSeats) worldPts.push({ x: s.coordinateX ?? 0, y: s.coordinateY ?? 0 });
  for (const o of rotatable) {
    const geom = {
      coordinateX: (o as Section).coordinateX ?? (o as CanvasElementModel).coordinateX ?? 0,
      coordinateY: (o as Section).coordinateY ?? (o as CanvasElementModel).coordinateY ?? 0,
      width: o.width ?? 0, height: o.height ?? 0,
      rotationDegrees: o.rotationDegrees, isEllipse: o.isEllipse, points: o.points,
    };
    worldPts.push(...worldOutline(geom));
  }
  if (worldPts.length === 0) return null;
  const b = localBounds(worldPts);
  return {
    cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2,
    hw: (b.maxX - b.minX) / 2 + BBOX_PADDING, hh: (b.maxY - b.minY) / 2 + BBOX_PADDING,
    rotation: 0,
  };
};

const drawDashedPolyline = (gfx: Graphics, pts: Pt[], closed: boolean, dash = 5, gap = 4) => {
  const segs: [Pt, Pt][] = [];
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++)
    segs.push([pts[i], pts[(i + 1) % pts.length]]);
  for (const [a, b] of segs) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    const ux = dx / len, uy = dy / len;
    let d = 0;
    while (d < len) {
      const e = Math.min(d + dash, len);
      gfx.moveTo(a.x + ux * d, a.y + uy * d).lineTo(a.x + ux * e, a.y + uy * e);
      d = e + gap;
    }
  }
};

import { obbCorners } from "./geometry";

export const drawSelectionBBox = (
  gfx: Graphics,
  obb: OBB,
  interactive: boolean,
  seatOnly: boolean,
) => {
  const corners = obbCorners(obb);
  drawDashedPolyline(gfx, corners, true);
  gfx.stroke({ width: 1.5, color: SELECTION_COLOR, alpha: 0.9 });
  if (!interactive) return;
  if (!seatOnly) {
    for (const c of corners) {
      gfx.save();
      gfx.rotateTransform(obb.rotation * Math.PI / 180);
      gfx.translateTransform(c.x, c.y);
      gfx.rect(-4, -4, 8, 8).fill({ color: SELECTION_COLOR, alpha: 1 });
      gfx.restore();
    }
    const rotPos = obbLocalToWorld(obb, 0, -obb.hh - BBOX_ROTATE_OFFSET);
    const topMid = obbLocalToWorld(obb, 0, -obb.hh);
    gfx.moveTo(topMid.x, topMid.y).lineTo(rotPos.x, rotPos.y)
      .stroke({ width: 1, color: SELECTION_COLOR, alpha: 0.7 });
    gfx.circle(rotPos.x, rotPos.y, 6)
      .fill({ color: 0xffffff, alpha: 1 })
      .stroke({ width: 1.5, color: SELECTION_COLOR, alpha: 1 });
  }
};

export const hitTestBBoxHandle = (obb: OBB, world: Pt): HandleHit => {
  const local = worldToObbLocal(obb, world.x, world.y);
  const rotLocal = { x: 0, y: -obb.hh - BBOX_ROTATE_OFFSET };
  if (Math.hypot(local.x - rotLocal.x, local.y - rotLocal.y) < HANDLE_HIT_RADIUS) return "rotate";
  const corners: [number, number][] = [
    [-obb.hw, -obb.hh], [obb.hw, -obb.hh],
    [obb.hw, obb.hh], [-obb.hw, obb.hh],
  ];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(local.x - corners[i][0]) < HANDLE_HIT_RADIUS && Math.abs(local.y - corners[i][1]) < HANDLE_HIT_RADIUS) {
      return i as 0 | 1 | 2 | 3;
    }
  }
  return null;
};

export const drawMarquee = (gfx: Graphics, x1: number, y1: number, x2: number, y2: number) => {
  const rx = Math.min(x1, x2), ry = Math.min(y1, y2), rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
  gfx.rect(rx, ry, rw, rh)
    .fill({ color: SELECTION_COLOR, alpha: 0.1 })
    .stroke({ width: 1.2, color: SELECTION_COLOR, alpha: 0.85 });
};

/** Busca qué objeto hay bajo un punto de mundo. */
export const hitTestAt = (
  state: PhysicalVenueState,
  world: Pt,
  activeFloorId?: Id,
): { kind: "seat" | "element" | "section"; id: Id } | null => {
  for (const seat of state.seats) {
    if (activeFloorId) {
      const section = state.sections.find((z) => z.id === seat.sectionId);
      if (section?.floorId !== activeFloorId) continue;
    }
    const dx = (seat.coordinateX ?? 0) - world.x, dy = (seat.coordinateY ?? 0) - world.y;
    if (Math.hypot(dx, dy) < SEAT_RADIUS + 4) return { kind: "seat", id: seat.id };
  }
  for (const el of state.canvasElements) {
    if (activeFloorId && el.floorId !== activeFloorId) continue;
    if (!el.width || !el.height) continue;
    if (pointInObject(world.x, world.y, {
      coordinateX: el.coordinateX, coordinateY: el.coordinateY,
      width: el.width, height: el.height,
      rotationDegrees: el.rotationDegrees, isEllipse: el.isEllipse, points: el.points,
    })) return { kind: "element", id: el.id };
  }
  for (const z of state.sections) {
    if (activeFloorId && z.floorId !== activeFloorId) continue;
    if (!z.width || !z.height) continue;
    if (pointInObject(world.x, world.y, {
      coordinateX: z.coordinateX ?? 0, coordinateY: z.coordinateY ?? 0,
      width: z.width, height: z.height,
      rotationDegrees: z.rotationDegrees, isEllipse: z.isEllipse, points: z.points,
    })) return { kind: "section", id: z.id };
  }
  return null;
};

/** Busca un espacio libre cercano a (bx,by). */
export const findFreeSpot = (
  state: PhysicalVenueState,
  bx: number,
  by: number,
  w: number,
  h: number,
): Pt => {
  const STEP = 30;
  let dx = 1, dy = 0, gx = 0, gy = 0, segment = 1, count = 0;
  for (let i = 0; i < 4000; i++) {
    const tx = bx + gx * STEP, ty = by + gy * STEP;
    const candidateOutline = worldOutline({
      coordinateX: tx, coordinateY: ty, width: w, height: h,
      rotationDegrees: 0, isEllipse: false, points: [],
    });
    const collides = collectGeomEntries(state).some((e) => polygonsOverlap(candidateOutline, e.outline));
    if (!collides) return { x: tx, y: ty };
    gx += dx; gy += dy;
    count++;
    if (count === segment) {
      count = 0; const t = dx; dx = -dy; dy = t;
      if (dy === 0) segment++;
    }
  }
  return { x: bx, y: by };
};

/** Nombre y prefijo únicos para una sección nueva. */
export const uniqueSectionNaming = (baseName: string, existing: Section[]): { name: string; prefix: string } => {
  const match = baseName.match(/^(.*?)(?: (\d+))?$/);
  const realBase = (match?.[1] || baseName).trim() || "Seccion";
  let count = match?.[2] ? parseInt(match[2], 10) : 1;
  let name = baseName;
  while (existing.some((z) => z.name.toLowerCase() === name.toLowerCase())) {
    count += 1;
    name = `${realBase} ${count}`;
  }
  const prefixBase = (realBase.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase()) || "SEC";
  let n = 1;
  let prefix = `${prefixBase}-${String(n).padStart(2, "0")}`;
  while (existing.some((z) => (z.prefix || "").toUpperCase() === prefix)) {
    n += 1;
    prefix = `${prefixBase}-${String(n).padStart(2, "0")}`;
  }
  return { name, prefix };
};

/** Capacidad total de una zona comercial. */
export const computeZoneCapacity = (zone: EventZone, physical: PhysicalVenueState): number => {
  let total = 0;
  for (const sectionId of zone.sectionIds) {
    const section = physical.sections.find((s) => s.id === sectionId);
    if (!section) continue;
    total += sectionIsNumbered(section)
      ? physical.seats.filter((s) => s.sectionId === sectionId).length
      : section.capacity;
  }
  return total;
};

/** Bounding box de todo el contenido físico. */
export const computeVenueBounds = (state: PhysicalVenueState): { minX: number; maxX: number; minY: number; maxY: number } | null => {
  const pts: Pt[] = [];
  for (const z of state.sections) {
    if (!z.width || !z.height) continue;
    pts.push(...worldOutline({ coordinateX: z.coordinateX ?? 0, coordinateY: z.coordinateY ?? 0, width: z.width, height: z.height, rotationDegrees: z.rotationDegrees, isEllipse: z.isEllipse, points: z.points }));
  }
  for (const s of state.canvasElements) {
    if (!s.width || !s.height) continue;
    pts.push(...worldOutline({ coordinateX: s.coordinateX, coordinateY: s.coordinateY, width: s.width, height: s.height, rotationDegrees: s.rotationDegrees, isEllipse: s.isEllipse, points: s.points }));
  }
  for (const s of state.seats) pts.push({ x: s.coordinateX ?? 0, y: s.coordinateY ?? 0 });
  if (pts.length === 0) return null;
  const b = localBounds(pts);
  return { minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY };
};
