/**
 * seats.ts — Generación y layout de asientos dentro de secciones.
 *
 * Algoritmo universal de ray-casting vertical:
 *
 * Para cada fila a profundidad t ∈ [0, 1]:
 *   1. Muestrear muchas posiciones X a lo largo del ancho de la sección.
 *   2. En cada X, hacer ray-cast vertical para encontrar el borde superior
 *      (Y_top) e inferior (Y_bottom) del contorno.
 *   3. Calcular Y_fila = lerp(Y_top, Y_bottom, t).
 *   4. Los puntos (X, Y_fila) forman un camino que sigue naturalmente
 *      la curvatura de la sección.
 *   5. Distribuir asientos equidistantemente sobre ese camino.
 *
 * Resultado:
 *   - Rectángulo → filas horizontales rectas (Y_top y Y_bottom son constantes)
 *   - Arco curvo → filas en arco (Y_top y Y_bottom varían con X)
 *   - Trapecio → filas que se estrechan (rango X válido disminuye)
 *   - Elipse → filas elípticas (boundaries curvas)
 *   - Cualquier polígono con Bézier/borderRadius → filas que siguen el contorno
 */

import type { Pt, GeometryPoint, GeometricObject, Section, Seat, Id } from "./types";
import { uid, sectionIsNumbered } from "./types";
import { localOutline, localBounds, localToWorld } from "./geometry";
import { ZONE_INNER_PADDING, SEAT_RADIUS, SECTION_SEAT_PADDING } from "./constants";

export const generateRowName = (index: number): string => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const cycle = Math.floor(index / letters.length);
  const letter = letters[index % letters.length];
  return cycle === 0 ? letter : `${letter}${cycle + 1}`;
};

// ── Geometric helpers ──────────────────────────────────────────────────────

/** Ray-cast vertical: en la posición X dada, encuentra el Y mínimo (top)
 *  y Y máximo (bottom) del contorno, con padding aplicado.
 *  Devuelve null si no hay 2+ intersecciones o el rango es <= 0. */
const verticalBoundsAt = (
  outline: Pt[],
  lx: number,
  pad: number,
): { top: number; bottom: number } | null => {
  const ys: number[] = [];
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const xi = outline[i].x,
      xj = outline[j].x;
    if ((xi <= lx && xj > lx) || (xj <= lx && xi > lx)) {
      const t = (lx - xi) / (xj - xi);
      ys.push(outline[i].y + t * (outline[j].y - outline[i].y));
    }
  }
  if (ys.length < 2) return null;
  ys.sort((a, b) => a - b);
  const top = ys[0] + pad;
  const bottom = ys[ys.length - 1] - pad;
  if (bottom <= top) return null;
  return { top, bottom };
};

/** Ray-cast horizontal: en la posición Y dada, encuentra los spans X del
 *  contorno con padding aplicado. */
const horizontalSpansAt = (
  outline: Pt[],
  ly: number,
  pad: number,
): [number, number][] => {
  const xs: number[] = [];
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const yi = outline[i].y,
      yj = outline[j].y;
    if ((yi <= ly && yj > ly) || (yj <= ly && yi > ly)) {
      const t = (ly - yi) / (yj - yi);
      xs.push(outline[i].x + t * (outline[j].x - outline[i].x));
    }
  }
  xs.sort((a, b) => a - b);
  const spans: [number, number][] = [];
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const s0 = xs[k] + pad,
      s1 = xs[k + 1] - pad;
    if (s1 >= s0) spans.push([s0, s1]);
  }
  return spans;
};

// ── Path helpers ───────────────────────────────────────────────────────────

/** Longitudes acumuladas de un camino abierto (polyline). */
const cumulativeLengths = (path: Pt[]): number[] => {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(
      cum[i - 1] +
        Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y),
    );
  }
  return cum;
};

