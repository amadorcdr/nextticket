/**
 * transforms.ts — Transformaciones de estado: traslación, resize, rotación de grupo.
 *
 * Puras: reciben un estado "origen" (snapshot al iniciar el gesto) y devuelven
 * un estado nuevo, evitando arrastre de error de punto flotante.
 */

import type { Id, Pt, Section, Seat, CanvasElementModel, PhysicalVenueState, GeometryPoint, Nullable, OBB } from "./types";
import { sectionIsNumbered } from "./types";
import { deg2rad, obbLocalToWorld, localToWorld, worldToObbLocal } from "./geometry";
import { buildSeatsForSection } from "./seats";
import { BBOX_PADDING } from "./constants";

const sectionIdSet = (sections: Section[], ids: Set<Id>) =>
  new Set(sections.filter((z) => ids.has(z.id)).map((z) => z.id));

export const translateSelection = (
  origin: PhysicalVenueState,
  ids: Set<Id>,
  dx: number,
  dy: number,
): PhysicalVenueState => {
  const movingSectionIds = sectionIdSet(origin.sections, ids);
  const sections = origin.sections.map((z) =>
    ids.has(z.id)
      ? {
        ...z,
        coordinateX: (z.coordinateX ?? 0) + dx,
        coordinateY: (z.coordinateY ?? 0) + dy,
      }
      : z,
  );
  const canvasElements = origin.canvasElements.map((s) =>
    ids.has(s.id)
      ? {
        ...s,
        coordinateX: s.coordinateX + dx,
        coordinateY: s.coordinateY + dy,
      }
      : s,
  );
  const seats = origin.seats.map((s) => {
    if (movingSectionIds.has(s.sectionId)) {
      return {
        ...s,
        coordinateX: (s.coordinateX ?? 0) + dx,
        coordinateY: (s.coordinateY ?? 0) + dy,
      };
    }
    return s;
  });
  return { ...origin, sections, canvasElements, seats };
};

/** Regenera seats para todas las secciones numeradas indicadas. */
export const regenerateSeatsFor = (
  state: PhysicalVenueState,
  sectionIds: Set<Id>,
): PhysicalVenueState => {
  if (sectionIds.size === 0) return state;
  let seats = state.seats;
  for (const z of state.sections) {
    if (!sectionIds.has(z.id)) continue;
    const existing = seats.filter((s) => s.sectionId === z.id);
    const rebuilt = buildSeatsForSection(z, existing);
    const others = seats.filter((s) => s.sectionId !== z.id);
    seats = [...others, ...rebuilt];
  }
  return { ...state, seats };
};

