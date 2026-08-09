/**
 * collisions.ts — Detección de colisiones estructurales entre objetos.
 */

import type { Pt, Id, PhysicalVenueState } from "./types";
import { worldOutline, polygonsOverlap } from "./geometry";

interface GeomEntry {
  id: Id;
  floorId: Id;
  outline: Pt[];
}

export const collectGeomEntries = (state: PhysicalVenueState): GeomEntry[] => {
  const entries: GeomEntry[] = [];
  for (const z of state.sections) {
    if (!z.width || !z.height) continue;
    entries.push({
      id: z.id,
      floorId: z.floorId,
      outline: worldOutline({
        coordinateX: z.coordinateX ?? 0,
        coordinateY: z.coordinateY ?? 0,
        width: z.width,
        height: z.height,
        rotationDegrees: z.rotationDegrees,
        isEllipse: z.isEllipse,
        points: z.points,
      }),
    });
  }
  for (const s of state.canvasElements) {
    if (!s.width || !s.height) continue;
    entries.push({
      id: s.id,
      floorId: s.floorId,
      outline: worldOutline({
        coordinateX: s.coordinateX,
        coordinateY: s.coordinateY,
        width: s.width,
        height: s.height,
        rotationDegrees: s.rotationDegrees,
        isEllipse: s.isEllipse,
        points: s.points,
      }),
    });
  }
  return entries;
};

/** true si algún objeto en movingIds invade un objeto que NO se está moviendo. */
export const hasStructuralConflict = (
  state: PhysicalVenueState,
  movingIds: Set<Id>,
): boolean => {
  const entries = collectGeomEntries(state);
  const moving = entries.filter((e) => movingIds.has(e.id));
  const still = entries.filter((e) => !movingIds.has(e.id));
  for (const m of moving) {
    for (const s of still) {
      if (m.floorId === s.floorId && polygonsOverlap(m.outline, s.outline)) return true;
    }
  }
  return false;
};
