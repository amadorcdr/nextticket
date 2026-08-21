/**
 * physical-editor.tsx — Editor Físico (usuarios ADMINISTRADORES)
 *
 * Crea/edita la geometría del recinto: secciones, asientos, elementos canvas.
 * Incluye: selección, arrastre, redimensión, rotación, edición de vértices,
 * curvas Bézier, copiar/pegar/duplicar, undo/redo, pisos, import/export, etc.
 *
 * La admisión (numerada/general) se DERIVA de rowSeatCounts:
 * - rowSeatCounts.length > 0 → numerada (tiene asientos)
 * - rowSeatCounts.length === 0 → general (solo aforo)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "pixi.js";
import type {
  Id, Pt, Section, Seat, CanvasElementModel, CanvasElementType,
  PhysicalVenueState, GeometryPoint, OBB, VenueEditorFile,
} from "./types";
import { uid, sectionIsNumbered } from "./types";
import {
  localToWorld, worldToLocal, deg2rad, evalQuadBezier,
  materializePoints, rectPoints, boundsFromPoints, polygonSelfIntersects,
  defaultControlPoint,
} from "./geometry";
import { Reorder, motion } from "framer-motion";
import { sectionColorFor, ELEMENT_TYPE_LABEL, ELEMENT_TYPE_DEFAULT_COLOR, BRAND_COLOR, SEAT_RADIUS } from "./constants";
import { buildSeatsForSection, generateRowName } from "./seats";
import { hasStructuralConflict } from "./collisions";
import {
  exportVenueEditorFile, downloadJSON, readJSONFile,
  exportCanvasAsSvg, downloadSvg,
} from "./serialization";
import {
  translateSelection, regenerateSeatsFor, resizeSelection, rotateSelection,
} from "./transforms";
import { useHistory } from "./history";
import { usePixiStage, type PixiLayers, type StagePointerInfo } from "./canvas-engine";
import {
  drawGrid, drawRuler, paintGeometricShape,
  renderSections, renderCanvasElements, renderSeats, hexToInt,
} from "./rendering";
import {
  computeSelectionOBB, drawSelectionBBox, hitTestBBoxHandle, drawMarquee,
  hitTestAt, findFreeSpot, uniqueSectionNaming, computeVenueBounds,
} from "./selection";
import { useKeyboardShortcuts } from "./keyboard";
import { SmartPanel, useIsDesktop, ConfirmSwitch, ConfirmSelect } from "./layout-components";
import { ColorField, CheckField } from "./controls";
import { Accordion, Button, ButtonGroup, Checkbox, Chip, SearchField, Description, Kbd, Label, NumberField, ScrollShadow, Separator, Toolbar, Tooltip, ToggleButton, ToggleButtonGroup, InputGroup, TextField, TextArea, ListBox, Select, Switch, Input, Dropdown, CloseButton, Tabs, Spinner, Modal, FieldError } from "@heroui/react";
import { Armchair, Search, ClipboardPaste, ClipboardPlus, Copy, CopyPlus, LocateFixed, PanelLeftOpen, PanelRightOpen, Plus, Redo2, SquareDashedMousePointer, Trash2, Undo2, Users, X, ZoomIn, ZoomOut, Circle, Square, LockKeyhole, LockKeyholeOpen, Link, Unlink, Spline, MousePointer2, Hand, Theater, TvMinimal, Speaker, LogIn, LogOut, Route, Toilet, Wine, Type, Shapes, Component, Crown, Gem, Accessibility, LayersPlus, FileUp, Save, Check, Download, ChevronDown, GripVertical, Pencil, CheckCircle2, Ban, Wrench, Construction, Upload, SquareSquare, ChevronRight, ChevronLeft, SquarePen, Layers } from "lucide-react";

const ELEMENT_ICONS: Record<CanvasElementType, React.ElementType> = {
  STAGE: Theater,
  SCREEN: TvMinimal,
  SPEAKER: Speaker,
  ENTRANCE: LogIn,
  EXIT: LogOut,
  CORRIDOR: Route,
  BATHROOM: Toilet,
  BAR: Wine,
  TEXT: Type,
  SHAPE: Shapes,
  CUSTOM: Component,
};
import { StaticMiniMap, FloorsToolbarReorderList } from "./controls";
import { Panel } from "../organisms/Panel";
import { Icon } from "../..";

// ── Fábrica de estatus vacío ───────────────────────────────────────────────

export const createEmptyPhysicalVenue = (
  name = "Nuevo Recinto",
): PhysicalVenueState => {
  const venueId = uid("venue");
  const floorId = uid("floor");
  return {
    venue: {
      id: venueId, name, address: "", city: "",
      addressState: null, country: "Mexico", totalCapacity: 0,
      description: null, status: "DRAFT",
    },
    floors: [{ id: floorId, venueId, name: "Piso 1", levelIndex: 0 }],
    sections: [], seats: [], canvasElements: [],
  };
};

// ── Tipos de gesto ────────────────────────────────────────────────────────

type GestureMode = "none" | "drag" | "resize" | "rotate" | "marquee" | "vertexDrag" | "curveDrag";
interface GestureState {
  mode: GestureMode;
  ids: Set<Id>;
  origin: PhysicalVenueState | null;
  startWorld: Pt;
  obb: OBB | null;
  corner: 0 | 1 | 2 | 3 | null;
  center: Pt | null;
  startAngle: number;
  vertexObjId: Id | null;
  vertexIdx: number;
  curveEdgeIdx: number;
}
const EMPTY_GESTURE: GestureState = {
  mode: "none", ids: new Set(), origin: null,
  startWorld: { x: 0, y: 0 }, obb: null, corner: null,
  center: null, startAngle: 0, vertexObjId: null,
  vertexIdx: -1, curveEdgeIdx: -1,
};


export type PhysicalEditorMode = "create" | "update";

export interface PhysicalEditorProps {
  initialState?: PhysicalVenueState;
  onChange?: (state: PhysicalVenueState) => void;
  /** Modo CRUD del editor. Por defecto "create". */
  mode?: PhysicalEditorMode;
  /** Callback al presionar el botón principal (Crear / Guardar). */
  onSave?: (state: PhysicalVenueState) => void;
  /** El backend no tiene un endpoint de "guardar todo": onSave hace una
   * cascada de requests entidad por entidad, que en recintos grandes tarda
   * varios segundos. Mientras esto sea true, se deshabilita el botón y se
   * muestra un indicador de carga para que no parezca que la app se colgó. */
  saving?: boolean;
  /** Callback al presionar "Cancelar". Si no se pasa, el botón no se muestra
   * (el canvas no tiene ninguna otra forma de salir sin guardar). */
  onCancel?: () => void;
}
import { worldOutline } from "./geometry";

const StaticSectionPreview = ({ section, seats }: { section: Section, seats: Seat[] }) => {
  if (seats.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  seats.forEach(s => {
    const cx = s.coordinateX ?? 0;
    const cy = s.coordinateY ?? 0;
    minX = Math.min(minX, cx - SEAT_RADIUS);
    minY = Math.min(minY, cy - SEAT_RADIUS);
    maxX = Math.max(maxX, cx + SEAT_RADIUS);
    maxY = Math.max(maxY, cy + SEAT_RADIUS);
  });

  const pts = worldOutline({
    ...section,
    coordinateX: section.coordinateX ?? 0,
    coordinateY: section.coordinateY ?? 0,
    width: section.width ?? 100,
    height: section.height ?? 100,
  });
  pts.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  const pad = 20;
  const vMinX = minX - pad;
  const vMinY = minY - pad;
  const vW = Math.max(10, (maxX - minX) + pad * 2);
  const vH = Math.max(10, (maxY - minY) + pad * 2);

  const renderSectionShape = () => {
    const color = section.color || "#14c9e1";
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length; i++) {
      const ni = (i + 1) % pts.length;
      const p0 = section.points?.[i];
      if (p0 && p0.controlX !== null && p0.controlY !== null && (!section.isEllipse)) {
        const rad = ((section.rotationDegrees || 0) * Math.PI) / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const cx = section.coordinateX ?? 0, cy = section.coordinateY ?? 0;
        const cpx = cx + p0.controlX * cos - p0.controlY * sin;
        const cpy = cy + p0.controlX * sin + p0.controlY * cos;
        d += ` Q${cpx},${cpy} ${pts[ni].x},${pts[ni].y}`;
      } else {
        d += ` L${pts[ni].x},${pts[ni].y}`;
      }
    }
    d += "Z";
    return <path d={d} fill="transparent" stroke={color} strokeWidth={2} opacity={0.5} />;
  };

  return (
    <div className="w-full h-full overflow-hidden relative shrink-0">
      <svg
        viewBox={`${vMinX} ${vMinY} ${vW} ${vH}`}
        className="w-full h-full bg-transparent"
        preserveAspectRatio="xMidYMid meet"
      >
        {renderSectionShape()}
        {seats.map(s => {
          const cx = s.coordinateX ?? 0;
          const cy = s.coordinateY ?? 0;
          const w = SEAT_RADIUS * 2;
          const h = SEAT_RADIUS * 2;
          return (
            <rect
              key={s.id}
              x={cx - SEAT_RADIUS}
              y={cy - SEAT_RADIUS}
              width={w}
              height={h}
              rx={4}
              fill={s.status === 'AVAILABLE' ? (section.color || "#14c9e1") : "#525252"}
              opacity={s.status === 'AVAILABLE' ? 0.85 : 0.35}
              transform={`rotate(${s.rotationDegrees || 0} ${cx} ${cy})`}
            />
          );
        })}
      </svg>
    </div>
  );
};

