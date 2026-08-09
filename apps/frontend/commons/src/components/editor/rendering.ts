/**
 * rendering.ts — Funciones de renderizado: grid, regla, secciones, elementos, asientos.
 */

import { Graphics, Text, TextStyle, Container, Application } from "pixi.js";
import type { Pt, Id, Section, CanvasElementModel, Seat, EventSeatStatus, SeatStatus } from "./types";
import { worldOutline, deg2rad, localToWorld } from "./geometry";
import { STROKE_COLOR, SEAT_RADIUS, RULER_SIZE, ELEMENT_TYPE_DEFAULT_COLOR } from "./constants";
import { getRulerStep } from "./canvas-engine";

/** Compute the ideal bitmap resolution for a PixiJS Text at the given world zoom. */
const textResolution = (zoom: number): number =>
  Math.max(2, Math.ceil(zoom * (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)));

// ── Label styles ──────────────────────────────────────────────────────────

export const SECTION_LABEL_STYLE = new TextStyle({
  fontSize: 13,
  fill: 0xffffff,
  fontFamily: "Figtree, sans-serif",
  fontWeight: "bold",
  align: "center",
});
export const ELEMENT_LABEL_STYLE = new TextStyle({
  fontSize: 11,
  fill: 0xe5e7eb,
  fontFamily: "Figtree, sans-serif",
  align: "center",
});
export const SEAT_LABEL_STYLE = new TextStyle({
  fontSize: 7,
  fill: 0xffffff,
  fontFamily: "Figtree, sans-serif",
  align: "center",
});

// ── Viewport culling ──────────────────────────────────────────────────────

export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const inViewport = (
  vp: ViewportBounds | null,
  x: number,
  y: number,
  halfW: number,
  halfH: number,
) => {
  if (!vp) return true;
  return (
    x + halfW >= vp.minX &&
    x - halfW <= vp.maxX &&
    y + halfH >= vp.minY &&
    y - halfH <= vp.maxY
  );
};

// ── Hex conversion ────────────────────────────────────────────────────────

export const hexToInt = (hex: string | null | undefined, fallback: number): number => {
  if (!hex) return fallback;
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return Number.isNaN(n) ? fallback : n;
};

// ── Grid ──────────────────────────────────────────────────────────────────

const lastGridZoomRef = { current: -1 };
export const drawGrid = (gridGfx: Graphics, zoom: number) => {
  if (lastGridZoomRef.current === zoom) return;
  lastGridZoomRef.current = zoom;
  gridGfx.clear();
  const s = 4000;

  // Líneas cada 10 (se ocultan si el zoom es muy lejano para no saturar)
  if (zoom > 1) {
    for (let i = -s; i <= s; i += 10) {
      if (i % 50 === 0) continue;
      gridGfx.moveTo(i, -s).lineTo(i, s);
      gridGfx.moveTo(-s, i).lineTo(s, i);
    }
    gridGfx.stroke({ width: 0.2, color: STROKE_COLOR, alpha: 0.1 });
  }

  // Líneas cada 1 (se ocultan a menos que haya mucho zoom, ej. > 8.0 o 800%)
  if (zoom > 8) {
    for (let i = -s; i <= s; i += 1) {
      if (i % 10 === 0) continue;
      gridGfx.moveTo(i, -s).lineTo(i, s);
      gridGfx.moveTo(-s, i).lineTo(s, i);
    }
    gridGfx.stroke({ width: 0.1, color: STROKE_COLOR, alpha: 0.05 });
  }

  // Líneas cada 50
  if (zoom > 0.1) {
    for (let i = -s; i <= s; i += 50) {
      if (i % 100 === 0) continue;
      gridGfx.moveTo(i, -s).lineTo(i, s);
      gridGfx.moveTo(-s, i).lineTo(s, i);
    }
    gridGfx.stroke({ width: 0.3, color: STROKE_COLOR, alpha: 0.15 });
  }

  // Líneas cada 100
  for (let i = -s; i <= s; i += 100) {
    if (i === 0) continue; // Evitamos dibujar sobre la cruz central
    gridGfx.moveTo(i, -s).lineTo(i, s);
    gridGfx.moveTo(-s, i).lineTo(s, i);
  }
  gridGfx.stroke({ width: 0.4, color: STROKE_COLOR, alpha: 0.3 });

  // Cruz central (1px de grosor aparente en pantalla, 100% de opacidad)
  gridGfx
    .moveTo(-s, 0).lineTo(s, 0)
    .moveTo(0, -s).lineTo(0, s)
    .stroke({ width: 2 / zoom, color: STROKE_COLOR, alpha: 0.4 });
};