/** Interpola un punto a una longitud acumulada dada sobre un camino. */
const pointAtLength = (path: Pt[], cumLen: number[], target: number): Pt => {
  if (path.length === 0) return { x: 0, y: 0 };
  if (target <= 0) return { ...path[0] };
  if (target >= cumLen[cumLen.length - 1]) return { ...path[path.length - 1] };
  let lo = 0,
    hi = cumLen.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumLen[mid] <= target) lo = mid;
    else hi = mid;
  }
  const segLen = cumLen[hi] - cumLen[lo];
  const frac = segLen > 0 ? (target - cumLen[lo]) / segLen : 0;
  return {
    x: path[lo].x + (path[hi].x - path[lo].x) * frac,
    y: path[lo].y + (path[hi].y - path[lo].y) * frac,
  };
};

/** Distribuye N puntos equidistantemente a lo largo de un camino abierto.
 *  Aplica un inset de SEAT_RADIUS desde los extremos del camino para que
 *  los asientos no queden sobre el borde de la sección. */
const distributeAlongPath = (path: Pt[], count: number): Pt[] => {
  if (count <= 0 || path.length === 0) return [];
  if (path.length === 1)
    return Array.from({ length: count }, () => ({ ...path[0] }));

  const cum = cumulativeLengths(path);
  const totalLen = cum[cum.length - 1];
  if (totalLen <= 0)
    return Array.from({ length: count }, () => ({ ...path[0] }));

  // Inset desde los extremos del camino
  const inset = Math.min(SECTION_SEAT_PADDING, totalLen * 0.15);
  const start = inset;
  const end = totalLen - inset;
  const usable = end - start;

  if (usable <= 0)
    return Array.from({ length: count }, () =>
      pointAtLength(path, cum, totalLen / 2),
    );

  if (count === 1) return [pointAtLength(path, cum, totalLen / 2)];

  const step = usable / (count - 1);
  const seats: Pt[] = [];
  for (let i = 0; i < count; i++) {
    seats.push(pointAtLength(path, cum, start + i * step));
  }
  return seats;
};

// ── Core layout ────────────────────────────────────────────────────────────

/** Calcula posiciones LOCALES para rowSeatCounts dentro del contorno.
 *
 *  Para cada fila, hace ray-cast vertical en muchos puntos X para encontrar
 *  los bordes superior e inferior de la sección, interpola la profundidad Y,
 *  y distribuye los asientos a lo largo del camino curvo resultante.
 *
 *  Funciona para cualquier forma: rectángulo, elipse, polígono con N vértices,
 *  curvas Bézier, esquinas redondeadas, formas cóncavas, etc.
 */