export default function PhysicalEditor({ initialState, onChange, mode = "create", onSave, saving = false, onCancel }: PhysicalEditorProps) {
  const { state: venue, commit: setVenue, mutateSilently: setVenueSilent, settle, undo, redo, canUndo, canRedo } =
    useHistory<PhysicalVenueState>(initialState ?? createEmptyPhysicalVenue());
  useEffect(() => { onChange?.(venue); }, [venue, onChange]);

  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const setVenueField = <K extends keyof PhysicalVenueState["venue"]>(
    key: K,
    value: PhysicalVenueState["venue"][K],
  ) => {
    setVenue((prev) => ({ ...prev, venue: { ...prev.venue, [key]: value } }));
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const centerOnRef = useRef<((x: number, y: number) => void) | null>(null);
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [snap, setSnap] = useState(10);
  const [activeFloorIdState, setActiveFloorIdState] = useState<Id>("");
  const activeFloorId = venue.floors.some((f) => f.id === activeFloorIdState) ? activeFloorIdState : (venue.floors[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(new Set());
  const [localFloors, setLocalFloors] = useState(venue.floors);
  useEffect(() => { setLocalFloors(venue.floors); }, [venue.floors]);
  const handleFloorChange = useCallback((id: Id) => { setActiveFloorIdState(id); setSelectedIds(new Set()); }, []);
  const reorderFloors = useCallback((sourceId: Id, targetId: Id) => {
    setVenue((prev) => {
      const newFloors = [...prev.floors];
      const sourceIdx = newFloors.findIndex((f) => f.id === sourceId);
      const targetIdx = newFloors.findIndex((f) => f.id === targetId);
      if (sourceIdx < 0 || targetIdx < 0 || sourceIdx === targetIdx) return prev;
      const [moved] = newFloors.splice(sourceIdx, 1);
      newFloors.splice(targetIdx, 0, moved);
      return { ...prev, floors: newFloors.map((f, i) => ({ ...f, levelIndex: i })) };
    });
  }, [setVenue]);
  const [vertexEditId, setVertexEditId] = useState<Id | null>(null);
  const [selectedVertexIdx, setSelectedVertexIdx] = useState(-1);
  const gestureRef = useRef<GestureState>(EMPTY_GESTURE);
  const marqueeRef = useRef<{ active: boolean; start: Pt; current: Pt }>({ active: false, start: { x: 0, y: 0 }, current: { x: 0, y: 0 } });
  const clipboardRef = useRef<{ sections: Section[]; elements: CanvasElementModel[] }>({ sections: [], elements: [] });
  const [hasClipboard, setHasClipboard] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newRowName, setNewRowName] = useState("");
  const [newRowSeats, setNewRowSeats] = useState(10);
  const sectionLabelPoolRef = useRef<Text[]>([]);
  const elementLabelPoolRef = useRef<Text[]>([]);
  const seatLabelPoolRef = useRef<Text[]>([]);
  const snapVal = useCallback((v: number) => Math.round(v / snap) * snap, [snap]);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);


  /* ── Selección / edición de vértices ─────────────────────────────────── */
  const activateVertexEditing = useCallback((id: Id) => {
    setVenueSilent((prev) => {
      const section = prev.sections.find((z) => z.id === id);
      if (section && !section.isEllipse && section.points.length < 3) {
        return { ...prev, sections: prev.sections.map((z) => (z.id === id ? { ...z, points: rectPoints(z.width ?? 100, z.height ?? 100) } : z)) };
      }
      const element = prev.canvasElements.find((s) => s.id === id);
      if (element && !element.isEllipse && element.points.length < 3) {
        return { ...prev, canvasElements: prev.canvasElements.map((s) => (s.id === id ? { ...s, points: rectPoints(s.width ?? 100, s.height ?? 100) } : s)) };
      }
      return prev;
    });
    setVertexEditId(id);
    setSelectedVertexIdx(-1);
  }, [setVenueSilent]);

  const selectOnly = useCallback((id: Id) => {
    const targetFloorId = venue.sections.find(s => s.id === id)?.floorId || venue.canvasElements.find(e => e.id === id)?.floorId;
    if (targetFloorId && targetFloorId !== activeFloorId) setActiveFloorIdState(targetFloorId);
    setSelectedIds(new Set([id]));
    activateVertexEditing(id);
  }, [activateVertexEditing, activeFloorId, venue]);

  const selectMany = useCallback((ids: Set<Id>) => {
    setSelectedIds(ids);
    if (ids.size === 1) activateVertexEditing([...ids][0]);
    else { setVertexEditId(null); setSelectedVertexIdx(-1); }
  }, [activateVertexEditing]);

  /* ── Mutaciones ──────────────────────────────────────────────────────── */
  const patchSection = useCallback((id: Id, patch: Partial<Section>) => {
    setVenue((prev) => {
      const z = prev.sections.find((s) => s.id === id);
      if (!z) return prev;
      let candidate = prev;
      if (patch.coordinateX !== undefined || patch.coordinateY !== undefined) {
        const dx = (patch.coordinateX ?? z.coordinateX ?? 0) - (z.coordinateX ?? 0);
        const dy = (patch.coordinateY ?? z.coordinateY ?? 0) - (z.coordinateY ?? 0);
        if (dx !== 0 || dy !== 0) {
          candidate = translateSelection(candidate, new Set([id]), dx, dy);
        }
      }
      if (patch.rotationDegrees !== undefined && patch.rotationDegrees !== z.rotationDegrees) {
        const delta = patch.rotationDegrees - z.rotationDegrees;
        const currentZ = candidate.sections.find(s => s.id === id);
        const center = { x: (currentZ?.coordinateX ?? 0) + (currentZ?.width ?? 0) / 2, y: (currentZ?.coordinateY ?? 0) + (currentZ?.height ?? 0) / 2 };
        candidate = rotateSelection(candidate, new Set([id]), center, delta);
      }
      return { ...candidate, sections: candidate.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
    });
  }, [setVenue]);

  /** patchSection con validación de colisión — para propiedades geométricas (posición, rotación) */
  const patchSectionValidated = useCallback((id: Id, patch: Partial<Section>) => {
    setVenue((prev) => {
      const z = prev.sections.find((s) => s.id === id);
      if (!z) return prev;
      let candidate = prev;
      if (patch.coordinateX !== undefined || patch.coordinateY !== undefined) {
        const dx = (patch.coordinateX ?? z.coordinateX ?? 0) - (z.coordinateX ?? 0);
        const dy = (patch.coordinateY ?? z.coordinateY ?? 0) - (z.coordinateY ?? 0);
        if (dx !== 0 || dy !== 0) {
          candidate = translateSelection(candidate, new Set([id]), dx, dy);
        }
      }
      if (patch.rotationDegrees !== undefined && patch.rotationDegrees !== z.rotationDegrees) {
        const delta = patch.rotationDegrees - z.rotationDegrees;
        const currentZ = candidate.sections.find(s => s.id === id);
        const center = { x: (currentZ?.coordinateX ?? 0) + (currentZ?.width ?? 0) / 2, y: (currentZ?.coordinateY ?? 0) + (currentZ?.height ?? 0) / 2 };
        candidate = rotateSelection(candidate, new Set([id]), center, delta);
      }
      candidate = { ...candidate, sections: candidate.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
      if (hasStructuralConflict(candidate, new Set([id]))) return prev;
      return candidate;
    });
  }, [setVenue]);

  const patchElement = useCallback((id: Id, patch: Partial<CanvasElementModel>) => {
    setVenue((prev) => {
      const z = prev.canvasElements.find((s) => s.id === id);
      if (!z) return prev;
      let candidate = prev;
      if (patch.coordinateX !== undefined || patch.coordinateY !== undefined) {
        const dx = (patch.coordinateX ?? z.coordinateX ?? 0) - (z.coordinateX ?? 0);
        const dy = (patch.coordinateY ?? z.coordinateY ?? 0) - (z.coordinateY ?? 0);
        if (dx !== 0 || dy !== 0) {
          candidate = translateSelection(candidate, new Set([id]), dx, dy);
        }
      }
      if (patch.rotationDegrees !== undefined && patch.rotationDegrees !== z.rotationDegrees) {
        const delta = patch.rotationDegrees - z.rotationDegrees;
        const currentZ = candidate.canvasElements.find(s => s.id === id);
        const center = { x: (currentZ?.coordinateX ?? 0) + (currentZ?.width ?? 0) / 2, y: (currentZ?.coordinateY ?? 0) + (currentZ?.height ?? 0) / 2 };
        candidate = rotateSelection(candidate, new Set([id]), center, delta);
      }
      return { ...candidate, canvasElements: candidate.canvasElements.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
    });
  }, [setVenue]);

  /** patchElement con validación de colisión — para propiedades geométricas (posición, tamaño, rotación) */
  const patchElementValidated = useCallback((id: Id, patch: Partial<CanvasElementModel>) => {
    setVenue((prev) => {
      const z = prev.canvasElements.find((s) => s.id === id);
      if (!z) return prev;
      let candidate = prev;
      if (patch.coordinateX !== undefined || patch.coordinateY !== undefined) {
        const dx = (patch.coordinateX ?? z.coordinateX ?? 0) - (z.coordinateX ?? 0);
        const dy = (patch.coordinateY ?? z.coordinateY ?? 0) - (z.coordinateY ?? 0);
        if (dx !== 0 || dy !== 0) {
          candidate = translateSelection(candidate, new Set([id]), dx, dy);
        }
      }
      if (patch.rotationDegrees !== undefined && patch.rotationDegrees !== z.rotationDegrees) {
        const delta = patch.rotationDegrees - z.rotationDegrees;
        const currentZ = candidate.canvasElements.find(s => s.id === id);
        const center = { x: (currentZ?.coordinateX ?? 0) + (currentZ?.width ?? 0) / 2, y: (currentZ?.coordinateY ?? 0) + (currentZ?.height ?? 0) / 2 };
        candidate = rotateSelection(candidate, new Set([id]), center, delta);
      }
      candidate = { ...candidate, canvasElements: candidate.canvasElements.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
      if (hasStructuralConflict(candidate, new Set([id]))) return prev;
      return candidate;
    });
  }, [setVenue]);

  const patchSeat = useCallback((id: Id, patch: Partial<Seat>) => {
    setVenue((prev) => ({ ...prev, seats: prev.seats.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }, [setVenue]);

  /** Cambia entre numerada y general: genera o borra asientos. */
  const setSectionAdmission = useCallback((id: Id, numbered: boolean) => {
    setVenue((prev) => {
      const section = prev.sections.find((z) => z.id === id);
      if (!section) return prev;
      if (numbered) {
        // De general a numerada: crear config de filas
        const rowSeatCounts = [10];
        const updated = { ...section, rowSeatCounts, rowNames: ["A"], capacity: rowSeatCounts.reduce((a, b) => a + b, 0) };
        const rebuilt = buildSeatsForSection(updated, []);
        return { ...prev, sections: prev.sections.map((z) => (z.id === id ? updated : z)), seats: [...prev.seats.filter((s) => s.sectionId !== id), ...rebuilt] };
      } else {
        // De numerada a general: borrar filas y asientos
        const updated = { ...section, rowSeatCounts: [], rowNames: [] };
        return { ...prev, sections: prev.sections.map((z) => (z.id === id ? updated : z)), seats: prev.seats.filter((s) => s.sectionId !== id) };
      }
    });
  }, [setVenue]);

  const setSectionRowConfig = useCallback((id: Id, rowSeatCounts: number[], rowNames: string[]) => {
    setVenue((prev) => {
      const section = prev.sections.find((z) => z.id === id);
      if (!section) return prev;
      const updated = { ...section, rowSeatCounts, rowNames, capacity: rowSeatCounts.reduce((a, b) => a + b, 0) };
      const rebuilt = buildSeatsForSection(updated, prev.seats.filter((s) => s.sectionId === id));
      return { ...prev, sections: prev.sections.map((z) => (z.id === id ? updated : z)), seats: [...prev.seats.filter((s) => s.sectionId !== id), ...rebuilt] };
    });
  }, [setVenue]);

  const addRow = useCallback((id: Id) => {
    const section = venue.sections.find((z) => z.id === id);
    if (!section) return;
    const counts = [...section.rowSeatCounts, section.rowSeatCounts[section.rowSeatCounts.length - 1] || 10];
    const names = [...section.rowNames];
    while (names.length < counts.length) names.push(generateRowName(names.length));
    setSectionRowConfig(id, counts, names);
  }, [venue.sections, setSectionRowConfig]);

  const removeRow = useCallback((id: Id, rowIdx: number) => {
    const section = venue.sections.find((z) => z.id === id);
    if (!section || section.rowSeatCounts.length <= 1) return;
    setSectionRowConfig(id, section.rowSeatCounts.filter((_, i) => i !== rowIdx), section.rowNames.filter((_, i) => i !== rowIdx));
  }, [venue.sections, setSectionRowConfig]);

  const toggleEllipse = useCallback((id: Id, isSection: boolean) => {
    setVenue((prev) => {
      if (isSection) {
        const section = prev.sections.find((z) => z.id === id);
        if (!section) return prev;
        const nextEllipse = !section.isEllipse;
        const updated = { ...section, isEllipse: nextEllipse, points: nextEllipse ? [] : section.points };
        const rebuilt = sectionIsNumbered(updated) ? buildSeatsForSection(updated, prev.seats.filter((s) => s.sectionId === id)) : [];
        return { ...prev, sections: prev.sections.map((z) => (z.id === id ? updated : z)), seats: [...prev.seats.filter((s) => s.sectionId !== id), ...rebuilt] };
      }
      return { ...prev, canvasElements: prev.canvasElements.map((s) => (s.id === id ? { ...s, isEllipse: !s.isEllipse, points: !s.isEllipse ? [] : s.points } : s)) };
    });
    setVertexEditId(null); setSelectedVertexIdx(-1);
  }, [setVenue]);

  const resizeSectionDimension = useCallback((id: Id, dim: "width" | "height", value: number) => {
    setVenue((prev) => {
      const section = prev.sections.find((z) => z.id === id);
      if (!section) return prev;
      const updated = { ...section, [dim]: Math.max(20, value) } as Section;
      const rebuilt = sectionIsNumbered(updated) ? buildSeatsForSection(updated, prev.seats.filter((s) => s.sectionId === id)) : [];
      const candidate = { ...prev, sections: prev.sections.map((z) => (z.id === id ? updated : z)), seats: [...prev.seats.filter((s) => s.sectionId !== id), ...rebuilt] };
      if (hasStructuralConflict(candidate, new Set([id]))) return prev;
      return candidate;
    });
  }, [setVenue]);

  /* ── Edición de vértices / curvas ─────────────────────────────────────── */
  const toggleCurveOnEdge = useCallback((objId: Id, edgeIdx: number) => {
    setVenue((prev) => {
      const applyTo = (points: GeometryPoint[]) => {
        const ordered = [...points].sort((a, b) => a.pointIndex - b.pointIndex).map((p) => ({ ...p }));
        const a = ordered[edgeIdx], b = ordered[(edgeIdx + 1) % ordered.length];
        if (a.controlX !== null) { a.controlX = null; a.controlY = null; }
        else { const cp = defaultControlPoint({ x: a.x, y: a.y }, { x: b.x, y: b.y }); a.controlX = cp.x; a.controlY = cp.y; a.borderRadius = 0; }
        return ordered;
      };
      const section = prev.sections.find((z) => z.id === objId);
      if (section && !section.isEllipse) {
        const nextPts = applyTo(materializePoints(section));
        const bounds = boundsFromPoints(nextPts);
        const updated = { ...section, points: nextPts, width: bounds.width, height: bounds.height };
        const rebuilt = sectionIsNumbered(updated) ? buildSeatsForSection(updated, prev.seats.filter((s) => s.sectionId === objId)) : [];
        return { ...prev, sections: prev.sections.map((z) => (z.id === objId ? updated : z)), seats: [...prev.seats.filter((s) => s.sectionId !== objId), ...rebuilt] };
      }
      const element = prev.canvasElements.find((s) => s.id === objId);
      if (element && !element.isEllipse) {
        const nextPts = applyTo(materializePoints(element));
        const bounds = boundsFromPoints(nextPts);
        return { ...prev, canvasElements: prev.canvasElements.map((s) => (s.id === objId ? { ...s, points: nextPts, width: bounds.width, height: bounds.height } : s)) };
      }
      return prev;
    });
  }, [setVenue]);

  const insertVertexAtMidpoint = useCallback((objId: Id, afterIdx: number, x: number, y: number) => {
    setVenue((prev) => {
      const applyTo = (points: GeometryPoint[]) => {
        const ordered = [...points].sort((a, b) => a.pointIndex - b.pointIndex).map((p) => ({ ...p }));
        ordered.splice(afterIdx, 0, { id: uid("pt"), pointIndex: 0, x, y, controlX: null, controlY: null, borderRadius: 0 });
        return ordered.map((p, i) => ({ ...p, pointIndex: i }));
      };
      const section = prev.sections.find((z) => z.id === objId);
      if (section && !section.isEllipse) {
        const nextPts = applyTo(materializePoints(section));
        const bounds = boundsFromPoints(nextPts);
        const updated = { ...section, points: nextPts, width: bounds.width, height: bounds.height };
        const rebuilt = sectionIsNumbered(updated) ? buildSeatsForSection(updated, prev.seats.filter((s) => s.sectionId === objId)) : [];
        return { ...prev, sections: prev.sections.map((z) => (z.id === objId ? updated : z)), seats: [...prev.seats.filter((s) => s.sectionId !== objId), ...rebuilt] };
      }
      const element = prev.canvasElements.find((s) => s.id === objId);
      if (element && !element.isEllipse) {
        const nextPts = applyTo(materializePoints(element));
        const bounds = boundsFromPoints(nextPts);
        return { ...prev, canvasElements: prev.canvasElements.map((s) => (s.id === objId ? { ...s, points: nextPts, width: bounds.width, height: bounds.height } : s)) };
      }
      return prev;
    });
    setSelectedVertexIdx(afterIdx);
  }, [setVenue]);

  const deleteVertex = useCallback((objId: Id, idx: number) => {
    setVenue((prev) => {
      const section = prev.sections.find((z) => z.id === objId);
      if (section && section.points.length > 3) {
        const nextPts = section.points.filter((p) => p.pointIndex !== idx).sort((a, b) => a.pointIndex - b.pointIndex).map((p, i) => ({ ...p, pointIndex: i }));
        const bounds = boundsFromPoints(nextPts);
        const updated = { ...section, points: nextPts, width: bounds.width, height: bounds.height };
        const rebuilt = sectionIsNumbered(updated) ? buildSeatsForSection(updated, prev.seats.filter((s) => s.sectionId === objId)) : [];
        return { ...prev, sections: prev.sections.map((z) => (z.id === objId ? updated : z)), seats: [...prev.seats.filter((s) => s.sectionId !== objId), ...rebuilt] };
      }
      const element = prev.canvasElements.find((s) => s.id === objId);
      if (element && element.points.length > 3) {
        const nextPts = element.points.filter((p) => p.pointIndex !== idx).sort((a, b) => a.pointIndex - b.pointIndex).map((p, i) => ({ ...p, pointIndex: i }));
        const bounds = boundsFromPoints(nextPts);
        return { ...prev, canvasElements: prev.canvasElements.map((s) => (s.id === objId ? { ...s, points: nextPts, width: bounds.width, height: bounds.height } : s)) };
      }
      return prev;
    });
    setSelectedVertexIdx(-1);
  }, [setVenue]);

  const updateVertexPositionSilent = useCallback((objId: Id, idx: number, lx: number, ly: number) => {
    setVenueSilent((prev) => {
      const apply = (points: GeometryPoint[]) => {
        const ordered = [...points].sort((a, b) => a.pointIndex - b.pointIndex);
        if (idx < 0 || idx >= ordered.length) return null;
        ordered[idx] = { ...ordered[idx], x: lx, y: ly };
        return polygonSelfIntersects(ordered) ? null : ordered;
      };
      const section = prev.sections.find((z) => z.id === objId);
      if (section) { const next = apply(materializePoints(section)); if (!next) return prev; const bounds = boundsFromPoints(next); return { ...prev, sections: prev.sections.map((z) => (z.id === objId ? { ...z, points: next, width: bounds.width, height: bounds.height } : z)) }; }
      const element = prev.canvasElements.find((s) => s.id === objId);
      if (element) { const next = apply(materializePoints(element)); if (!next) return prev; const bounds = boundsFromPoints(next); return { ...prev, canvasElements: prev.canvasElements.map((s) => (s.id === objId ? { ...s, points: next, width: bounds.width, height: bounds.height } : s)) }; }
      return prev;
    });
  }, [setVenueSilent]);

  const updateCurveControlSilent = useCallback((objId: Id, edgeIdx: number, lx: number, ly: number) => {
    setVenueSilent((prev) => {
      const apply = (points: GeometryPoint[]) => {
        const ordered = [...points].sort((a, b) => a.pointIndex - b.pointIndex);
        if (edgeIdx < 0 || edgeIdx >= ordered.length) return null;
        ordered[edgeIdx] = { ...ordered[edgeIdx], controlX: lx, controlY: ly };
        return ordered;
      };
      const section = prev.sections.find((z) => z.id === objId);
      if (section) { const next = apply(materializePoints(section)); if (!next) return prev; const bounds = boundsFromPoints(next); return { ...prev, sections: prev.sections.map((z) => (z.id === objId ? { ...z, points: next, width: bounds.width, height: bounds.height } : z)) }; }
      const element = prev.canvasElements.find((s) => s.id === objId);
      if (element) { const next = apply(materializePoints(element)); if (!next) return prev; const bounds = boundsFromPoints(next); return { ...prev, canvasElements: prev.canvasElements.map((s) => (s.id === objId ? { ...s, points: next, width: bounds.width, height: bounds.height } : s)) }; }
      return prev;
    });
  }, [setVenueSilent]);

  const patchVertexBorderRadius = useCallback((objId: Id, idx: number, radius: number) => {
    setVenue((prev) => {
      const apply = (points: GeometryPoint[]) => {
        const ordered = [...points].sort((a, b) => a.pointIndex - b.pointIndex);
        if (idx < 0 || idx >= ordered.length) return null;
        ordered[idx] = { ...ordered[idx], borderRadius: Math.max(0, radius) };
        return ordered;
      };
      const section = prev.sections.find((z) => z.id === objId);
      if (section) { const next = apply(materializePoints(section)); if (!next) return prev; return { ...prev, sections: prev.sections.map((z) => (z.id === objId ? { ...z, points: next } : z)) }; }
      const element = prev.canvasElements.find((s) => s.id === objId);
      if (element) { const next = apply(materializePoints(element)); if (!next) return prev; return { ...prev, canvasElements: prev.canvasElements.map((s) => (s.id === objId ? { ...s, points: next } : s)) }; }
      return prev;
    });
  }, [setVenue]);

  /* ── Alta / baja de secciones y elementos ────────────────────────────── */
  const addSection = useCallback(() => {
    const center = getViewCenter();
    const { x, y } = findFreeSpot(venue, Math.round(center.x - 220 / 2), Math.round(center.y - 160 / 2), 220, 160);
    const { name, prefix } = uniqueSectionNaming(`Sección ${venue.sections.length + 1}`, venue.sections);
    const newId = uid("section");
    const section: Section = {
      id: newId, baseId: newId, venueId: venue.venue.id, floorId: activeFloorId,
      name, description: null, capacity: 150, status: "ACTIVE",
      color: sectionColorFor(venue.sections.length), prefix,
      coordinateX: x, coordinateY: y, width: 220, height: 160, rotationDegrees: 0, isEllipse: false, points: [],
      rowSeatCounts: [10], rowNames: ["A"], locked: false, lockAspect: false,
    };
    const seats = buildSeatsForSection(section, []);
    setVenue((prev) => ({ ...prev, sections: [...prev.sections, section], seats: [...prev.seats, ...seats] }));
    selectOnly(section.id);
    centerOn(x + 220 / 2, y + 160 / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue, setVenue, selectOnly, activeFloorId]);

  const addCanvasElement = useCallback((type: CanvasElementType) => {
    const center = getViewCenter();
    const size = type === "STAGE" ? { w: 260, h: 110 } : { w: 100, h: 100 };
    const { x, y } = findFreeSpot(venue, Math.round(center.x - size.w / 2), Math.round(center.y - size.h / 2), size.w, size.h);
    const element: CanvasElementModel = {
      id: uid("element"), floorId: activeFloorId, elementType: type,
      name: ELEMENT_TYPE_LABEL[type], color: ELEMENT_TYPE_DEFAULT_COLOR[type],
      coordinateX: x, coordinateY: y, width: size.w, height: size.h, rotationDegrees: 0,
      isEllipse: false, points: [], locked: false, lockAspect: false, status: true,
    };
    setVenue((prev) => ({ ...prev, canvasElements: [...prev.canvasElements, element] }));
    selectOnly(element.id);
    centerOn(x + size.w / 2, y + size.h / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue, setVenue, selectOnly, activeFloorId]);

  const deleteSection = useCallback((id: Id) => {
    setVenue((prev) => ({ ...prev, sections: prev.sections.filter((z) => z.id !== id), seats: prev.seats.filter((s) => s.sectionId !== id) }));
    setSelectedIds(new Set()); setVertexEditId(null);
  }, [setVenue]);

  const deleteSelected = useCallback(() => {
    setVenue((prev) => {
      const removedSectionIds = new Set(prev.sections.filter((z) => selectedIds.has(z.id)).map((z) => z.id));
      return { ...prev, sections: prev.sections.filter((z) => !selectedIds.has(z.id)), canvasElements: prev.canvasElements.filter((s) => !selectedIds.has(s.id)), seats: prev.seats.filter((s) => !selectedIds.has(s.id) && !removedSectionIds.has(s.sectionId)) };
    });
    setSelectedIds(new Set()); setVertexEditId(null); setSelectedVertexIdx(-1);
  }, [selectedIds, setVenue]);

  /* ── Portapapeles ─────────────────────────────────────────────────────── */
  const copySelection = useCallback(() => {
    clipboardRef.current = {
      sections: venue.sections.filter((z) => selectedIds.has(z.id)).map((z) => ({ ...z, points: z.points.map((p) => ({ ...p })) })),
      elements: venue.canvasElements.filter((s) => selectedIds.has(s.id)).map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })),
    };
    setHasClipboard(clipboardRef.current.sections.length > 0 || clipboardRef.current.elements.length > 0);
  }, [venue, selectedIds]);

  const pasteClipboard = useCallback(() => {
    const { sections: cs, elements: ce } = clipboardRef.current;
    if (cs.length === 0 && ce.length === 0) return;
    let pasted = false;
    let finalOffsetX = 0, finalOffsetY = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const z of cs) { if (z.coordinateX !== undefined && z.width && z.height) { minX = Math.min(minX, (z.coordinateX ?? 0)); minY = Math.min(minY, (z.coordinateY ?? 0)); maxX = Math.max(maxX, (z.coordinateX ?? 0) + z.width); maxY = Math.max(maxY, (z.coordinateY ?? 0) + z.height); } }
    for (const s of ce) { if (s.coordinateX !== undefined && s.width && s.height) { minX = Math.min(minX, s.coordinateX); minY = Math.min(minY, s.coordinateY); maxX = Math.max(maxX, s.coordinateX + s.width); maxY = Math.max(maxY, s.coordinateY + s.height); } }
    const initialOffsetX = minX !== Infinity ? (maxX - minX) + 50 : 50;
    setVenue((prev) => {
      let found = false, finalState = prev;
      let newIds = new Set<Id>();
      const STEP = 50;
      let dx = 1, dy = 0, gx = 0, gy = 0, count = 0, segment = 1;
      for (let i = 0; i < 10000; i++) {
        const offsetXV = initialOffsetX + gx * STEP;
        const offsetYV = gy * STEP;
        const newSections: Section[] = cs.map((z) => { const { name, prefix } = uniqueSectionNaming(z.name, prev.sections); return { ...z, id: uid("section"), name, prefix, floorId: activeFloorId, coordinateX: (z.coordinateX ?? 0) + offsetXV, coordinateY: (z.coordinateY ?? 0) + offsetYV, points: z.points.map((p) => ({ ...p, id: uid("pt") })) }; });
        const newElements: CanvasElementModel[] = ce.map((s) => ({ ...s, id: uid("element"), floorId: activeFloorId, coordinateX: s.coordinateX + offsetXV, coordinateY: s.coordinateY + offsetYV, points: s.points.map((p) => ({ ...p, id: uid("pt") })) }));
        const testState: PhysicalVenueState = { ...prev, sections: [...prev.sections, ...newSections], canvasElements: [...prev.canvasElements, ...newElements] };
        newIds = new Set([...newSections.map((z) => z.id), ...newElements.map((s) => s.id)]);
        if (!hasStructuralConflict(testState, newIds)) {
          found = true; finalOffsetX = offsetXV; finalOffsetY = offsetYV;
          let seats = prev.seats;
          for (const z of newSections) { if (sectionIsNumbered(z)) seats = [...seats, ...buildSeatsForSection(z, [])]; }
          finalState = { ...testState, seats };
          break;
        }
        gx += dx; gy += dy; count++;
        if (count === segment) { count = 0; const t = dx; dx = -dy; dy = t; if (dy === 0) segment++; }
      }
      if (found) { pasted = true; setSelectedIds(newIds); setVertexEditId(newIds.size === 1 ? [...newIds][0] : null); return finalState; }
      return prev;
    });
    if (pasted && minX !== Infinity) setTimeout(() => centerOnRef.current?.((minX + maxX) / 2 + finalOffsetX, (minY + maxY) / 2 + finalOffsetY), 50);
  }, [setVenue, activeFloorId]);

  const duplicateSelection = useCallback(() => { copySelection(); pasteClipboard(); }, [copySelection, pasteClipboard]);

  const replicateSectionToActiveFloor = useCallback((id: Id) => {
    setVenue((prev) => {
      const src = prev.sections.find((s) => s.id === id);
      if (!src) return prev;
      const newSection: Section = { ...src, id: uid("section"), baseId: src.baseId || src.id, floorId: activeFloorId, points: src.points.map((p) => ({ ...p, id: uid("pt") })) };
      const seats = buildSeatsForSection(newSection, []);
      const next = { ...prev, sections: [...prev.sections, newSection], seats: [...prev.seats, ...seats] };
      if (hasStructuralConflict(next, new Set([newSection.id]))) { window.alert("No se puede replicar la sección porque causaría una superposición en este piso."); return prev; }
      return next;
    });
  }, [activeFloorId, setVenue]);

  const replicateElementToActiveFloor = useCallback((id: Id) => {
    setVenue((prev) => {
      const src = prev.canvasElements.find((s) => s.id === id);
      if (!src) return prev;
      const newElement: CanvasElementModel = { ...src, id: uid("element"), baseId: src.baseId || src.id, floorId: activeFloorId, points: src.points.map((p) => ({ ...p, id: uid("pt") })) };
      const next = { ...prev, canvasElements: [...prev.canvasElements, newElement] };
      if (hasStructuralConflict(next, new Set([newElement.id]))) { window.alert("No se puede replicar el elemento porque causaría una superposición en este piso."); return prev; }
      return next;
    });
  }, [activeFloorId, setVenue]);

  /* ── Transformaciones ────────────────────────────────────────────────── */
  const rotateSelectionBy = useCallback((deg: number) => {
    const obb = computeSelectionOBB(venue.sections, venue.canvasElements, venue.seats, selectedIds);
    const center = obb ? { x: obb.cx, y: obb.cy } : { x: 0, y: 0 };
    setVenue((prev) => rotateSelection(prev, selectedIds, center, deg));
  }, [venue, selectedIds, setVenue]);

  const toggleLockSelection = useCallback(() => {
    setVenue((prev) => ({ ...prev, sections: prev.sections.map((z) => (selectedIds.has(z.id) ? { ...z, locked: !z.locked } : z)), canvasElements: prev.canvasElements.map((s) => (selectedIds.has(s.id) ? { ...s, locked: !s.locked } : s)) }));
  }, [selectedIds, setVenue]);

  /* ── Pisos ────────────────────────────────────────────────────────────── */
  const addFloor = useCallback(() => { setVenue((prev) => ({ ...prev, floors: [...prev.floors, { id: uid("floor"), venueId: prev.venue.id, name: `Piso ${prev.floors.length + 1}`, levelIndex: prev.floors.length }] })); }, [setVenue]);
  const renameFloor = useCallback((id: Id, name: string) => { setVenue((prev) => ({ ...prev, floors: prev.floors.map((f) => (f.id === id ? { ...f, name } : f)) })); }, [setVenue]);
  const removeFloor = useCallback((id: Id) => { setVenue((prev) => { if (prev.floors.length <= 1) return prev; const fallback = prev.floors.find((f) => f.id !== id)!.id; return { ...prev, floors: prev.floors.filter((f) => f.id !== id), sections: prev.sections.map((z) => (z.floorId === id ? { ...z, floorId: fallback } : z)), canvasElements: prev.canvasElements.map((s) => (s.floorId === id ? { ...s, floorId: fallback } : s)) }; }); }, [setVenue]);

  /* ── Import / Export ─────────────────────────────────────────────────── */
  const handleExportJSON = useCallback(() => downloadJSON(exportVenueEditorFile(venue), `${venue.venue.name || "recinto"}.json`), [venue]);
  const handleExportSVG = useCallback(() => {
    const svg = exportCanvasAsSvg(venue, (id) => venue.sections.find((z) => z.id === id)?.color || sectionColorFor(venue.sections.findIndex((z) => z.id === id)));
    downloadSvg(svg, `${venue.venue.name || "recinto"}.svg`);
  }, [venue]);
  const handleImportJSON = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const data = await readJSONFile<VenueEditorFile>(file);
      if (data.physical) {
        // Solo se trae la geometría (pisos/secciones/asientos/elementos): el
        // nombre/dirección/ciudad/capacidad del recinto ya se capturó en el
        // paso "Información general" y un import de canvas no debe pisarlo.
        setVenue((prev) => ({ ...data.physical, venue: prev.venue }));
        setSelectedIds(new Set()); setVertexEditId(null); setImportedFileName(file.name);
      } else window.alert("El archivo no contiene datos físicos válidos.");
    }
    catch { window.alert("Archivo JSON inválido."); }
    finally { e.target.value = ""; }
  }, [setVenue]);

  /* ── Dibujo del lienzo ────────────────────────────────────────────────── */
  const draw = useCallback((layers: PixiLayers) => {
    const { world, gridGfx, mainGfx, selectionGfx, handlesGfx, labelsLayer, rulerGfx, rulerTexts, app } = layers;
    drawGrid(gridGfx, world.scale.x);
    drawRuler(rulerGfx, rulerTexts, app, world);
    mainGfx.clear(); selectionGfx.clear(); handlesGfx.clear();
    const vp = getViewportWorldBounds();
    const visibleSections = venue.sections.filter((s) => s.floorId === activeFloorId);
    const visibleSectionIds = new Set(visibleSections.map(s => s.id));
    const visibleElements = venue.canvasElements.filter((e) => e.floorId === activeFloorId);
    const visibleSeats = venue.seats.filter((s) => visibleSectionIds.has(s.sectionId));
    // Ghost del otro piso
    venue.sections.filter((s) => s.floorId !== activeFloorId).forEach((z) => paintGeometricShape(mainGfx, { coordinateX: z.coordinateX ?? 0, coordinateY: z.coordinateY ?? 0, width: z.width ?? 0, height: z.height ?? 0, rotationDegrees: z.rotationDegrees, isEllipse: z.isEllipse, points: z.points }, 0xffffff, 0, 0.2));
    venue.canvasElements.filter((e) => e.floorId !== activeFloorId).forEach((el) => paintGeometricShape(mainGfx, { coordinateX: el.coordinateX, coordinateY: el.coordinateY, width: el.width ?? 0, height: el.height ?? 0, rotationDegrees: el.rotationDegrees, isEllipse: el.isEllipse, points: el.points }, 0xffffff, 0, 0.2));
    renderSections({ gfx: mainGfx, labelsLayer, labelPool: sectionLabelPoolRef.current, sections: visibleSections, selectedIds, vp, colorOf: (z, i) => z.color || sectionColorFor(i), showLabels: true, zoom: world.scale.x });
    renderCanvasElements({ gfx: mainGfx, labelsLayer, labelPool: elementLabelPoolRef.current, elements: visibleElements, selectedIds, vp, zoom: world.scale.x });
    renderSeats({ gfx: mainGfx, labelsLayer: null, labelPool: seatLabelPoolRef.current, seats: visibleSeats, selectedIds, vp, colorOf: (seat) => hexToInt(venue.sections.find((z) => z.id === seat.sectionId)?.color, 0x64748b), showLabels: false, zoom: world.scale.x });
    // Vértices
    if (vertexEditId) {
      const section = venue.sections.find((z) => z.id === vertexEditId);
      const element = venue.canvasElements.find((s) => s.id === vertexEditId);
      const target = section ?? element;
      if (target && !target.isEllipse) {
        const originX = section ? (section.coordinateX ?? 0) : (element as CanvasElementModel).coordinateX;
        const originY = section ? (section.coordinateY ?? 0) : (element as CanvasElementModel).coordinateY;
        const frame = { coordinateX: originX, coordinateY: originY, rotationDegrees: target.rotationDegrees };
        const pts = materializePoints(target).slice().sort((a, b) => a.pointIndex - b.pointIndex);
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i]; const w0 = localToWorld(frame, p.x, p.y); const isSel = i === selectedVertexIdx;
          handlesGfx.circle(w0.x, w0.y, isSel ? 6 : 4).fill({ color: isSel ? 0xffffff : BRAND_COLOR, alpha: 1 });
          if (p.controlX !== null && p.controlY !== null) {
            const cpw = localToWorld(frame, p.controlX, p.controlY);
            const nxt = pts[(i + 1) % pts.length]; const nxtW = localToWorld(frame, nxt.x, nxt.y);
            handlesGfx.moveTo(w0.x, w0.y).lineTo(cpw.x, cpw.y).stroke({ width: 1, color: 0x8b5cf6, alpha: 0.5 });
            handlesGfx.moveTo(cpw.x, cpw.y).lineTo(nxtW.x, nxtW.y).stroke({ width: 1, color: 0x8b5cf6, alpha: 0.5 });
            handlesGfx.rect(cpw.x - 4, cpw.y - 4, 8, 8).fill({ color: 0x8b5cf6, alpha: 1 });
          }
        }
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          let mx: number, my: number;
          if (a.controlX !== null && a.controlY !== null) { const mid = evalQuadBezier({ x: a.x, y: a.y }, { x: a.controlX, y: a.controlY }, { x: b.x, y: b.y }, 0.5); mx = mid.x; my = mid.y; } else { mx = (a.x + b.x) / 2; my = (a.y + b.y) / 2; }
          const w = localToWorld(frame, mx, my);
          handlesGfx.circle(w.x, w.y, 3).fill({ color: BRAND_COLOR, alpha: 0.5 });
        }
      }
    }
    // Caja de selección
    if (selectedIds.size > 0) {
      const obb = computeSelectionOBB(venue.sections, venue.canvasElements, venue.seats, selectedIds);
      if (obb) {
        const seatOnly = [...selectedIds].every((id) => venue.seats.some((s) => s.id === id));
        const anyLocked = [...selectedIds].some((id) => venue.sections.find((z) => z.id === id)?.locked || venue.canvasElements.find((s) => s.id === id)?.locked);
        drawSelectionBBox(handlesGfx, obb, !anyLocked, seatOnly);
      }
    }
    if (marqueeRef.current.active) drawMarquee(selectionGfx, marqueeRef.current.start.x, marqueeRef.current.start.y, marqueeRef.current.current.x, marqueeRef.current.current.y);
  }, [venue, selectedIds, vertexEditId, activeFloorId, selectedVertexIdx]);

  /* ── Interacción de puntero ──────────────────────────────────────────── */
  const handlePointerDown = useCallback((info: StagePointerInfo) => {
    if (tool !== "select") return;
    const world = info.world;
    const state = venue;
    if (vertexEditId) {
      const section = state.sections.find((z) => z.id === vertexEditId);
      const element = state.canvasElements.find((s) => s.id === vertexEditId);
      const target = section ?? element;
      if (target && !target.isEllipse) {
        const originX = section ? (section.coordinateX ?? 0) : (element as CanvasElementModel).coordinateX;
        const originY = section ? (section.coordinateY ?? 0) : (element as CanvasElementModel).coordinateY;
        const local = worldToLocal({ coordinateX: originX, coordinateY: originY, rotationDegrees: target.rotationDegrees }, world.x, world.y);
        const ordered = materializePoints(target).slice().sort((a, b) => a.pointIndex - b.pointIndex);
        for (let i = 0; i < ordered.length; i++) {
          const p = ordered[i];
          if (p.controlX !== null && p.controlY !== null && Math.hypot(p.controlX - local.x, p.controlY - local.y) < 9) { gestureRef.current = { ...EMPTY_GESTURE, mode: "curveDrag", vertexObjId: vertexEditId, curveEdgeIdx: i }; return; }
        }
        const vIdx = ordered.findIndex((p) => Math.hypot(p.x - local.x, p.y - local.y) < 9);
        if (vIdx >= 0) { setSelectedVertexIdx(vIdx); gestureRef.current = { ...EMPTY_GESTURE, mode: "vertexDrag", vertexObjId: vertexEditId, vertexIdx: vIdx }; return; }
        for (let i = 0; i < ordered.length; i++) {
          const j = (i + 1) % ordered.length; const a = ordered[i], b = ordered[j];
          let mx: number, my: number;
          if (a.controlX !== null && a.controlY !== null) { const mid = evalQuadBezier({ x: a.x, y: a.y }, { x: a.controlX, y: a.controlY }, { x: b.x, y: b.y }, 0.5); mx = mid.x; my = mid.y; } else { mx = (a.x + b.x) / 2; my = (a.y + b.y) / 2; }
          if (Math.hypot(mx - local.x, my - local.y) < 9) { insertVertexAtMidpoint(vertexEditId, j, snapVal(mx), snapVal(my)); return; }
        }
        setVertexEditId(null); setSelectedVertexIdx(-1);
      }
    }
    if (selectedIds.size > 0) {
      const obb = computeSelectionOBB(state.sections, state.canvasElements, state.seats, selectedIds);
      if (obb) {
        const anyLocked = [...selectedIds].some((id) => state.sections.find((z) => z.id === id)?.locked || state.canvasElements.find((s) => s.id === id)?.locked);
        if (!anyLocked) {
          const hit = hitTestBBoxHandle(obb, world);
          if (hit === "rotate") { gestureRef.current = { ...EMPTY_GESTURE, mode: "rotate", ids: new Set(selectedIds), origin: state, startWorld: world, obb, center: { x: obb.cx, y: obb.cy }, startAngle: Math.atan2(world.y - obb.cy, world.x - obb.cx) }; return; }
          if (hit !== null) { const seatOnly = [...selectedIds].every((id) => state.seats.some((s) => s.id === id)); if (!seatOnly) { gestureRef.current = { ...EMPTY_GESTURE, mode: "resize", ids: new Set(selectedIds), origin: state, startWorld: world, obb, corner: hit }; return; } }
        }
      }
    }
    const hit = hitTestAt(state, world, activeFloorId);
    if (hit) {
      let nextSel: Set<Id>;
      if (info.shiftKey || info.ctrlKey || info.metaKey) { nextSel = new Set(selectedIds); nextSel.has(hit.id) ? nextSel.delete(hit.id) : nextSel.add(hit.id); }
      else { nextSel = selectedIds.has(hit.id) ? new Set(selectedIds) : new Set([hit.id]); }
      selectMany(nextSel);
      const locked = state.sections.find((z) => z.id === hit.id)?.locked || state.canvasElements.find((s) => s.id === hit.id)?.locked;
      if (!locked) gestureRef.current = { ...EMPTY_GESTURE, mode: "drag", ids: nextSel, origin: state, startWorld: world };
    } else if (!(info.shiftKey || info.ctrlKey || info.metaKey)) {
      setSelectedIds(new Set()); setVertexEditId(null); setSelectedVertexIdx(-1);
      gestureRef.current = { ...EMPTY_GESTURE, mode: "marquee" };
      marqueeRef.current = { active: true, start: world, current: world };
    }
  }, [tool, venue, selectedIds, vertexEditId, selectMany, insertVertexAtMidpoint, snapVal, activeFloorId]);

  const handlePointerMove = useCallback((info: StagePointerInfo) => {
    const g = gestureRef.current; if (g.mode === "none") return;
    const world = info.world;
    if (g.mode === "marquee") { marqueeRef.current.current = world; requestRedrawRef.current(); return; }
    if (g.mode === "drag" && g.origin) { const dx = snapVal(world.x - g.startWorld.x), dy = snapVal(world.y - g.startWorld.y); const next = translateSelection(g.origin, g.ids, dx, dy); if (!hasStructuralConflict(next, g.ids)) setVenueSilent(next); return; }
    if (g.mode === "resize" && g.origin && g.obb && g.corner !== null) {
      const uniform = [...g.ids].some((id) => g.origin!.sections.find((z) => z.id === id)?.lockAspect || g.origin!.canvasElements.find((s) => s.id === id)?.lockAspect);
      const next = resizeSelection(g.origin, g.ids, g.obb, g.corner, world, snap, uniform); if (!hasStructuralConflict(next, g.ids)) setVenueSilent(next); return;
    }
    if (g.mode === "rotate" && g.origin && g.center) { const angle = Math.atan2(world.y - g.center.y, world.x - g.center.x); const deltaDeg = ((angle - g.startAngle) * 180) / Math.PI; const next = rotateSelection(g.origin, g.ids, g.center, deltaDeg); if (!hasStructuralConflict(next, g.ids)) setVenueSilent(next); return; }
    if (g.mode === "vertexDrag" && g.vertexObjId) {
      const target = venue.sections.find((z) => z.id === g.vertexObjId) ?? venue.canvasElements.find((s) => s.id === g.vertexObjId); if (!target) return;
      const originX = (target as Section).coordinateX ?? (target as CanvasElementModel).coordinateX ?? 0;
      const originY = (target as Section).coordinateY ?? (target as CanvasElementModel).coordinateY ?? 0;
      const local = worldToLocal({ coordinateX: originX, coordinateY: originY, rotationDegrees: target.rotationDegrees }, world.x, world.y);
      updateVertexPositionSilent(g.vertexObjId, g.vertexIdx, snapVal(local.x), snapVal(local.y)); return;
    }
    if (g.mode === "curveDrag" && g.vertexObjId) {
      const target = venue.sections.find((z) => z.id === g.vertexObjId) ?? venue.canvasElements.find((s) => s.id === g.vertexObjId); if (!target) return;
      const originX = (target as Section).coordinateX ?? (target as CanvasElementModel).coordinateX ?? 0;
      const originY = (target as Section).coordinateY ?? (target as CanvasElementModel).coordinateY ?? 0;
      const local = worldToLocal({ coordinateX: originX, coordinateY: originY, rotationDegrees: target.rotationDegrees }, world.x, world.y);
      updateCurveControlSilent(g.vertexObjId, g.curveEdgeIdx, local.x, local.y);
    }
  }, [venue, snap, snapVal, setVenueSilent, updateVertexPositionSilent, updateCurveControlSilent]);

  const handlePointerUp = useCallback((_info: StagePointerInfo) => {
    const g = gestureRef.current;
    if (g.mode === "marquee") {
      const m = marqueeRef.current;
      if (m.active) {
        const x1 = Math.min(m.start.x, m.current.x), x2 = Math.max(m.start.x, m.current.x);
        const y1 = Math.min(m.start.y, m.current.y), y2 = Math.max(m.start.y, m.current.y);
        const ids = new Set<Id>();
        const validSectionIds = new Set(venue.sections.filter((z) => z.floorId === activeFloorId).map((z) => z.id));
        for (const z of venue.sections) { if (z.floorId !== activeFloorId) continue; const cx = (z.coordinateX ?? 0) + (z.width ?? 0) / 2; const cy = (z.coordinateY ?? 0) + (z.height ?? 0) / 2; if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) ids.add(z.id); }
        for (const s of venue.canvasElements) { if (s.floorId !== activeFloorId) continue; const cx = s.coordinateX + (s.width ?? 0) / 2; const cy = s.coordinateY + (s.height ?? 0) / 2; if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) ids.add(s.id); }
        for (const s of venue.seats) if (validSectionIds.has(s.sectionId) && (s.coordinateX ?? 0) >= x1 && (s.coordinateX ?? 0) <= x2 && (s.coordinateY ?? 0) >= y1 && (s.coordinateY ?? 0) <= y2) ids.add(s.id);
        selectMany(ids);
      }
      marqueeRef.current = { active: false, start: { x: 0, y: 0 }, current: { x: 0, y: 0 } };
      requestRedrawRef.current();
    } else if (g.mode === "drag" || g.mode === "rotate") { settle(); }
    else if (g.mode === "resize") { settle(); const resizedIds = g.ids; setVenue((prev) => { const resizedSectionIds = new Set([...resizedIds].filter((id) => prev.sections.some((z) => z.id === id))); return resizedSectionIds.size > 0 ? regenerateSeatsFor(prev, resizedSectionIds) : prev; }); }
    else if (g.mode === "vertexDrag" || g.mode === "curveDrag") { settle(); const objId = g.vertexObjId; if (objId) setVenue((prev) => (prev.sections.some((z) => z.id === objId) ? regenerateSeatsFor(prev, new Set([objId])) : prev)); }
    gestureRef.current = EMPTY_GESTURE;
  }, [venue, selectMany, settle, setVenue, activeFloorId]);

  const requestRedrawRef = useRef<() => void>(() => { });
  const { ready, zoom, requestRedraw, zoomBy, fitToBounds, centerOn, getViewCenter, getViewportWorldBounds } = usePixiStage(containerRef, {
    panWithLeftClick: tool === "pan", showGrid: true, showRuler: true,
    onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp,
    onWheelZoomChange: () => requestRedrawRef.current(),
  }, draw);
  requestRedrawRef.current = requestRedraw;
  centerOnRef.current = centerOn;
  useEffect(() => { requestRedraw(); }, [venue, selectedIds, vertexEditId, selectedVertexIdx, activeFloorId, requestRedraw]);

  /* ── Atajos de teclado — FIX: nudge direction corrected ──────────────── */
  useKeyboardShortcuts({
    onDelete: deleteSelected,
    onSelectAll: () => {
      const ids = new Set<Id>();
      const validSectionIds = new Set(venue.sections.filter((z) => z.floorId === activeFloorId).map((z) => z.id));
      venue.sections.forEach((z) => { if (z.floorId === activeFloorId) ids.add(z.id); });
      venue.canvasElements.forEach((s) => { if (s.floorId === activeFloorId) ids.add(s.id); });
      venue.seats.forEach((s) => { if (validSectionIds.has(s.sectionId)) ids.add(s.id); });
      selectMany(ids);
    },
    onUndo: undo, onRedo: redo,
    onCopy: copySelection, onPaste: pasteClipboard, onDuplicate: duplicateSelection,
    onEscape: () => { setVertexEditId(null); setSelectedVertexIdx(-1); setSelectedIds(new Set()); },
    onZoomIn: () => zoomBy(1.2), onZoomOut: () => zoomBy(0.8),
    onFitView: () => fitToBounds(computeVenueBounds(venue)),
    onNudge: (dx, dy, coarse) => {
      if (selectedIds.size === 0) return;
      // FIX: coarse (shift) = movimiento grande, normal = snap
      const amount = coarse ? snap * 5 : snap;
      setVenue((prev) => {
        const candidate = translateSelection(prev, selectedIds, dx * amount, dy * amount);
        if (hasStructuralConflict(candidate, selectedIds)) return prev;
        return candidate;
      });
    },
    onToolSelect: () => setTool("select"), onToolPan: () => setTool("pan"),
  });

  /* ── Render ───────────────────────────────────────────────────────────── */
  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null;
  const selectedSection = selectedId ? venue.sections.find((z) => z.id === selectedId) : undefined;
  const selectedElement = selectedId ? venue.canvasElements.find((s) => s.id === selectedId) : undefined;
  const selectedSeat = selectedId ? venue.seats.find((s) => s.id === selectedId) : undefined;
  const isNumbered = selectedSection ? sectionIsNumbered(selectedSection) : false;

  // Auto-calcular totalCapacity
  const totalCapacity = venue.sections.reduce((sum, s) => {
    if (sectionIsNumbered(s)) return sum + venue.seats.filter(st => st.sectionId === s.id).length;
    return sum + s.capacity;
  }, 0);

  const isDesktop = useIsDesktop();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [floorsPanelOpen, setFloorsPanelOpen] = useState(false);

  // Auto-abrir panel derecho dependiendo de si hay selección
  useEffect(() => {
    if (selectedIds.size > 0) {
      setRightOpen(true);
    }
  }, [selectedIds.size]);

  return (
    // Contenedor principal de la pantalla
    <div className="h-full flex flex-col gap-3">
      <div className="flex flex-col gap-3 shrink-0">
        {/* Fila 1: Título y Botón principal */}
        <div className="flex flex-row items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 items-center">
              <h2>{venue.venue.name || (mode === "update" ? "Editar distribución de zonas" : "Nuevo recinto")}</h2>

              <div className="flex gap-1 items-center">

                <Tooltip>
                  <Button
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    onPress={() => fileInputRef.current?.click()}
                  >
                    <Upload />
                  </Button>
                  <Tooltip.Content showArrow offset={12}>
                    <Tooltip.Arrow />
                    <span>Importar</span>
                  </Tooltip.Content>
                </Tooltip>

                <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportJSON} className="hidden" />

                <Dropdown>
                  <Tooltip>
                    <Button isIconOnly
                      variant="ghost"
                      size="sm"
                    >
                      <Download />
                    </Button>
                    <Tooltip.Content showArrow offset={12}>
                      <Tooltip.Arrow />
                      <span>Exportar</span>
                    </Tooltip.Content>
                  </Tooltip>

                  <Dropdown.Popover placement="bottom end" className="min-w-0">
                    <Dropdown.Menu>
                      <Dropdown.Item
                        id="json"
                        textValue="Como JSON"
                        onAction={handleExportJSON}
                      >
                        <div className="flex flex-col gap-1">
                          <Label>Exportar como JSON</Label>
                          <Description>Formato apto para editar</Description>
                        </div>
                      </Dropdown.Item>
                      <Dropdown.Item
                        id="svg"
                        textValue="Como SVG"
                        onAction={handleExportSVG}
                      >
                        <div className="flex flex-col gap-1">
                          <Label>Exportar como SVG</Label>
                          <Description>Formato solo ilustrativo</Description>
                        </div>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              </div>
              {importedFileName && <Description><Icon.FileBracesCorner /> {importedFileName}</Description>}

            </div>
            <div className="flex gap-1 items-center">
              <Chip variant="primary" className="shrink-0"> {venue.floors.length} {venue.floors.length === 1 ? 'Piso' : 'Pisos'}</Chip>
              <Chip variant="primary" className="shrink-0"> {venue.sections.length} {venue.sections.length === 1 ? 'Sección' : 'Secciones'}</Chip>
              <Chip variant="primary" className="shrink-0"> {venue.canvasElements.length} {venue.canvasElements.length === 1 ? 'Elemento' : 'Elementos'}</Chip>
              <Chip variant="primary" className="shrink-0"> {venue.seats.length} {venue.seats.length === 1 ? 'Lugar' : 'Lugares'} </Chip>
            </div>

          </div>

          <div className="flex gap-1 items-center">
            {onCancel && (
              <Button variant="secondary" onPress={onCancel} isDisabled={saving}>
                Cancelar
              </Button>
            )}
            <Button onPress={() => { if (!saving) onSave?.(venue); }} isDisabled={saving}>
              {saving ? (
                <><Spinner size="sm" /> Guardando…</>
              ) : mode === "create" ? (
                <><Plus /> Registrar</>
              ) : (
                <><Save /> Guardar cambios</>
              )}
            </Button>
          </div>
        </div>


      </div>

      {/* Contenedor Combinado de Fila 2 (Tabs) + Canvas */}
      <div className="flex flex-col gap-3 flex-1 min-h-0">

        {/* Fila 2: Movida adentro para unificarse con el Canvas */}
        <div className="flex flex-row items-center gap-1 p-2 shrink-0 bg-surface shadow-surface rounded-[10px] w-full overflow-x-auto scrollbar-none">
          <Tooltip>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="shrink-0"
              onPress={() => setLeftOpen(!leftOpen)}
            >
              {leftOpen ? <PanelRightOpen /> : <PanelLeftOpen />}
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span>{leftOpen ? 'Ocultar panel izquierdo' : 'Mostrar panel izquierdo'}</span>
            </Tooltip.Content>
          </Tooltip>
          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />

          <div className="flex-1 min-w-40 flex items-center flex gap-1">
            <ScrollShadow orientation="horizontal" hideScrollBar className="min-w-0">
              <Tabs
                variant="secondary"
                selectedKey={activeFloorId}
                onSelectionChange={(key) => handleFloorChange(key as string)}
              >
                <Tabs.ListContainer className="border-none">
                  <Reorder.Group
                    axis="x"
                    values={localFloors.map(f => f.id)}
                    onReorder={(newIds) => {
                      const next = newIds.map(id => localFloors.find(f => f.id === id)!);
                      setLocalFloors(next);
                    }}
                  >
                    <Tabs.List aria-label="Pisos">
                      {localFloors.map((floor) => (
                        <Tooltip key={floor.id}>
                          <Tabs.Tab id={floor.id} className="w-max px-0 h-9">
                            <Reorder.Item
                              value={floor.id}
                              onDragEnd={() => {
                                React.startTransition(() => {
                                  setVenue((prev) => ({
                                    ...prev,
                                    floors: localFloors.map((f, i) => ({ ...f, levelIndex: i })),
                                  }));
                                });
                              }}
                              as="div"
                              className="px-3 h-full flex items-center justify-center cursor-grab active:cursor-grabbing w-max relative"
                            >
                              <span className="relative z-10">{floor.name}</span>
                              <Tabs.Indicator className="bg-default size-full rounded-[10px]" />
                            </Reorder.Item>
                          </Tabs.Tab>
                          <Tooltip.Content showArrow offset={12} className="p-0 h-40 aspect-video">
                            <Tooltip.Arrow />
                            <StaticMiniMap venue={venue} floorId={floor.id} isSelected={activeFloorId === floor.id} />
                          </Tooltip.Content>
                        </Tooltip>
                      ))}
                    </Tabs.List>
                  </Reorder.Group>
                </Tabs.ListContainer>
              </Tabs>
            </ScrollShadow>

            <Tooltip>
              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                onPress={addFloor}
                className="shrink-0"
              >
                <Plus />
              </Button>
              <Tooltip.Content showArrow offset={12}>
                <Tooltip.Arrow />
                <span>Agregar piso</span>
              </Tooltip.Content>
            </Tooltip>
          </div>


          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />

          <Tooltip>
            <ToggleButton
              isSelected={tool === "select"}
              onChange={() => setTool("select")}
              isIconOnly
              variant="ghost"
              size="sm"
              className="shrink-0"
            >
              <MousePointer2 />
            </ToggleButton>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">
                Seleccionar
                <Kbd>
                  <Kbd.Content>S</Kbd.Content>
                </Kbd>
              </span>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip>
            <ToggleButton
              isSelected={tool === "pan"}
              onChange={() => setTool("pan")}
              isIconOnly
              variant="ghost"
              size="sm"
              className="shrink-0"
            >
              <Hand />
            </ToggleButton>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">
                Mover lienzo
                <Kbd>
                  <Kbd.Content>H</Kbd.Content>
                </Kbd>
              </span>
            </Tooltip.Content>
          </Tooltip>
          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />

          <Tooltip>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="shrink-0"
              onPress={() => fitToBounds(computeVenueBounds(venue))}
            >
              <LocateFixed />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">
                Ajustar a la vista
                <Kbd>
                  <Kbd.Abbr keyValue="ctrl" />
                  <Kbd.Content>0</Kbd.Content>
                </Kbd>
              </span>
            </Tooltip.Content>
          </Tooltip>
          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />



          {(() => {
            if (selectedIds.size !== 1) return null;
            const id = Array.from(selectedIds)[0];
            const selectedSection = venue.sections.find((s) => s.id === id);
            const selectedElement = venue.canvasElements.find((e) => e.id === id);
            const item = selectedSection || selectedElement;
            if (!item) return null;

            return (
              <>
                <Select
                  className="w-36"
                  variant="secondary"
                  aria-label="Forma"
                  value={item.isEllipse ? "ELLIPSE" : "RECTANGLE"}
                  onChange={(v) => {
                    const wantEllipse = v === "ELLIPSE";
                    if (wantEllipse !== item.isEllipse) {
                      toggleEllipse(item.id, !!selectedSection);
                    }
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="RECTANGLE" textValue="Rectangular">
                        <div className="flex items-center gap-2">
                          <Square />
                          <span>Rectangular</span>
                        </div>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>

                      <ListBox.Item id="ELLIPSE" textValue="Circular">
                        <div className="flex items-center gap-2">
                          <Circle />
                          <span>Circular</span>
                        </div>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>

                <Tooltip>
                  <div>
                    <ColorField
                      value={item.color || (selectedSection ? "#2563eb" : "#475569")}
                      onCommit={(v) => {
                        if (selectedSection) patchSection(selectedSection.id, { color: v });
                        else if (selectedElement) patchElement(selectedElement.id, { color: v });
                      }}
                    /></div>
                  <Tooltip.Content showArrow offset={12}>
                    <Tooltip.Arrow />
                    <span>Color</span>
                  </Tooltip.Content>
                </Tooltip>

                <Tooltip>
                  <ToggleButton
                    isIconOnly
                    variant="ghost"
                    size="sm"

                    className="shrink-0"
                    isSelected={!!item.locked}
                    onChange={(val) => {
                      if (selectedSection) patchSection(selectedSection.id, { locked: val });
                      else if (selectedElement) patchElement(selectedElement.id, { locked: val });
                    }}
                  >
                    {(props: any) => props.isSelected ? <LockKeyhole /> : <LockKeyholeOpen />}
                  </ToggleButton>
                  <Tooltip.Content showArrow offset={12}>
                    <Tooltip.Arrow />
                    <span>Bloquear posición</span>
                  </Tooltip.Content>
                </Tooltip>

                <Tooltip>
                  <ToggleButton
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    isSelected={!!item.lockAspect}
                    onChange={(val) => {
                      if (selectedSection) patchSection(selectedSection.id, { lockAspect: val });
                      else if (selectedElement) patchElement(selectedElement.id, { lockAspect: val });
                    }}
                  >
                    {(props: any) => props.isSelected ? <Link /> : <Unlink />}
                  </ToggleButton>
                  <Tooltip.Content showArrow offset={12}>
                    <Tooltip.Arrow />
                    <span>Bloquear proporción</span>
                  </Tooltip.Content>
                </Tooltip>

                <Tooltip>
                  <ToggleButton
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    isDisabled={selectedVertexIdx < 0 || !!item.isEllipse}
                    isSelected={(() => {
                      if (selectedVertexIdx < 0 || item.isEllipse || !item.points) return false;
                      const pt = item.points.find(p => p.pointIndex === selectedVertexIdx);
                      return pt ? (pt.controlX !== null && pt.controlY !== null) : false;
                    })()}
                    onChange={() => {
                      if (selectedVertexIdx >= 0) toggleCurveOnEdge(item.id, selectedVertexIdx);
                    }}
                  >
                    <Spline />
                  </ToggleButton>
                  <Tooltip.Content showArrow offset={12}>
                    <Tooltip.Arrow />
                    <span>Curvar | Enderezar</span>
                  </Tooltip.Content>
                </Tooltip>

                <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />
              </>
            );
          })()}

          <Tooltip>
            <Button
              isIconOnly
              variant="ghost"

              className="shrink-0"
              size="sm"
              onPress={copySelection}
              isDisabled={selectedIds.size === 0}
            >
              <Copy />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">
                Copiar
                <Kbd>
                  <Kbd.Abbr keyValue="ctrl" />
                  <Kbd.Content>C</Kbd.Content>
                </Kbd>
              </span>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="shrink-0"
              onPress={pasteClipboard}
              isDisabled={!hasClipboard}
            >
              <ClipboardPaste />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">
                Pegar
                <Kbd>
                  <Kbd.Abbr keyValue="ctrl" />
                  <Kbd.Content>V</Kbd.Content>
                </Kbd>
              </span>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="shrink-0"
              onPress={duplicateSelection}
              isDisabled={selectedIds.size === 0}
            >
              <ClipboardPlus />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">
                Duplicar
                <Kbd>
                  <Kbd.Abbr keyValue="ctrl" />
                  <Kbd.Content>D</Kbd.Content>
                </Kbd>
              </span>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              onPress={deleteSelected}
              isDisabled={selectedIds.size === 0}
              className="shrink-0 text-destructive"
            >
              <Trash2 className="text-danger" />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">
                Eliminar
                <Kbd>
                  <Kbd.Content>Del</Kbd.Content>
                </Kbd>
              </span>
            </Tooltip.Content>
          </Tooltip>
          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />

          <Tooltip>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="shrink-0"
              onPress={undo}
              isDisabled={!canUndo}
            >
              <Undo2 />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">
                Deshacer
                <Kbd>
                  <Kbd.Abbr keyValue="ctrl" />
                  <Kbd.Content>Z</Kbd.Content>
                </Kbd>
              </span>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="shrink-0"
              onPress={redo}
              isDisabled={!canRedo}
            >
              <Redo2 />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">
                Rehacer
                <Kbd>
                  <Kbd.Abbr keyValue="ctrl" />
                  <Kbd.Content>Y</Kbd.Content>
                </Kbd>
              </span>
            </Tooltip.Content>
          </Tooltip>

          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />

          <Tooltip>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="shrink-0"
              onPress={() => zoomBy(1.2)}
            >
              <ZoomIn />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">
                Acercar
                <Kbd>
                  <Kbd.Content>+</Kbd.Content>
                </Kbd>
              </span>
            </Tooltip.Content>
          </Tooltip>

          <NumberField
            variant="secondary"
            minValue={20}
            maxValue={1000}
            step={1}
            value={Math.round(zoom * 100)}
            onChange={(v) => {
              if (v > 0 && zoom > 0) {
                zoomBy((v / 100) / zoom);
              }
            }}
          >
            <NumberField.Group className="grid-cols-[1fr_auto]">
              <NumberField.Input className="text-center w-15 text-sm" />
              <p className="flex text-field-placeholder text-sm pr-3 items-center">
                %
              </p>
            </NumberField.Group>
          </NumberField>
          <Tooltip>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="shrink-0"
              onPress={() => zoomBy(0.8)}
            >
              <ZoomOut />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">
                Alejar
                <Kbd>
                  <Kbd.Content>-</Kbd.Content>
                </Kbd>
              </span>
            </Tooltip.Content>
          </Tooltip>
          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />

          <NumberField
            variant="secondary"
            minValue={1}
            maxValue={100}
            step={1}
            value={snap}
            onChange={(v) => setSnap(Math.max(1, v))}
          >
            <NumberField.Group className="grid-cols-[auto_1fr_auto]">
              <p className="flex text-field-placeholder pl-3 items-center">
                <SquareSquare /> </p>
              <NumberField.Input className="text-center w-12 text-sm" />
              <p className="flex text-field-placeholder text-sm pr-3 items-center">
                px              </p>
            </NumberField.Group>
          </NumberField>

          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />


          <Tooltip>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="shrink-0"
              onPress={() => setRightOpen(!rightOpen)}
            >
              {rightOpen ? <PanelLeftOpen /> : <PanelRightOpen />}
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span>{rightOpen ? 'Ocultar panel derecho' : 'Mostrar panel derecho'}</span>
            </Tooltip.Content>
          </Tooltip>
        </div>

        {/* Contenedor Base Relativo (Actúa como borde/padding de 4px con p-1) */}
        <main className="relative flex-1 overflow-hidden w-full h-full flex flex-row">

          {/* Instancia de tu Panel Izquierdo (Respeta espacio en este flex) */}
          <Panel
            isOpen={leftOpen}
            onOpenChange={setLeftOpen}
            isDrawer={!isDesktop}
            placement="left"
            className="pointer-events-auto"
          >
            {(() => {
              const activeFloor = venue.floors.find(f => f.id === activeFloorId);
              if (!activeFloor) return null;

              const normalizedSearch = searchQuery.toLowerCase().trim();
              const floorSections = venue.sections.filter(s => s.floorId === activeFloorId && (!normalizedSearch || (s.name || "").toLowerCase().includes(normalizedSearch)));
              const floorElements = venue.canvasElements.filter(e => e.floorId === activeFloorId && (!normalizedSearch || (e.name || "").toLowerCase().includes(normalizedSearch)));

              return (
                <div className="flex flex-col h-full">
                  <div className="px-4 py-4 flex flex-col gap-3 min-h-0 flex-1">
                    <div className="flex gap-1">
                      <div className="pt-1 flex flex-col gap-3 w-full">
                        <div className="flex justify-between gap-4">
                          <h4 className="line-clamp-3">{activeFloor.name}</h4>

                          <Dropdown>
                            <Tooltip>
                              <Dropdown.Trigger>
                                <Button isIconOnly variant="ghost" size="sm" className="shrink-0">
                                  <Plus />
                                </Button>
                              </Dropdown.Trigger>
                              <Tooltip.Content showArrow offset={12}>
                                <Tooltip.Arrow />
                                <span>Agregar sección | elemento</span>
                              </Tooltip.Content>
                            </Tooltip>

                            <Dropdown.Popover placement="bottom start">
                              <Dropdown.Menu>
                                <Dropdown.Item key="section" textValue="Agregar sección" onAction={() => addSection()}>
                                  Agregar sección
                                </Dropdown.Item>

                                <Dropdown.SubmenuTrigger>
                                  <Dropdown.Item key="element" textValue="Agregar elemento">
                                    Agregar elemento
                                    <Dropdown.SubmenuIndicator>
                                      <ChevronRight />
                                    </Dropdown.SubmenuIndicator>
                                  </Dropdown.Item>
                                  <Dropdown.Popover >
                                    <Dropdown.Menu>
                                      {(Object.keys(ELEMENT_TYPE_LABEL) as CanvasElementType[]).map((t) => {
                                        const Icon = ELEMENT_ICONS[t];
                                        return (
                                          <Dropdown.Item
                                            key={t}
                                            id={t}
                                            textValue={ELEMENT_TYPE_LABEL[t]}
                                            onAction={() => addCanvasElement(t)}
                                          >
                                            <div className="flex items-center gap-2">
                                              <Icon />
                                              {ELEMENT_TYPE_LABEL[t]}
                                            </div>
                                          </Dropdown.Item>
                                        );
                                      })}
                                    </Dropdown.Menu>
                                  </Dropdown.Popover>
                                </Dropdown.SubmenuTrigger>
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown>
                        </div>
                        <SearchField
                          name="search-custom"
                          variant="secondary"
                          className="flex-1"
                          value={searchQuery}
                          onChange={setSearchQuery}
                        >
                          <SearchField.Group>
                            <SearchField.SearchIcon>
                              <Search />
                            </SearchField.SearchIcon>
                            <SearchField.Input placeholder="Buscar secciones | elementos..." />
                            <SearchField.ClearButton>
                              <X />
                            </SearchField.ClearButton>
                          </SearchField.Group>
                        </SearchField>
                      </div>

                    </div>



                    {floorSections.length === 0 && floorElements.length === 0 && <div className="flex flex-1 flex-col items-center justify-center p-4 text-center gap-1">
                      <Label>No hay nada aún</Label>
                      <Description>Agrega una sección o elemento presionando el botón de más</Description>
                    </div>}

                    <ScrollShadow className="flex flex-col gap-3 -mx-2 overflow-y-auto overflow-x-hidden px-2 pb-2">
                      {floorSections.map((z) => {
                        const sectionSeats = venue.seats.filter(s => s.sectionId === z.id);
                        const seatCount = sectionSeats.length;
                        const standard = sectionSeats.filter(s => s.type === "STANDARD").length;
                        const vip = sectionSeats.filter(s => s.type === "VIP").length;
                        const premium = sectionSeats.filter(s => s.type === "PREMIUM").length;
                        const accessible = sectionSeats.filter(s => s.type === "ACCESSIBLE").length;
                        const available = sectionSeats.filter(s => s.status === "AVAILABLE").length;

                        return (
                          <button
                            key={z.id}
                            type="button"
                            onClick={() => selectOnly(z.id)}
                            className={` text-left w-full rounded-[10px] cursor-pointer flex flex-col transition-all duration-300 group active:outline-none ${selectedIds.has(z.id) ? "bg-default" : "bg-default-soft"}`}
                          >
                            {/* Image Section */}
                            <div className="w-full h-28 rounded-[10px] relative shrink-0 overflow-hidden flex flex-col items-center justify-center">
                              {seatCount > 0 ? (
                                <StaticSectionPreview section={z} seats={sectionSeats} />
                              ) : (
                                <div className="flex items-center justify-center text-muted">
                                  <Layers className="size-8 opacity-20" />
                                </div>
                              )}

                              <div onClick={(e) => e.stopPropagation()} className="absolute top-2 left-2 z-10 flex items-center shrink-0">
                                <Checkbox variant="secondary" isSelected={selectedIds.has(z.id)} onChange={() => {
                                  const next = new Set(selectedIds);
                                  if (next.has(z.id)) next.delete(z.id);
                                  else next.add(z.id);
                                  selectMany(next);
                                }}>
                                  <Checkbox.Content>
                                    <Checkbox.Control>
                                      <Checkbox.Indicator />
                                    </Checkbox.Control>
                                  </Checkbox.Content>
                                </Checkbox>
                              </div>

                              <Chip size="sm" variant="primary" className="absolute top-2 right-2 z-10">{seatCount > 0 ? (
                                <>
                                  {seatCount}
                                  <Armchair />
                                </>
                              ) : (
                                <>
                                  {z.capacity}
                                  <Users />
                                </>
                              )}</Chip>
                            </div>

                            {/* Content Section */}
                            <div className="p-2 flex flex-col justify-between flex-1 w-full">
                              <div className="flex gap-2 justify-between items-end pb-2">
                                <Label className="flex-1 min-w-0 line-clamp-1">
                                  {z.name}
                                  {z.prefix && (
                                    <Description className="ml-1 inline-flex">{z.prefix}</Description>
                                  )}
                                </Label>
                                <Chip
                                  size="sm"
                                  variant="soft"
                                  color={z.status === "ACTIVE" ? "success" : z.status === "REMOVED" ? "danger" : "default"}
                                  className="shrink-0"
                                >
                                  {z.status === "ACTIVE" ? "Activa" : z.status === "REMOVED" ? "Removida" : "Inactiva"}
                                </Chip>
                              </div>

                              {seatCount > 0 && (
                                <ScrollShadow className="flex gap-1 pr-0" orientation="horizontal" hideScrollBar>
                                  <Chip size="sm" variant="primary">{standard} Estándar</Chip>
                                  <Chip size="sm" variant="primary">{premium} Premium</Chip>
                                  <Chip size="sm" variant="primary">{accessible} Accesible</Chip>
                                  <Chip size="sm" variant="primary">{vip} VIP</Chip>
                                </ScrollShadow>
                              )}
                            </div>
                          </button>
                        );
                      })}

                      {floorElements.map((s) => {
                        const Icon = ELEMENT_ICONS[s.elementType];
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => selectOnly(s.id)}
                            className={` text-left w-full rounded-[10px] cursor-pointer flex flex-col transition-all duration-300 group active:outline-none ${selectedIds.has(s.id) ? "bg-default" : "bg-default-soft"}`}
                          >
                            {/* Image Section */}
                            <div className="w-full h-28 rounded-[10px] relative shrink-0 overflow-hidden flex flex-col items-center justify-center">
                              <div className="flex items-center justify-center text-muted">
                                <Icon className="size-12 opacity-50" style={{ color: s.color || undefined }} />
                              </div>

                              <div onClick={(e) => e.stopPropagation()} className="absolute top-2 left-2 z-10 flex items-center shrink-0">
                                <Checkbox variant="secondary" isSelected={selectedIds.has(s.id)} onChange={() => {
                                  const next = new Set(selectedIds);
                                  if (next.has(s.id)) next.delete(s.id);
                                  else next.add(s.id);
                                  selectMany(next);
                                }}>
                                  <Checkbox.Content>
                                    <Checkbox.Control>
                                      <Checkbox.Indicator />
                                    </Checkbox.Control>
                                  </Checkbox.Content>
                                </Checkbox>
                              </div>

                              <Chip size="sm" variant="primary" className="absolute top-2 right-2 z-10">
                                {ELEMENT_TYPE_LABEL[s.elementType]}
                              </Chip>
                            </div>

                            {/* Content Section */}
                            <div className="p-2 flex flex-col justify-between flex-1 w-full">
                              <div className="flex gap-2 justify-between items-center">
                                <Label className="flex-1 min-w-0 line-clamp-1">
                                  {s.name}
                                </Label>
                                <Chip
                                  size="sm"
                                  variant="soft"
                                  color={s.status ? "success" : "default"}
                                  className="shrink-0"
                                >
                                  {s.status ? "Activo" : "Inactivo"}
                                </Chip>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </ScrollShadow>
                  </div>

                </div>
              );
            })()}
          </Panel>

          {/* Wrapper interno del canvas para respetar el padding y bordes redondeados */}
          <div className="relative flex-1 rounded-[10px] overflow-hidden bg-surface shadow-surface">

            {/* ======================================================== */}
            {/* CAPA 1: EL CANVAS (Fondo completo e imperturbable)         */}
            {/* ======================================================== */}
            <div
              className="absolute inset-0 z-0 bg-surface"
              ref={containerRef}
            ></div>

            {/* Capa de carga bloqueante (Solo cubre el fondo si no está listo) */}
            {!ready && (
              <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto">
                <Spinner />
              </div>
            )}

            {/* Indicador de guardado (esquina inferior derecha): onSave hace una
                cascada de requests que en recintos grandes tarda varios
                segundos, esto evita que parezca que la app se colgó. */}
            {saving && (
              <div className="absolute bottom-4 right-4 z-50 flex items-center gap-2 bg-surface border border-border rounded-full pl-3 pr-4 py-2 shadow-lg pointer-events-none">
                <Spinner size="sm" />
                <span className="text-foreground text-xs font-medium">Guardando recinto…</span>
              </div>
            )}
          </div>

          {/* Instancia de tu Panel Derecho (Respeta espacio en este flex) */}
          <Panel
            isOpen={rightOpen}
            onOpenChange={setRightOpen}
            isDrawer={!isDesktop}
            placement="right"
            className="pointer-events-auto"
          >
            {selectedIds.size === 0 &&
              <div className="flex flex-1 flex-col items-center justify-center p-4 text-center gap-1">
                <Label>
                  Sin selección
                </Label>
                <Description>Selecciona cualquier cosa dentro del canvas para editar sus propiedades</Description>
              </div>}
            {selectedIds.size > 1 && (() => {
              const selectedSectionsList = venue.sections.filter(s => selectedIds.has(s.id));
              const selectedElementsList = venue.canvasElements.filter(e => selectedIds.has(e.id));
              const selectedSeatsList = venue.seats.filter(s => selectedIds.has(s.id));

              // Agrupar asientos por sección
              const seatsBySection = selectedSeatsList.reduce((acc, seat) => {
                acc[seat.sectionId] = (acc[seat.sectionId] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              // Agrupar elementos por tipo
              const elementsByType = selectedElementsList.reduce((acc, el) => {
                acc[el.elementType] = (acc[el.elementType] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              return (
                <div>
                  <div className="px-3 py-3 flex flex-col gap-3">
                    <h4 className="line-clamp-3">{selectedIds.size} <Description className="ml-1 inline-flex">Objetos seleccionados</Description></h4>
                  </div>
                  <Accordion
                    allowsMultipleExpanded
                    className="w-full border-t border-border"
                    defaultExpandedKeys={["resumen"]}
                  >
                    <Accordion.Item id="resumen">
                      <Accordion.Heading>
                        <Accordion.Trigger>
                          Resumen
                          <Accordion.Indicator />
                        </Accordion.Trigger>
                      </Accordion.Heading>
                      <Accordion.Panel>
                        <Accordion.Body className="flex flex-col gap-4 max-h-[450px] overflow-y-auto overflow-x-hidden">

                          {selectedSectionsList.length > 0 && (
                            <div className="flex flex-col gap-2">
                              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Secciones seleccionadas</Label>
                              {selectedSectionsList.map(s => (
                                <div key={s.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                                  <div className="shrink-0 text-muted-foreground flex items-center justify-center bg-background rounded-md w-8 h-8 shadow-sm">
                                    <Shapes className="w-4 h-4" />
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium truncate">{s.name}</span>
                                    <span className="text-xs text-muted-foreground truncate">{s.capacity || venue.seats.filter(seat => seat.sectionId === s.id).length} lugares</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {Object.keys(elementsByType).length > 0 && (
                            <div className="flex flex-col gap-2">
                              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Elementos seleccionados</Label>
                              {Object.entries(elementsByType).map(([type, count]) => {
                                const Icon = ELEMENT_ICONS[type as CanvasElementType];
                                return (
                                  <div key={type} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                                    <div className="shrink-0 text-muted-foreground flex items-center justify-center bg-background rounded-md w-8 h-8 shadow-sm">
                                      <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-medium truncate">{ELEMENT_TYPE_LABEL[type as CanvasElementType]}</span>
                                      <span className="text-xs text-muted-foreground truncate">{count} {count === 1 ? "elemento" : "elementos"}</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {Object.keys(seatsBySection).length > 0 && (
                            <div className="flex flex-col gap-2">
                              <Label className="text-muted-foreground text-xs uppercase tracking-wider">Asientos seleccionados</Label>
                              {Object.entries(seatsBySection).map(([sectionId, count]) => {
                                const section = venue.sections.find(z => z.id === sectionId);
                                return (
                                  <div key={sectionId} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                                    <div className="shrink-0 text-muted-foreground flex items-center justify-center bg-background rounded-md w-8 h-8 shadow-sm">
                                      <Armchair className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-sm font-medium truncate">{count} {count === 1 ? "asiento" : "asientos"}</span>
                                      <span className="text-xs text-muted-foreground truncate">Sección: {section?.name || "Desconocida"}</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                        </Accordion.Body>
                      </Accordion.Panel>
                    </Accordion.Item>
                  </Accordion>
                </div>
              );
            })()}
            {selectedSection && (
              <div >
                <div className="px-3 py-3 flex flex-col gap-3">
                  <h4 className="line-clamp-3">{selectedSection.name} <Description className="ml-1 inline-flex">{selectedSection.prefix || "-"}</Description></h4>
                </div>
                <Accordion
                  allowsMultipleExpanded
                  className="w-full border-t border-border"
                  defaultExpandedKeys={[
                    "info",
                    "distribucion",
                    "disposicion",
                    "estilo"
                  ]}
                >
                  <Accordion.Item id="info">
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        Información general
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">
                        <TextField
                          variant="secondary"
                          value={selectedSection.name}
                          onChange={(v) => patchSection(selectedSection.id, { name: v })}
                        >
                          <Label>Nombre</Label>
                          <Input />
                        </TextField>
                        <div className="grid grid-cols-2 gap-2">

                          <TextField
                            variant="secondary"
                            value={selectedSection.prefix || ""}
                            onChange={(v) => patchSection(selectedSection.id, { prefix: v.toUpperCase() })
                            }
                          >
                            <Label>Prefijo</Label>
                            <Input maxLength={6} />
                          </TextField>

                          <Select
                            variant="secondary"
                            placeholder="Tipo"
                            value={isNumbered ? "NUMBERED" : "GENERAL"}
                            onChange={(v) => setSectionAdmission(selectedSection.id, v === "NUMBERED")
                            }
                          >
                            <Label>Admisión</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                <ListBox.Item
                                  id="NUMBERED"
                                  textValue="Numerada"
                                >
                                  Numerada <ListBox.ItemIndicator />
                                </ListBox.Item>

                                <ListBox.Item
                                  id="GENERAL"
                                  textValue="General"
                                >
                                  General <ListBox.ItemIndicator />
                                </ListBox.Item>
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        </div>
                        <ConfirmSelect
                          placeholder="Estatus"
                          value={selectedSection.status}
                          onChange={(v) => patchSection(selectedSection.id, { status: v as any })}
                          confirmWhen="always"
                          title={(val) => `Cambiar estatus a ${val === "ACTIVE" ? "Activo" : val === "INACTIVE" ? "Inactivo" : "Removido"}`}
                          description="¿Estás seguro de que deseas cambiar el estatus de la sección?"
                          confirmText="Cambiar estatus"
                        >
                          <Label>Estatus</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="ACTIVE" textValue="Activo">Activo <ListBox.ItemIndicator /></ListBox.Item>
                              <ListBox.Item id="INACTIVE" textValue="Inactivo">Inactivo <ListBox.ItemIndicator /></ListBox.Item>
                              <ListBox.Item id="REMOVED" textValue="Removido">Removido <ListBox.ItemIndicator /></ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </ConfirmSelect>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="description">Descripción:</Label>
                          <TextArea
                            variant="secondary"
                            id="description"
                            rows={3}
                            value={selectedSection.description || ""}
                            onChange={(v) => patchSection(selectedSection.id, { description: v.target.value })}
                          />
                        </div>

                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>

                  <Accordion.Item id="distribucion">
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        Distribución
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">
                        {!isNumbered &&
                          <NumberField
                            variant="secondary"
                            value={selectedSection.capacity}
                            minValue={0}
                            step={10}
                            onChange={(v) => patchSection(selectedSection.id, { capacity: v })}
                          >
                            <Label>Capacidad</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>
                        }
                        {isNumbered && (
                          <ScrollShadow
                            className="max-h-62 -m-2 p-2"
                            hideScrollBar
                          >
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-6">
                                <div className="grid grid-cols-[1fr_1fr_auto] w-full gap-x-2 gap-y-3 items-end">
                                  <TextField
                                    variant="secondary"
                                    value={newRowName}
                                    onChange={setNewRowName}
                                    className="min-w-0"
                                  >
                                    <Label>Fila</Label>
                                    <InputGroup>
                                      <InputGroup.Prefix>
                                        {selectedSection.rowSeatCounts.length + 1}
                                      </InputGroup.Prefix>
                                      <InputGroup.Input
                                        maxLength={3}
                                        placeholder={generateRowName(selectedSection.rowSeatCounts.length)}
                                      />
                                    </InputGroup>
                                  </TextField>

                                  <NumberField
                                    variant="secondary"
                                    value={newRowSeats}
                                    minValue={1}
                                    step={1}
                                    onChange={setNewRowSeats}
                                  >

                                    <Label>Lugares</Label>
                                    <NumberField.Group className="grid-cols-[1fr_auto]">
                                      <NumberField.Input />
                                      <p className="flex text-field-placeholder text-sm pr-3 items-center">
                                        <Armchair />
                                      </p>
                                    </NumberField.Group>
                                  </NumberField>
                                  <div className="shrink-0 flex items-center justify-start">
                                    <Tooltip>
                                      <Button
                                        isIconOnly
                                        variant="ghost"
                                        className="shrink-0"
                                        size="sm"
                                        onPress={() => {
                                          const finalName = newRowName.trim() || generateRowName(selectedSection.rowSeatCounts.length);
                                          setSectionRowConfig(
                                            selectedSection.id,
                                            [...selectedSection.rowSeatCounts, newRowSeats],
                                            [...selectedSection.rowNames, finalName]
                                          );
                                          setNewRowName("");
                                        }}
                                      >
                                        <Plus />
                                      </Button>
                                      <Tooltip.Content showArrow offset={12}>
                                        <Tooltip.Arrow />
                                        <span>Agregar fila</span>
                                      </Tooltip.Content>
                                    </Tooltip>
                                  </div>
                                </div>
                                <div className="grid grid-cols-[1fr_1fr_auto] w-full gap-x-2 gap-y-3 items-center">
                                  {selectedSection.rowSeatCounts.map((count, i) => (
                                    <>

                                      <TextField
                                        className="min-w-0"
                                        variant="secondary"
                                        value={selectedSection.rowNames[i] || generateRowName(i)}
                                        onChange={(v) => { const names = [...selectedSection.rowNames]; names[i] = v; setSectionRowConfig(selectedSection.id, selectedSection.rowSeatCounts, names); }}
                                      >
                                        <InputGroup>
                                          <InputGroup.Prefix>
                                            {i + 1}
                                          </InputGroup.Prefix>
                                          <InputGroup.Input
                                            maxLength={3}
                                            className="w-full"
                                          />
                                        </InputGroup>
                                      </TextField>

                                      <NumberField
                                        value={count}
                                        variant="secondary"

                                        minValue={1}
                                        step={1}
                                        onChange={(v) => { const counts = [...selectedSection.rowSeatCounts]; counts[i] = Math.max(1, v); setSectionRowConfig(selectedSection.id, counts, selectedSection.rowNames); }}
                                      >
                                        <NumberField.Group className="grid-cols-[1fr_auto]">
                                          <NumberField.Input />
                                          <p className="flex text-field-placeholder text-sm pr-3 items-center">
                                            <Armchair />
                                          </p>
                                        </NumberField.Group>
                                      </NumberField>
                                      <div className="shrink-0 flex items-center justify-start">
                                        <Tooltip>
                                          <Button
                                            isIconOnly
                                            variant="ghost"
                                            className="shrink-0 text-danger"
                                            size="sm"
                                            isDisabled={selectedSection.rowSeatCounts.length <= 1}
                                            onPress={() => removeRow(selectedSection.id, i)}
                                          >
                                            <Trash2 />
                                          </Button>
                                          <Tooltip.Content showArrow offset={12}>
                                            <Tooltip.Arrow />
                                            <span>Eliminar fila</span>
                                          </Tooltip.Content>
                                        </Tooltip>
                                      </div>
                                    </>
                                  )
                                  )
                                  }
                                </div></div>
                            </div>
                          </ScrollShadow>
                        )}
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>


                  <Accordion.Item id="disposicion">
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        Posición y tamaño
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">
                        <div className="grid grid-cols-[1fr_1fr] w-full gap-x-2 gap-y-2 items-end">
                          <NumberField
                            value={selectedSection.coordinateX || 0}
                            variant="secondary"
                            step={10}
                            onChange={(v) => patchSectionValidated(selectedSection.id, { coordinateX: v })}
                          >
                            <Label>X</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          <NumberField
                            value={selectedSection.coordinateY || 0}
                            variant="secondary"
                            step={10}
                            onChange={(v) => patchSectionValidated(selectedSection.id, { coordinateY: v })}
                          >
                            <Label>Y</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          <NumberField
                            value={selectedSection.width || 0}
                            minValue={20}
                            variant="secondary"
                            step={10}
                            onChange={(v) => resizeSectionDimension(selectedSection.id, "width", v)}
                          >
                            <Label>Ancho</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>
                          <NumberField
                            value={selectedSection.height || 0}
                            variant="secondary"
                            minValue={20}
                            step={10}
                            onChange={(v) => resizeSectionDimension(selectedSection.id, "height", v)}
                          >
                            <Label>Alto</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          <NumberField
                            value={selectedSection.rotationDegrees}
                            step={5}
                            variant="secondary"
                            onChange={(v) => patchSectionValidated(selectedSection.id, { rotationDegrees: v })}
                          >
                            <Label>Rotación</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          {selectedVertexIdx >= 0 && (() => {
                            const item = selectedSection || selectedElement;
                            const pt = item?.points?.find(p => p.pointIndex === selectedVertexIdx);
                            if (!pt || item?.isEllipse) return null;
                            return (
                              <NumberField
                                value={pt.borderRadius ?? 0}
                                variant="secondary"
                                minValue={0}
                                step={1}
                                onChange={(v) => {
                                  if (item) patchVertexBorderRadius(item.id, selectedVertexIdx, v);
                                }}
                              >
                                <Label>Radio de esquina</Label>
                                <NumberField.Group className="grid-cols-[1fr]">
                                  <NumberField.Input />
                                </NumberField.Group>
                              </NumberField>
                            );
                          })()}

                        </div>
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>
                  {
                    /**
                     * <Switch size="md" isSelected={selectedSection.state === "ACTIVE"} onChange={(isSelected) => patchSection(selectedSection.id, { state: isSelected ? "ACTIVE" : "INACTIVE" })}>
    
                          <Switch.Content className="w-full flex justify-between items-start gap-4">
                            <div className="flex flex-col justify-start text-left">
                              <Label>Sección {selectedSection.state === "ACTIVE" ? "activa" : "inactiva"}</Label>
                              <Description>Habilita o deshabilita la sección en caso de que esté disponible o no.</Description>
                            </div>
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                          </Switch.Content>
                        </Switch>
                     */
                  }
                </Accordion>
                <div>
                </div>
              </div>
            )}
            {selectedElement && (
              <div >
                <div className="px-3 py-3 flex flex-col gap-3">
                  <h4 className="line-clamp-3">{selectedElement.name} <Description className="ml-1 inline-flex">{ELEMENT_TYPE_LABEL[selectedElement.elementType] || "-"}</Description></h4>
                </div>
                <Accordion
                  allowsMultipleExpanded
                  className="w-full border-t border-border"
                  defaultExpandedKeys={[
                    "info",
                    "estilo",
                    "disposicion"
                  ]}
                >
                  <Accordion.Item id="info">
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        Información general
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">
                        <TextField
                          variant="secondary"
                          value={selectedElement.name}
                          onChange={(v) => patchElement(selectedElement.id, { name: v })}
                        >
                          <Label>Nombre</Label>
                          <Input />
                        </TextField>
                        <Select
                          variant="secondary"
                          placeholder="Tipo"
                          value={selectedElement.elementType}
                          onChange={(v) => patchElement(selectedElement.id, { elementType: v as any })}
                        >
                          <Label>Tipo</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {(Object.keys(ELEMENT_TYPE_LABEL) as CanvasElementType[]).map((t) => {
                                const Icon = ELEMENT_ICONS[t];
                                return (
                                  <ListBox.Item key={t} id={t} textValue={ELEMENT_TYPE_LABEL[t]}>
                                    <div className="flex items-center gap-2">
                                      <Icon />
                                      <span>{ELEMENT_TYPE_LABEL[t]}</span>
                                    </div>
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                );
                              })}
                            </ListBox>
                          </Select.Popover>
                        </Select>

                        <ConfirmSelect
                          placeholder="Estatus"
                          value={selectedElement.status ? "ACTIVE" : "INACTIVE"}
                          onChange={(v) => patchElement(selectedElement.id, { status: v === "ACTIVE" })}
                          confirmWhen="always"
                          title={(val) => `Cambiar estatus a ${val === "ACTIVE" ? "Activo" : "Inactivo"}`}
                          description="¿Estás seguro de que deseas cambiar el estatus del elemento?"
                          confirmText="Cambiar estatus"
                        >
                          <Label>Estatus</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="ACTIVE" textValue="Activo">Activo <ListBox.ItemIndicator /></ListBox.Item>
                              <ListBox.Item id="INACTIVE" textValue="Inactivo">Inactivo <ListBox.ItemIndicator /></ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </ConfirmSelect>
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>



                  <Accordion.Item id="disposicion">
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        Posición y tamaño
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">
                        <div className="grid grid-cols-[1fr_1fr] w-full gap-x-2 gap-y-2 items-end">
                          <NumberField
                            value={selectedElement.coordinateX || 0}
                            variant="secondary"
                            step={10}
                            onChange={(v) => patchElementValidated(selectedElement.id, { coordinateX: v })}
                          >
                            <Label>X</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          <NumberField
                            variant="secondary"
                            value={selectedElement.coordinateY || 0}
                            step={10}
                            onChange={(v) => patchElementValidated(selectedElement.id, { coordinateY: v })}
                          >
                            <Label>Y</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          <NumberField
                            variant="secondary"
                            value={selectedElement.width || 0}
                            minValue={20}
                            step={10}
                            onChange={(v) => patchElementValidated(selectedElement.id, { width: v })}
                          >
                            <Label>Ancho</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>
                          <NumberField
                            value={selectedElement.height || 0}
                            variant="secondary"
                            minValue={20}
                            step={10}
                            onChange={(v) => patchElementValidated(selectedElement.id, { height: v })}
                          >
                            <Label>Alto</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          <NumberField
                            variant="secondary"
                            value={selectedElement.rotationDegrees}
                            step={5}
                            onChange={(v) => patchElementValidated(selectedElement.id, { rotationDegrees: v })}
                          >
                            <Label>Rotación</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          {selectedVertexIdx >= 0 && (() => {
                            const item = selectedSection || selectedElement;
                            const pt = item?.points?.find(p => p.pointIndex === selectedVertexIdx);
                            if (!pt || item?.isEllipse) return null;
                            return (
                              <NumberField
                                variant="secondary"
                                value={pt.borderRadius ?? 0}
                                minValue={0}
                                step={1}
                                onChange={(v) => {
                                  if (item) patchVertexBorderRadius(item.id, selectedVertexIdx, v);
                                }}
                              >
                                <Label>Radio de esquina</Label>
                                <NumberField.Group className="grid-cols-[1fr]">
                                  <NumberField.Input />
                                </NumberField.Group>
                              </NumberField>
                            );
                          })()}

                        </div>
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </div>
            )}
            {selectedSeat && (
              <div >
                <div className="px-3 py-3 flex flex-col gap-3">
                  <h4 className="line-clamp-3">Lugar {selectedSeat.row}{selectedSeat.number} <Description className="ml-1 inline-flex">{venue.sections.find((z) => z.id === selectedSeat.sectionId)?.name || "-"}</Description></h4>
                </div>
                <Accordion
                  allowsMultipleExpanded
                  className="w-full border-t border-border"
                  defaultExpandedKeys={[
                    "info",
                    "disposicion",
                  ]}
                >
                  <Accordion.Item id="info">
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        Información general
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">
                        <div className="grid grid-cols-2 gap-2">
                          <TextField
                            variant="secondary"
                            isReadOnly
                            value={selectedSeat.row}
                            onChange={(v) => patchSeat(selectedSeat.id, { row: v })}
                          >
                            <Label>Fila</Label>
                            <Input />
                          </TextField>
                          <TextField
                            variant="secondary"
                            isReadOnly
                            value={selectedSeat.number}
                            onChange={(v) => patchSeat(selectedSeat.id, { number: v })}
                          >
                            <Label>Número</Label>
                            <Input />
                          </TextField>
                        </div>
                        <Select
                          variant="secondary"
                          placeholder="Tipo"
                          value={selectedSeat.type}
                          onChange={(v) => patchSeat(selectedSeat.id, { type: v as any })}
                        >
                          <Label>Tipo</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="STANDARD" textValue="Estándar">
                                <div className="flex items-center gap-2">
                                  <Armchair />
                                  <span>Estándar</span>
                                </div>
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                              <ListBox.Item id="VIP" textValue="VIP">
                                <div className="flex items-center gap-2">
                                  <Crown />
                                  <span>VIP</span>
                                </div>
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                              <ListBox.Item id="PREMIUM" textValue="Premium">
                                <div className="flex items-center gap-2">
                                  <Gem />
                                  <span>Premium</span>
                                </div>
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                              <ListBox.Item id="ACCESSIBLE" textValue="Accesible">
                                <div className="flex items-center gap-2">
                                  <Accessibility />
                                  <span>Accesible</span>
                                </div>
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </Select>

                        <ConfirmSelect
                          placeholder="Estatus"
                          value={selectedSeat.status}
                          onChange={(v) => patchSeat(selectedSeat.id, { status: v as any })}
                          confirmWhen="always"
                          title={(val) => `Cambiar estatus a ${val === "AVAILABLE" ? "Disponible" : val === "UNAVAILABLE" ? "No disponible" : val === "OUT_OF_SERVICE" ? "Fuera de servicio" : "Removido"}`}
                          description="¿Estás seguro de que deseas cambiar el estatus de este asiento?"
                          confirmText="Cambiar estatus"
                        >
                          <Label>Estatus</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="AVAILABLE" textValue="Disponible">Disponible <ListBox.ItemIndicator /></ListBox.Item>
                              <ListBox.Item id="UNAVAILABLE" textValue="No disponible">No disponible <ListBox.ItemIndicator /></ListBox.Item>
                              <ListBox.Item id="OUT_OF_SERVICE" textValue="Fuera de servicio">Fuera de servicio <ListBox.ItemIndicator /></ListBox.Item>
                              <ListBox.Item id="REMOVED" textValue="Removido">Removido <ListBox.ItemIndicator /></ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </ConfirmSelect>
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>

                  <Accordion.Item id="disposicion">
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        Posición y tamaño
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">
                        <div className="grid grid-cols-[1fr_1fr] w-full gap-x-2 gap-y-2 items-end">
                          <NumberField
                            variant="secondary"
                            isReadOnly
                            value={selectedSeat.coordinateX || 0}
                            step={1}
                            onChange={(v) => patchSeat(selectedSeat.id, { coordinateX: v })}
                          >
                            <Label>X</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          <NumberField
                            variant="secondary"
                            isReadOnly
                            value={selectedSeat.coordinateY || 0}
                            step={1}
                            onChange={(v) => patchSeat(selectedSeat.id, { coordinateY: v })}
                          >
                            <Label>Y</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>
                        </div>
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
                <div>
                </div>
              </div>
            )}
          </Panel>

        </main >
      </div>

      <Modal.Backdrop isOpen={infoModalOpen}>
        <Modal.Container>
          <Modal.Dialog className="flex flex-col gap-6 bg-background shadow-overlay rounded-[10px] w-full sm:max-w-[400px] p-8 border-none">
            <Modal.CloseTrigger onPress={() => setInfoModalOpen(false)} />

            <div className="flex flex-col gap-1">
              <h3>Datos del recinto</h3>
              <Description>Información general del lugar.</Description>
            </div>

            <div className="flex flex-col gap-4 flex-1">
              <TextField
                isRequired
                value={venue.venue.name}
                onChange={(v: string) => setVenueField("name", v)}
              >
                <Label>Nombre</Label>
                <Input placeholder="Estadio Nacional" />
                <FieldError />
              </TextField>

              <TextField
                isRequired
                value={venue.venue.address}
                onChange={(v: string) => setVenueField("address", v)}
              >
                <Label>Dirección</Label>
                <Input placeholder="Av. Principal 123" />
                <FieldError />
              </TextField>

              <div className="grid grid-cols-2 gap-3">
                <TextField
                  isRequired
                  value={venue.venue.city}
                  onChange={(v: string) => setVenueField("city", v)}
                >
                  <Label>Ciudad</Label>
                  <Input placeholder="Ciudad de México" />
                  <FieldError />
                </TextField>

                <Select
                  aria-label="Estado"
                  value={venue.venue.addressState ?? ""}
                  onChange={(v: any) => setVenueField("addressState", v || null)}
                >
                  <Label>Estado</Label>
                  <Select.Trigger>
                    {venue.venue.addressState ? <Select.Value /> : <p className="text-field-placeholder">Seleccionar</p>}
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {[
                        "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
                        "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato",
                        "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
                        "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco",
                        "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"
                      ].map((s) => (
                        <ListBox.Item key={s} id={s} textValue={s}>
                          {s}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="description">Descripción:</Label>
                <TextArea
                  id="description"
                  rows={3}
                  value={venue.venue.description ?? ""}
                  onChange={(e: any) => setVenueField("description", e.target ? e.target.value : e)}
                  placeholder="Recinto principal para eventos masivos"
                />
              </div>

              <div className="flex justify-end gap-3 mt-2">
                <Button variant="tertiary" onPress={() => setInfoModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onPress={() => setInfoModalOpen(false)}>
                  Guardar
                  <Save />
                </Button>
              </div>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