// ── Ruler ─────────────────────────────────────────────────────────────────

export const drawRuler = (
  rulerGfx: Graphics,
  rulerTexts: Text[],
  app: Application,
  world: Container,
) => {
  rulerGfx.clear();
  const cw = app.canvas.clientWidth,
    ch = app.canvas.clientHeight;
  const scale = world.scale.x;
  const step = getRulerStep(scale);
  rulerGfx.rect(0, 0, cw, RULER_SIZE);
  rulerGfx.rect(0, ch - RULER_SIZE, cw, RULER_SIZE);
  rulerGfx.rect(0, RULER_SIZE, RULER_SIZE, ch - RULER_SIZE * 2);
  rulerGfx.rect(cw - RULER_SIZE, RULER_SIZE, RULER_SIZE, ch - RULER_SIZE * 2);
  rulerGfx.fill({ color: 0xf31260, alpha: 0 });

  // Puntos de intersección (esquinas)
  rulerGfx.rect(0, 0, RULER_SIZE, RULER_SIZE);
  rulerGfx.rect(cw - RULER_SIZE, 0, RULER_SIZE, RULER_SIZE);
  rulerGfx.rect(0, ch - RULER_SIZE, RULER_SIZE, RULER_SIZE);
  rulerGfx.rect(cw - RULER_SIZE, ch - RULER_SIZE, RULER_SIZE, RULER_SIZE);
  rulerGfx.fill({ color: 0xf31260, alpha: 0 });

  let ti = 0;
  const res = textResolution(1); // La regla no se escala con el zoom, está en espacio de pantalla
  const startX = Math.floor(-world.x / scale / step) * step;
  const endX = Math.ceil((cw - world.x) / scale / step) * step;
  for (let v = startX; v <= endX; v += step) {
    const px = v * scale + world.x;
    // Ampliamos el margen a 20px para que los textos no invadan las esquinas
    if (px < RULER_SIZE + 20 || px > cw - RULER_SIZE - 20) continue;
    rulerGfx.moveTo(px, 0).lineTo(px, RULER_SIZE);
    rulerGfx.moveTo(px, ch - RULER_SIZE).lineTo(px, ch);
    rulerGfx.stroke({ color: STROKE_COLOR, width: 1, alpha: 0.2 });
    if (ti < rulerTexts.length) {
      const t = rulerTexts[ti++];
      t.text = String(v); t.anchor.set(0.5, 0.5); t.x = px; t.y = RULER_SIZE / 2; t.angle = 0; t.visible = true; t.resolution = res;
    }
    if (ti < rulerTexts.length) {
      const t = rulerTexts[ti++];
      t.text = String(v); t.anchor.set(0.5, 0.5); t.x = px; t.y = ch - RULER_SIZE / 2; t.angle = 0; t.visible = true; t.resolution = res;
    }
  }
  const startY = Math.floor(-world.y / scale / step) * step;
  const endY = Math.ceil((ch - world.y) / scale / step) * step;
  for (let v = startY; v <= endY; v += step) {
    const py = v * scale + world.y;
    // Ampliamos el margen a 20px para que los textos no invadan las esquinas
    if (py < RULER_SIZE + 20 || py > ch - RULER_SIZE - 20) continue;
    rulerGfx.moveTo(0, py).lineTo(RULER_SIZE, py);
    rulerGfx.moveTo(cw - RULER_SIZE, py).lineTo(cw, py);
    rulerGfx.stroke({ color: STROKE_COLOR, width: 1, alpha: 0.2 });
    if (ti < rulerTexts.length) {
      const t = rulerTexts[ti++];
      t.text = String(v); t.anchor.set(0.5, 0.5); t.x = RULER_SIZE / 2; t.y = py; t.angle = -90; t.visible = true; t.resolution = res;
    }
    if (ti < rulerTexts.length) {
      const t = rulerTexts[ti++];
      t.text = String(v); t.anchor.set(0.5, 0.5); t.x = cw - RULER_SIZE / 2; t.y = py; t.angle = -90; t.visible = true; t.resolution = res;
    }
  }
  while (ti < rulerTexts.length) rulerTexts[ti++].visible = false;
};

// ── Shape painting ────────────────────────────────────────────────────────