export const computeSeatLocalLayout = (
  section: {
    width: number;
    height: number;
    isEllipse: boolean;
    points: GeometryPoint[];
  },
  rowSeatCounts: number[],
): Pt[][] => {
  if (rowSeatCounts.length === 0) return [];

  const geomObj: GeometricObject = {
    coordinateX: 0,
    coordinateY: 0,
    width: section.width,
    height: section.height,
    rotationDegrees: 0,
    isEllipse: section.isEllipse,
    points: section.points,
  };

  // Contorno denso (24 segmentos por curva) para ray-cast preciso
  const outline = localOutline(geomObj, 64, 24);
  const bounds = localBounds(outline);

  // Padding vertical
  const vPad = SECTION_SEAT_PADDING;

  const xRange = bounds.maxX - bounds.minX;
  if (xRange <= 0) return rowSeatCounts.map(() => []);

  const rows = rowSeatCounts.length;

  // Densidad de muestreo: al menos 100 puntos, o 1 cada 2px
  const sampleCount = Math.max(100, Math.ceil(xRange / 2));

  // Centroide como fallback
  const cx = outline.reduce((s, p) => s + p.x, 0) / outline.length;
  const cy = outline.reduce((s, p) => s + p.y, 0) / outline.length;

  const result: Pt[][] = [];

  for (let r = 0; r < rows; r++) {
    // Factor de profundidad: 0 = borde superior, 1 = borde inferior
    const t = rows > 1 ? r / (rows - 1) : 0.5;

    // Paso 1: Generar camino crudo via ray-cast vertical
    const rawPath: Pt[] = [];
    for (let s = 0; s <= sampleCount; s++) {
      const lx = bounds.minX + (s / sampleCount) * xRange;
      const vb = verticalBoundsAt(outline, lx, vPad);
      if (!vb) continue;
      rawPath.push({
        x: lx,
        y: vb.top + t * (vb.bottom - vb.top),
      });
    }

    // Paso 2: Filtrar — conservar solo puntos que están DENTRO del contorno
    // horizontalmente. Esto corrige formas cóncavas donde los lados curvan
    // hacia adentro y el ray-cast vertical da posiciones fuera del borde lateral.
    const rowPath: Pt[] = [];
    for (const p of rawPath) {
      const spans = horizontalSpansAt(outline, p.y, SECTION_SEAT_PADDING);
      if (spans.some(([left, right]) => p.x >= left && p.x <= right)) {
        rowPath.push(p);
      }
    }

    if (rowPath.length < 2) {
      // Fallback: colocar todos en el centroide
      result.push(
        Array.from({ length: rowSeatCounts[r] }, () => ({ x: cx, y: cy })),
      );
      continue;
    }

    result.push(distributeAlongPath(rowPath, rowSeatCounts[r]));
  }

  return result;
};

// ── Build seats ────────────────────────────────────────────────────────────

/** Genera (o regenera) seats para una sección numerada. */
export const buildSeatsForSection = (
  section: Section,
  existingSeats: Seat[],
): Seat[] => {
  if (!sectionIsNumbered(section)) return [];
  const layout = computeSeatLocalLayout(
    {
      width: section.width ?? 0,
      height: section.height ?? 0,
      isEllipse: section.isEllipse,
      points: section.points,
    },
    section.rowSeatCounts,
  );
  const byRow: Record<string, Seat[]> = {};
  for (const s of existingSeats) {
    if (!byRow[s.row]) byRow[s.row] = [];
    byRow[s.row].push(s);
  }
  // El backend devuelve los asientos en orden de creación, no de número: si
  // se reutilizaran así, un asiento que antes era "6" se pasa a la posición
  // 0 y se renumera a "1", mientras el que YA era "1" sigue esperando su
  // turno de guardarse — durante ese instante dos asientos de la misma fila
  // comparten número y el backend lo rechaza (unique constraint). Ordenar
  // por número antes de reasignar por posición hace que, al solo AGREGAR
  // asientos a una fila, los ya existentes conserven su mismo número (nada
  // que reasignar), y solo los nuevos entren con números que no existían.
  for (const rowSeats of Object.values(byRow)) {
    rowSeats.sort((a, b) => Number(a.number) - Number(b.number));
  }
  const out: Seat[] = [];
  for (let r = 0; r < layout.length; r++) {
    const rowName = section.rowNames[r] || generateRowName(r);
    const previousRowSeats = byRow[rowName] || [];
    for (let c = 0; c < layout[r].length; c++) {
      const world = localToWorld(
        {
          coordinateX: section.coordinateX ?? 0,
          coordinateY: section.coordinateY ?? 0,
          rotationDegrees: section.rotationDegrees,
        },
        layout[r][c].x,
        layout[r][c].y,
      );
      const prev = previousRowSeats[c];
      out.push({
        id: prev?.id ?? uid("seat"),
        sectionId: section.id,
        row: rowName,
        number: String(c + 1),
        type: prev?.type ?? "STANDARD",
        coordinateX: Math.round(world.x),
        coordinateY: Math.round(world.y),
        rotationDegrees: prev?.rotationDegrees ?? section.rotationDegrees,
        status: prev?.status ?? "AVAILABLE",
      });
    }
  }
  return out;
};
