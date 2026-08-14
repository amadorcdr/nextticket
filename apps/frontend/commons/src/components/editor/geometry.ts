/**
 * geometry.ts — Funciones de geometría puras para el editor de recintos.
 * Transformaciones, Bézier, polígonos, colisiones.
 */

import type { Pt, GeometryPoint, GeometricObject, OBB } from "./types";
import { uid } from "./types";

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const norm360 = (d: number) => ((d % 360) + 360) % 360;

export const localToWorld = (
  obj: { coordinateX: number; coordinateY: number; rotationDegrees: number },
  lx: number,
  ly: number,
): Pt => {
  const rad = deg2rad(obj.rotationDegrees);
  const c = Math.cos(rad),
    s = Math.sin(rad);
  return {
    x: obj.coordinateX + lx * c - ly * s,
    y: obj.coordinateY + lx * s + ly * c,
  };
};

export const worldToLocal = (
  obj: { coordinateX: number; coordinateY: number; rotationDegrees: number },
  wx: number,
  wy: number,
): Pt => {
  const rad = -deg2rad(obj.rotationDegrees);
  const c = Math.cos(rad),
    s = Math.sin(rad);
  const dx = wx - obj.coordinateX,
    dy = wy - obj.coordinateY;
  return { x: dx * c - dy * s, y: dx * s + dy * c };
};

export const evalQuadBezier = (p0: Pt, cp: Pt, p1: Pt, t: number): Pt => {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * cp.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * cp.y + t * t * p1.y,
  };
};

export const subdivideBezier = (p0: Pt, cp: Pt, p1: Pt, n = 14): Pt[] => {
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) out.push(evalQuadBezier(p0, cp, p1, i / n));
  return out;
};

export const defaultControlPoint = (p0: Pt, p1: Pt): Pt => {
  const mx = (p0.x + p1.x) / 2,
    my = (p0.y + p1.y) / 2;
  const dx = p1.x - p0.x,
    dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = len * 0.28;
  return { x: mx + (-dy / len) * bow, y: my + (dx / len) * bow };
};

/** Genera puntos a lo largo de un arco circular verdadero para redondear una esquina.
 * prev → current → next son los tres vértices; radius es el borderRadius. */
const roundCorner = (prev: Pt, current: Pt, next: Pt, radius: number, segments = 12): Pt[] => {
  const dx1 = prev.x - current.x, dy1 = prev.y - current.y;
  const dx2 = next.x - current.x, dy2 = next.y - current.y;
  const len1 = Math.hypot(dx1, dy1) || 1;
  const len2 = Math.hypot(dx2, dy2) || 1;
  const maxR = Math.min(len1, len2) / 2;
  const r = Math.min(radius, maxR);
  if (r <= 0) return [current];

  const ux1 = dx1 / len1, uy1 = dy1 / len1;
  const ux2 = dx2 / len2, uy2 = dy2 / len2;

  // Puntos de tangencia
  const t1: Pt = { x: current.x + ux1 * r, y: current.y + uy1 * r };
  const t2: Pt = { x: current.x + ux2 * r, y: current.y + uy2 * r };

  // Mitad del ángulo interior entre las dos aristas
  const dot = ux1 * ux2 + uy1 * uy2;
  const halfAngle = Math.acos(Math.max(-1, Math.min(1, dot))) / 2;
  if (halfAngle < 1e-6) return [current]; // aristas casi paralelas

  // Centro del arco: avanzar desde el vértice por la bisectriz
  const bx = ux1 + ux2, by = uy1 + uy2;
  const bLen = Math.hypot(bx, by);
  if (bLen < 1e-9) return [t1, t2]; // bisectriz degenerada
  const dist = r / Math.sin(halfAngle);
  const cx = current.x + (bx / bLen) * dist;
  const cy = current.y + (by / bLen) * dist;

  // Ángulos del arco
  const startAngle = Math.atan2(t1.y - cy, t1.x - cx);
  const endAngle = Math.atan2(t2.y - cy, t2.x - cx);
  let sweep = endAngle - startAngle;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;

  // Generar puntos sobre el arco circular verdadero
  const pts: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + t * sweep;
    pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return pts;
};

/** Expande los puntos de un polígono (con curvas y borderRadius opcionales) a una polilínea densa,
 * en coordenadas LOCALES.
 * @param curveSegments — segmentos por curva Bézier / arco de esquina (default 14). */
export const localOutline = (obj: GeometricObject, ellipseSegments = 40, curveSegments = 14): Pt[] => {
  if (obj.points && obj.points.length >= 3) {
    const ordered = [...obj.points].sort((a, b) => a.pointIndex - b.pointIndex);
    const hasCurves = ordered.some(
      (p) => p.controlX !== null && p.controlY !== null,
    );
    const hasRadius = ordered.some((p) => (p.borderRadius ?? 0) > 0);
    if (!hasCurves && !hasRadius) return ordered.map((p) => ({ x: p.x, y: p.y }));
    const out: Pt[] = [];
    for (let i = 0; i < ordered.length; i++) {
      const p0 = ordered[i];
      const pPrev = ordered[(i - 1 + ordered.length) % ordered.length];
      const p1 = ordered[(i + 1) % ordered.length];
      const r = p0.borderRadius ?? 0;
      if (r > 0 && p0.controlX === null) {
        // Esquina redondeada (sin curva Bézier en la arista saliente)
        const cornerPts = roundCorner(
          { x: pPrev.x, y: pPrev.y },
          { x: p0.x, y: p0.y },
          { x: p1.x, y: p1.y },
          r,
          curveSegments,
        );
        for (const cp of cornerPts) out.push(cp);
      } else {
        out.push({ x: p0.x, y: p0.y });
      }
      if (p0.controlX !== null && p0.controlY !== null) {
        const sub = subdivideBezier(
          { x: p0.x, y: p0.y },
          { x: p0.controlX, y: p0.controlY },
          { x: p1.x, y: p1.y },
          curveSegments,
        );
        for (let k = 0; k < sub.length - 1; k++) out.push(sub[k]);
      }
    }
    return out;
  }
  const w = obj.width,
    h = obj.height;
  const hw = w / 2,
    hh = h / 2;
  if (obj.isEllipse) {
    const out: Pt[] = [];
    for (let i = 0; i < ellipseSegments; i++) {
      const t = (i / ellipseSegments) * Math.PI * 2;
      out.push({ x: hw + hw * Math.cos(t), y: hh + hh * Math.sin(t) });
    }
    return out;
  }
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
};