export const paintGeometricShape = (
  gfx: Graphics,
  obj: { coordinateX: number; coordinateY: number; width: number; height: number; rotationDegrees: number; isEllipse: boolean; points: any[] },
  colorHex: number,
  fillAlpha: number,
  strokeAlpha: number,
) => {
  const frame = { coordinateX: obj.coordinateX, coordinateY: obj.coordinateY, rotationDegrees: obj.rotationDegrees };
  const toW = (lx: number, ly: number) => localToWorld(frame, lx, ly);
  const rotRad = deg2rad(obj.rotationDegrees);

  // Structured polygon points — use native curve commands for perfect smoothness
  if (obj.points && obj.points.length >= 3) {
    const pts = [...obj.points].sort((a: any, b: any) => a.pointIndex - b.pointIndex);
    const n = pts.length;
    const hasCurves = pts.some(
      (p: any) => (p.controlX !== null && p.controlY !== null) || (p.borderRadius ?? 0) > 0,
    );

    if (hasCurves) {
      // For each vertex, compute arrive/depart tangent points and circular arc parameters.
      // When borderRadius > 0, the corner is replaced by a true circular arc drawn with arc().
      const vInfo = pts.map((p: any, i: number) => {
        const pPrev = pts[(i - 1 + n) % n];
        const pNext = pts[(i + 1) % n];
        const rad = p.borderRadius ?? 0;
        if (rad > 0 && p.controlX === null) {
          const dx1 = pPrev.x - p.x, dy1 = pPrev.y - p.y;
          const dx2 = pNext.x - p.x, dy2 = pNext.y - p.y;
          const len1 = Math.hypot(dx1, dy1) || 1;
          const len2 = Math.hypot(dx2, dy2) || 1;
          const cr = Math.min(rad, Math.min(len1, len2) / 2);
          if (cr > 0) {
            const ux1 = dx1 / len1, uy1 = dy1 / len1;
            const ux2 = dx2 / len2, uy2 = dy2 / len2;
            const t1x = p.x + ux1 * cr, t1y = p.y + uy1 * cr;
            const t2x = p.x + ux2 * cr, t2y = p.y + uy2 * cr;

            // Half interior angle & arc center
            const dot = ux1 * ux2 + uy1 * uy2;
            const halfAngle = Math.acos(Math.max(-1, Math.min(1, dot))) / 2;
            if (halfAngle >= 1e-6) {
              const bx = ux1 + ux2, by = uy1 + uy2;
              const bLen = Math.hypot(bx, by);
              if (bLen > 1e-9) {
                const dist = cr / Math.sin(halfAngle);
                const acxL = p.x + (bx / bLen) * dist;
                const acyL = p.y + (by / bLen) * dist;

                // Arc angles in local coords
                const startA = Math.atan2(t1y - acyL, t1x - acxL);
                const endA = Math.atan2(t2y - acyL, t2x - acxL);
                let sweep = endA - startA;
                while (sweep > Math.PI) sweep -= 2 * Math.PI;
                while (sweep < -Math.PI) sweep += 2 * Math.PI;

                // Transform to world coords (rotation preserves circles)
                const arcCW = toW(acxL, acyL);
                return {
                  arrive: toW(t1x, t1y),
                  depart: toW(t2x, t2y),
                  corner: true as const,
                  arc: {
                    cx: arcCW.x, cy: arcCW.y, r: cr,
                    startAngle: startA + rotRad,
                    endAngle: startA + rotRad + sweep,
                    ccw: sweep < 0,
                  },
                };
              }
            }
            // Fallback for degenerate bisector
            return { arrive: toW(t1x, t1y), depart: toW(t2x, t2y), corner: false as const, arc: null };
          }
        }
        const w = toW(p.x, p.y);
        return { arrive: w, depart: w, corner: false as const, arc: null };
      });

      const tracePath = () => {
        gfx.moveTo(vInfo[0].arrive.x, vInfo[0].arrive.y);
        if (vInfo[0].corner && vInfo[0].arc) {
          const a = vInfo[0].arc;
          gfx.arc(a.cx, a.cy, a.r, a.startAngle, a.endAngle, a.ccw);
        }
        for (let i = 0; i < n; i++) {
          const p = pts[i];
          const ni = (i + 1) % n;
          const nv = vInfo[ni];
          if (p.controlX !== null && p.controlY !== null) {
            const cpW = toW(p.controlX, p.controlY);
            gfx.quadraticCurveTo(cpW.x, cpW.y, nv.arrive.x, nv.arrive.y);
          } else {
            gfx.lineTo(nv.arrive.x, nv.arrive.y);
          }
          if (ni !== 0 && nv.corner && nv.arc) {
            const a = nv.arc;
            gfx.arc(a.cx, a.cy, a.r, a.startAngle, a.endAngle, a.ccw);
          }
        }
        gfx.closePath();
      };

      tracePath();
      gfx.fill({ color: colorHex, alpha: fillAlpha });
      tracePath();
      gfx.stroke({ width: 2, color: colorHex, alpha: strokeAlpha });
      return;
    }
  }

  // Fallback: straight-edged polygons, ellipses, or implicit rectangles
  const outline = worldOutline(obj);
  if (outline.length < 3) return;
  gfx.moveTo(outline[0].x, outline[0].y);
  for (let i = 1; i < outline.length; i++) gfx.lineTo(outline[i].x, outline[i].y);
  gfx.closePath();
  gfx.fill({ color: colorHex, alpha: fillAlpha });
  gfx.moveTo(outline[0].x, outline[0].y);
  for (let i = 1; i < outline.length; i++) gfx.lineTo(outline[i].x, outline[i].y);
  gfx.closePath();
  gfx.stroke({ width: 2, color: colorHex, alpha: strokeAlpha });
};