/** Redimensiona la selección arrastrando la esquina corner de un OBB. */
export const resizeSelection = (
  origin: PhysicalVenueState,
  ids: Set<Id>,
  originObb: OBB,
  corner: 0 | 1 | 2 | 3,
  pointerWorld: Pt,
  snapVal: number,
  forceUniform: boolean,
): PhysicalVenueState => {
  const local = worldToObbLocal(originObb, pointerWorld.x, pointerWorld.y);
  const anchorLocal: [number, number] =
    corner === 0
      ? [originObb.hw, originObb.hh]
      : corner === 1
        ? [-originObb.hw, originObb.hh]
        : corner === 2
          ? [-originObb.hw, -originObb.hh]
          : [originObb.hw, -originObb.hh];
  const innerAnchor: [number, number] = [
    anchorLocal[0] > 0
      ? anchorLocal[0] - BBOX_PADDING
      : anchorLocal[0] + BBOX_PADDING,
    anchorLocal[1] > 0
      ? anchorLocal[1] - BBOX_PADDING
      : anchorLocal[1] + BBOX_PADDING,
  ];
  const innerOrigW = Math.max(1, originObb.hw * 2 - BBOX_PADDING * 2);
  const innerOrigH = Math.max(1, originObb.hh * 2 - BBOX_PADDING * 2);
  const rawW = Math.abs(local.x - anchorLocal[0]) - BBOX_PADDING * 2;
  const rawH = Math.abs(local.y - anchorLocal[1]) - BBOX_PADDING * 2;
  let newW = Math.max(snapVal, Math.round(rawW / snapVal) * snapVal || snapVal);
  let newH = Math.max(snapVal, Math.round(rawH / snapVal) * snapVal || snapVal);
  if (forceUniform) {
    const aspect = innerOrigW / innerOrigH;
    if (newW / newH > aspect)
      newW = Math.max(snapVal, Math.round((newH * aspect) / snapVal) * snapVal);
    else
      newH = Math.max(snapVal, Math.round(newW / aspect / snapVal) * snapVal);
  }
  const sx = newW / innerOrigW,
    sy = newH / innerOrigH;
  const anchorWorld = obbLocalToWorld(
    originObb,
    innerAnchor[0],
    innerAnchor[1],
  );
  const rad = deg2rad(originObb.rotation),
    c = Math.cos(rad),
    s = Math.sin(rad);

  const transformOne = <
    T extends {
      coordinateX: Nullable<number>;
      coordinateY: Nullable<number>;
      width: Nullable<number>;
      height: Nullable<number>;
      points: GeometryPoint[];
    },
  >(
    o: T,
    origW: number,
    origH: number,
    origX: number,
    origY: number,
  ): T => {
    const relWx = origX - anchorWorld.x,
      relWy = origY - anchorWorld.y;
    const relLx = relWx * Math.cos(-rad) - relWy * Math.sin(-rad);
    const relLy = relWx * Math.sin(-rad) + relWy * Math.cos(-rad);
    const scaledLx = relLx * sx,
      scaledLy = relLy * sy;
    const nx = anchorWorld.x + scaledLx * c - scaledLy * s;
    const ny = anchorWorld.y + scaledLx * s + scaledLy * c;
    const newWidth = Math.max(20, Math.round(origW * sx));
    const newHeight = Math.max(20, Math.round(origH * sy));
    const newPoints =
      o.points.length >= 3
        ? o.points.map((p) => ({
          ...p,
          x: Math.round(p.x * sx),
          y: Math.round(p.y * sy),
          controlX: p.controlX === null ? null : Math.round(p.controlX * sx),
          controlY: p.controlY === null ? null : Math.round(p.controlY * sy),
        }))
        : o.points;
    return {
      ...o,
      coordinateX: Math.round(nx),
      coordinateY: Math.round(ny),
      width: newWidth,
      height: newHeight,
      points: newPoints,
    };
  };

  const sections = origin.sections.map((z) => {
    if (!ids.has(z.id) || !z.width || !z.height) return z;
    return transformOne(
      z,
      z.width,
      z.height,
      z.coordinateX ?? 0,
      z.coordinateY ?? 0,
    );
  });
  const canvasElements = origin.canvasElements.map((el) => {
    if (!ids.has(el.id) || !el.width || !el.height) return el;
    return transformOne(
      el,
      el.width,
      el.height,
      el.coordinateX,
      el.coordinateY,
    );
  });
  return { ...origin, sections, canvasElements };
};

/** Rota la selección deltaDeg grados alrededor de center. */
export const rotateSelection = (
  origin: PhysicalVenueState,
  ids: Set<Id>,
  center: Pt,
  deltaDeg: number,
): PhysicalVenueState => {
  const rad = deg2rad(deltaDeg),
    c = Math.cos(rad),
    s = Math.sin(rad);
  const rotatePoint = (x: number, y: number) => {
    const rx = x - center.x,
      ry = y - center.y;
    return {
      x: Math.round(center.x + rx * c - ry * s),
      y: Math.round(center.y + rx * s + ry * c),
    };
  };
  const movingSectionIds = sectionIdSet(origin.sections, ids);
  const sections = origin.sections.map((z) => {
    if (!ids.has(z.id)) return z;
    const p = rotatePoint(z.coordinateX ?? 0, z.coordinateY ?? 0);
    return {
      ...z,
      coordinateX: p.x,
      coordinateY: p.y,
      rotationDegrees: z.rotationDegrees + deltaDeg,
    };
  });
  const canvasElements = origin.canvasElements.map((el) => {
    if (!ids.has(el.id)) return el;
    const p = rotatePoint(el.coordinateX, el.coordinateY);
    return {
      ...el,
      coordinateX: p.x,
      coordinateY: p.y,
      rotationDegrees: el.rotationDegrees + deltaDeg,
    };
  });
  const seats = origin.seats.map((seat) => {
    if (!movingSectionIds.has(seat.sectionId)) return seat;
    const p = rotatePoint(seat.coordinateX ?? 0, seat.coordinateY ?? 0);
    return {
      ...seat,
      coordinateX: p.x,
      coordinateY: p.y,
      rotationDegrees: (seat.rotationDegrees || 0) + deltaDeg,
    };
  });
  return { ...origin, sections, canvasElements, seats };
};