/** Igual que localOutline pero transformado a coordenadas de mundo. */
export const worldOutline = (obj: GeometricObject): Pt[] =>
  localOutline(obj).map((p) => localToWorld(obj, p.x, p.y));

/** Bounding box (sin rotar) de un conjunto de puntos locales. */
export const localBounds = (pts: Pt[]) => {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(20, maxX - minX),
    height: Math.max(20, maxY - minY),
  };
};

/** Recalcula width/height de una sección/elemento a partir de sus puntos. */
export const boundsFromPoints = (points: GeometryPoint[]) => {
  const outline = localOutline({
    coordinateX: 0,
    coordinateY: 0,
    width: 0,
    height: 0,
    rotationDegrees: 0,
    isEllipse: false,
    points,
  });
  return localBounds(outline);
};

export const isPointInPolygon = (p: Pt, poly: Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y,
      xj = poly[j].x,
      yj = poly[j].y;
    const intersects =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const pointInObject = (
  wx: number,
  wy: number,
  obj: GeometricObject,
): boolean => {
  const local = worldToLocal(obj, wx, wy);
  return isPointInPolygon(local, localOutline(obj));
};

export const segmentsIntersect = (p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean => {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (d === 0) return false;
  const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
};

export const polygonsOverlap = (a: Pt[], b: Pt[]): boolean => {
  if (a.length === 0 || b.length === 0) return false;
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i],
      p2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const p3 = b[j],
        p4 = b[(j + 1) % b.length];
      if (segmentsIntersect(p1, p2, p3, p4)) return true;
    }
  }
  return isPointInPolygon(a[0], b) || isPointInPolygon(b[0], a);
};

export const polygonSelfIntersects = (points: GeometryPoint[]): boolean => {
  const pts = localOutline({
    coordinateX: 0,
    coordinateY: 0,
    width: 0,
    height: 0,
    rotationDegrees: 0,
    isEllipse: false,
    points,
  });
  if (pts.length < 4) return false;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i],
      p2 = pts[(i + 1) % pts.length];
    for (let j = i + 2; j < pts.length; j++) {
      if (i === 0 && j === pts.length - 1) continue;
      const p3 = pts[j],
        p4 = pts[(j + 1) % pts.length];
      if (segmentsIntersect(p1, p2, p3, p4)) return true;
    }
  }
  return false;
};

export const obbCorners = (o: OBB): Pt[] => {
  const rad = deg2rad(o.rotation);
  const c = Math.cos(rad),
    s = Math.sin(rad);
  return (
    [
      [-o.hw, -o.hh],
      [o.hw, -o.hh],
      [o.hw, o.hh],
      [-o.hw, o.hh],
    ] as [number, number][]
  ).map(([lx, ly]) => ({
    x: o.cx + lx * c - ly * s,
    y: o.cy + lx * s + ly * c,
  }));
};

export const obbLocalToWorld = (o: OBB, lx: number, ly: number): Pt => {
  const rad = deg2rad(o.rotation);
  const c = Math.cos(rad),
    s = Math.sin(rad);
  return { x: o.cx + lx * c - ly * s, y: o.cy + lx * s + ly * c };
};

export const worldToObbLocal = (o: OBB, wx: number, wy: number): Pt => {
  const rad = -deg2rad(o.rotation);
  const c = Math.cos(rad),
    s = Math.sin(rad);
  const dx = wx - o.cx,
    dy = wy - o.cy;
  return { x: dx * c - dy * s, y: dx * s + dy * c };
};

/** Genera los 4 vértices implícitos de un rectángulo en coordenadas locales. */
export const rectPoints = (w: number, h: number): GeometryPoint[] => {
  return [
    { id: uid("pt"), pointIndex: 0, x: 0, y: 0, controlX: null, controlY: null, borderRadius: 0 },
    { id: uid("pt"), pointIndex: 1, x: w, y: 0, controlX: null, controlY: null, borderRadius: 0 },
    { id: uid("pt"), pointIndex: 2, x: w, y: h, controlX: null, controlY: null, borderRadius: 0 },
    { id: uid("pt"), pointIndex: 3, x: 0, y: h, controlX: null, controlY: null, borderRadius: 0 },
  ];
};

/** Devuelve los puntos reales del objeto, o los del rectángulo implícito. */
export const materializePoints = (obj: { width: number | null; height: number | null; points: GeometryPoint[] }): GeometryPoint[] =>
  obj.points.length >= 3 ? obj.points : rectPoints(obj.width ?? 100, obj.height ?? 100);