// ── Sections ──────────────────────────────────────────────────────────────

export interface SectionRenderCtx {
  gfx: Graphics;
  labelsLayer: Container;
  labelPool: Text[];
  sections: Section[];
  selectedIds: Set<Id>;
  vp: ViewportBounds | null;
  colorOf: (section: Section, index: number) => string;
  showLabels: boolean;
  zoom?: number;
}

export const renderSections = (ctx: SectionRenderCtx) => {
  const { gfx, labelsLayer, labelPool, sections, selectedIds, vp, colorOf, showLabels, zoom = 1 } = ctx;
  const res = textResolution(zoom);
  while (labelPool.length > sections.length) {
    const t = labelPool.pop();
    if (t) labelsLayer.removeChild(t);
  }
  sections.forEach((z, i) => {
    if (!z.width || !z.height) return;
    const halfDiag = Math.max(z.width, z.height) * 0.71;
    const cx = (z.coordinateX ?? 0) + z.width / 2;
    const cy = (z.coordinateY ?? 0) + z.height / 2;
    if (!inViewport(vp, cx, cy, halfDiag, halfDiag)) return;
    const isSel = selectedIds.has(z.id);
    const colorHex = hexToInt(colorOf(z, i), 0x2563eb);
    paintGeometricShape(
      gfx,
      {
        coordinateX: z.coordinateX ?? 0, coordinateY: z.coordinateY ?? 0,
        width: z.width, height: z.height, rotationDegrees: z.rotationDegrees,
        isEllipse: z.isEllipse, points: z.points,
      },
      colorHex,
      isSel ? 0.32 : 0.2,
      isSel ? 0.95 : 0.65,
    );
    if (!showLabels) return;
    let txt: Text;
    if (i < labelPool.length) {
      txt = labelPool[i]; txt.text = z.name;
    } else {
      txt = new Text({ text: z.name, style: SECTION_LABEL_STYLE });
      txt.anchor.set(0.5);
      labelsLayer.addChild(txt); labelPool.push(txt);
    }
    txt.resolution = res;
    const center = localToWorld(
      { coordinateX: z.coordinateX ?? 0, coordinateY: z.coordinateY ?? 0, rotationDegrees: z.rotationDegrees },
      z.width / 2, z.height / 2,
    );
    txt.x = center.x; txt.y = center.y;
    txt.rotation = deg2rad(z.rotationDegrees); txt.visible = true;
  });
};

// ── Canvas elements ───────────────────────────────────────────────────────

export interface ElementRenderCtx {
  gfx: Graphics;
  labelsLayer: Container;
  labelPool: Text[];
  elements: CanvasElementModel[];
  selectedIds: Set<Id>;
  vp: ViewportBounds | null;
  zoom?: number;
}

export const renderCanvasElements = (ctx: ElementRenderCtx) => {
  const { gfx, labelsLayer, labelPool, elements, selectedIds, vp, zoom = 1 } = ctx;
  const res = textResolution(zoom);
  while (labelPool.length > elements.length) {
    const t = labelPool.pop();
    if (t) labelsLayer.removeChild(t);
  }
  elements.forEach((s, i) => {
    if (!s.width || !s.height) return;
    const halfDiag = Math.max(s.width, s.height) * 0.71;
    const cx = s.coordinateX + s.width / 2;
    const cy = s.coordinateY + s.height / 2;
    if (!inViewport(vp, cx, cy, halfDiag, halfDiag)) return;
    const isSel = selectedIds.has(s.id);
    const colorHex = hexToInt(s.color, hexToInt(ELEMENT_TYPE_DEFAULT_COLOR[s.elementType], 0x475569));
    paintGeometricShape(
      gfx,
      {
        coordinateX: s.coordinateX, coordinateY: s.coordinateY,
        width: s.width, height: s.height, rotationDegrees: s.rotationDegrees,
        isEllipse: s.isEllipse, points: s.points,
      },
      colorHex,
      isSel ? 0.85 : 0.62,
      isSel ? 1 : 0.7,
    );
    let txt: Text;
    if (i < labelPool.length) {
      txt = labelPool[i]; txt.text = s.name;
    } else {
      txt = new Text({ text: s.name, style: ELEMENT_LABEL_STYLE });
      txt.anchor.set(0.5);
      labelsLayer.addChild(txt); labelPool.push(txt);
    }
    txt.resolution = res;
    const center = localToWorld(
      { coordinateX: s.coordinateX, coordinateY: s.coordinateY, rotationDegrees: s.rotationDegrees },
      s.width / 2, s.height / 2,
    );
    txt.x = center.x; txt.y = center.y;
    txt.rotation = deg2rad(s.rotationDegrees); txt.visible = true;
  });
};

// ── Seats ─────────────────────────────────────────────────────────────────

export interface SeatRenderCtx {
  gfx: Graphics;
  labelsLayer: Container | null;
  labelPool: Text[];
  seats: Seat[];
  selectedIds: Set<Id>;
  vp: ViewportBounds | null;
  colorOf: (seat: Seat) => number;
  statusOf?: (seat: Seat) => EventSeatStatus | SeatStatus;
  showLabels: boolean;
  labelOf?: (seat: Seat) => string;
  zoom?: number;
}

export const renderSeats = (ctx: SeatRenderCtx) => {
  const { gfx, labelsLayer, labelPool, seats, selectedIds, vp, colorOf, statusOf, showLabels, labelOf, zoom = 1 } = ctx;
  const res = textResolution(zoom);
  if (labelsLayer) {
    while (labelPool.length > (showLabels ? seats.length : 0)) {
      const t = labelPool.pop();
      if (t) labelsLayer.removeChild(t);
    }
  }
  seats.forEach((seat, i) => {
    const x = seat.coordinateX ?? 0, y = seat.coordinateY ?? 0;
    if (!inViewport(vp, x, y, SEAT_RADIUS + 2, SEAT_RADIUS + 2)) return;
    const st = statusOf ? statusOf(seat) : seat.status;
    const unavailable =
      st === "UNAVAILABLE" || st === "OUT_OF_SERVICE" ||
      st === "REMOVED" || st === "SOLD" ||
      st === "RESERVED" || st === "DISABLED";
    const isSel = selectedIds.has(seat.id);
    const color = unavailable ? 0x525252 : colorOf(seat);
    gfx.save();
    if (seat.rotationDegrees) gfx.rotateTransform(seat.rotationDegrees * Math.PI / 180);
    gfx.translateTransform(x, y);
    gfx
      .roundRect(-SEAT_RADIUS, -SEAT_RADIUS, SEAT_RADIUS * 2, SEAT_RADIUS * 2, 4)
      .fill({ color, alpha: unavailable ? 0.35 : isSel ? 1 : 0.85 });
    if (isSel) {
      gfx
        .roundRect(-SEAT_RADIUS - 2, -SEAT_RADIUS - 2, SEAT_RADIUS * 2 + 4, SEAT_RADIUS * 2 + 4, 5)
        .stroke({ width: 1.5, color: 0xffffff, alpha: 0.9 });
    }
    gfx.restore();
    if (showLabels && labelsLayer) {
      let txt: Text;
      if (i < labelPool.length) {
        txt = labelPool[i];
        txt.text = labelOf ? labelOf(seat) : seat.number;
      } else {
        txt = new Text({
          text: labelOf ? labelOf(seat) : seat.number,
          style: SEAT_LABEL_STYLE,
        });
        txt.anchor.set(0.5);
        labelsLayer.addChild(txt); labelPool.push(txt);
      }
      txt.resolution = res;
      txt.x = x; txt.y = y; txt.visible = true;
    }
  });
};
