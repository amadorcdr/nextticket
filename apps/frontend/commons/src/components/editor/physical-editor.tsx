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
import { Reorder } from "framer-motion";
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
import { Accordion, Button, ButtonGroup, Checkbox, Chip, Description, Kbd, Label, NumberField, ScrollShadow, Separator, Toolbar, Tooltip, ToggleButton, ToggleButtonGroup, InputGroup, TextField, TextArea, ListBox, Select, Switch, Input, Dropdown, CloseButton } from "@heroui/react";
import { Armchair, ClipboardPaste, ClipboardPlus, Copy, CopyPlus, LocateFixed, PanelLeftOpen, PanelRightOpen, Plus, Redo2, SquareDashedMousePointer, Trash2, Undo2, Users, X, ZoomIn, ZoomOut, Circle, Square, LockKeyhole, LockKeyholeOpen, Link, Unlink, Spline, MousePointer2, Hand, Theater, TvMinimal, Speaker, LogIn, LogOut, Route, Toilet, Wine, Type, Shapes, Component, Crown, Gem, Accessibility, LayersPlus, FileUp, Save, Check, Download, ChevronDown, GripVertical, Pencil, CheckCircle2, Ban, Wrench, Construction } from "lucide-react";

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
}

export default function PhysicalEditor({ initialState, onChange, mode = "create", onSave }: PhysicalEditorProps) {
  const { state: venue, commit: setVenue, mutateSilently: setVenueSilent, settle, undo, redo, canUndo, canRedo } =
    useHistory<PhysicalVenueState>(initialState ?? createEmptyPhysicalVenue());
  useEffect(() => { onChange?.(venue); }, [venue, onChange]);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const centerOnRef = useRef<((x: number, y: number) => void) | null>(null);
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [snap, setSnap] = useState(10);
  const [activeFloorIdState, setActiveFloorIdState] = useState<Id>("");
  const activeFloorId = venue.floors.some((f) => f.id === activeFloorIdState) ? activeFloorIdState : (venue.floors[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(new Set());
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
        const updated = { ...section, rowSeatCounts: [10], rowNames: ["A"] };
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
      const updated = { ...section, rowSeatCounts, rowNames };
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
    try { const data = await readJSONFile<VenueEditorFile>(file); if (data.physical) { setVenue(data.physical); setSelectedIds(new Set()); setVertexEditId(null); setImportedFileName(file.name); } else window.alert("El archivo no contiene datos físicos válidos."); }
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

  // Auto-abrir panel derecho dependiendo de si hay selección
  useEffect(() => {
    if (selectedIds.size > 0) {
      setRightOpen(true);
    }
  }, [selectedIds.size]);

  return (
    // Contenedor principal de la pantalla
    <div className="h-full w-full flex flex-col overflow-hidden p-2">

      {/* Tu Header aquí */}
      <header className="flex gap-3 justify-between shrink-0 z-20 py-4">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="shrink-0"
            onPress={() => fileInputRef.current?.click()}
          >
            <FileUp /> Importar
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportJSON} className="hidden" />
        </div>
        <div className="flex gap-2">

          <ButtonGroup variant="ghost">
            <Button onPress={handleExportJSON} variant="ghost">
              <Download /> Exportar
            </Button>
            <Dropdown>
              <Button isIconOnly variant="ghost">
                <ChevronDown />
              </Button>

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
          </ButtonGroup>
          <Button onPress={() => onSave?.(venue)}>
            {mode === "create" ? (<><Plus className="w-4 h-4" /> Crear recinto</>) : (<><Save /> Guardar cambios</>)}
          </Button>
        </div>
      </header>

      {/* Contenedor Base Relativo */}
      <main className="relative flex-1 overflow-hidden w-full h-full shadow-overlay rounded-[10px]">

        {/* ======================================================== */}
        {/* CAPA 1: EL CANVAS (Fondo completo e imperturbable)         */}
        {/* ======================================================== */}
        <div
          className="absolute inset-0 z-0 overflow-hidden bg-background w-full h-full"
          ref={containerRef}
        ></div>

        {/* Capa de carga bloqueante (Solo cubre el fondo si no está listo) */}
        {!ready && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm pointer-events-auto">
            Cargando…
          </div>
        )}

        {/* ======================================================== */}
        {/* CAPA 2: INTERFAZ FLOTANTE (HUD Compartido)               */}
        {/* Replica el Flexbox del HTML original sin tocar al canvas */}
        {/* ======================================================== */}
        <div className="absolute inset-0 z-10 p-4 flex pointer-events-none overflow-hidden w-full h-full">

          {/* Instancia de tu Panel Izquierdo (Respeta espacio en este flex) */}
          <SmartPanel
            isOpen={leftOpen}
            onOpenChange={setLeftOpen}
            isDesktop={isDesktop}
            placement="left"
          >
            <div>
              <div className="px-3 py-4 flex flex-col gap-3">
                <div className="flex justify-between items-start gap-2">
                  <h5 className="line-clamp-3">
                    {venue.venue.name} {importedFileName && <Description className="ml-1 inline-flex">{importedFileName}</Description>}
                  </h5>
                  <CloseButton onPress={() => setLeftOpen(false)} />
                </div>

                <ScrollShadow className="flex gap-1 justify-between" orientation="horizontal" hideScrollBar>
                  <Chip size="sm" variant="soft" className="shrink-0">{venue.floors.length} {venue.floors.length === 1 ? 'piso' : 'pisos'}</Chip>
                  <Chip size="sm" variant="soft" className="shrink-0">{venue.sections.length} {venue.sections.length === 1 ? 'sección' : 'secciones'}</Chip>
                  <Chip size="sm" variant="soft" className="shrink-0">{venue.canvasElements.length} {venue.canvasElements.length === 1 ? 'elemento' : 'elementos'}</Chip>
                  <Chip size="sm" variant="soft" className="shrink-0">{venue.seats.length} {venue.seats.length === 1 ? 'asiento' : 'asientos'}</Chip>
                </ScrollShadow>
              </div>

              <Accordion
                allowsMultipleExpanded
                className="w-full border-border border-t"
                defaultExpandedKeys={["info", "secciones"]}
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
                        value={venue.venue.name}
                        onChange={(v) => setVenue((p) => ({ ...p, venue: { ...p.venue, name: v } }))}
                      >
                        <Label>Nombre</Label>
                        <Input />
                      </TextField>

                      <TextField
                        value={venue.venue.address}
                        onChange={(v) => setVenue((p) => ({ ...p, venue: { ...p.venue, address: v } }))}
                      >
                        <Label>Dirección</Label>
                        <Input />
                      </TextField>

                      <div className="grid grid-cols-2 gap-2">
                        <TextField
                          value={venue.venue.city}
                          onChange={(v) => setVenue((p) => ({ ...p, venue: { ...p.venue, city: v } }))}
                        >
                          <Label>Ciudad</Label>
                          <Input />
                        </TextField>

                        <TextField
                          value={venue.venue.addressState || ""}
                          onChange={(v) => setVenue((p) => ({ ...p, venue: { ...p.venue, addressState: v || null } }))}
                        >
                          <Label>Estado</Label>
                          <Input />
                        </TextField>
                      </div>
                      <div className="grid grid-cols-2 gap-2">

                        <TextField
                          value={venue.venue.country}
                          onChange={(v) => setVenue((p) => ({ ...p, venue: { ...p.venue, country: v } }))}
                          isReadOnly
                        >
                          <Label>País</Label>
                          <Input />
                        </TextField>

                        <NumberField
                          value={totalCapacity}
                          isReadOnly
                        >
                          <Label>Capacidad total</Label>
                          <NumberField.Group className="grid-cols-[1fr]">
                            <NumberField.Input />
                          </NumberField.Group>
                        </NumberField>
                      </div>


                      <ConfirmSelect
                        placeholder="Estatus"
                        value={venue.venue.status}
                        onChange={(v) => setVenue((p) => ({ ...p, venue: { ...p.venue, status: v as any } }))}
                        confirmWhen="always"
                        title={(val) => `Cambiar estatus a ${val === "DRAFT" ? "Borrador" : val === "ACTIVE" ? "Activo" : val === "INACTIVE" ? "Inactivo" : val === "UNDER_MAINTENANCE" ? "Mantenimiento" : "Removido"}`}
                        description="¿Estás seguro de que deseas cambiar el estatus del recinto?"
                        confirmText="Cambiar estatus"
                      >
                        <Label>Estatus</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            <ListBox.Item id="DRAFT" textValue="Borrador">
                              <div className="flex flex-col">
                                <div className="flex gap-1 items-center">
                                  <Pencil className="shrink-0 size-3!" />
                                  <Label>Borrador</Label>
                                </div>
                                <Description>Recinto en construcción, no visible para el público.</Description>
                              </div>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="ACTIVE" textValue="Activo">
                              <div className="flex flex-col">
                                <div className="flex gap-1 items-center">
                                  <CheckCircle2 className="text-success shrink-0 size-3!" />
                                  <Label className="text-success">Activo</Label>
                                </div>
                                <Description>Recinto visible y disponible para eventos.</Description>
                              </div>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="INACTIVE" textValue="Inactivo">
                              <div className="flex flex-col">
                                <div className="flex gap-1 items-center">
                                  <Ban className="text-danger shrink-0 size-3!" />
                                  <Label className="text-danger">Inactivo</Label>
                                </div>
                                <Description>Recinto oculto o no disponible temporalmente.</Description>
                              </div>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="UNDER_MAINTENANCE" textValue="Mantenimiento">
                              <div className="flex flex-col">
                                <div className="flex gap-1 items-center">
                                  <Construction className="text-warning shrink-0 size-3!" />
                                  <Label className="text-warning">Mantenimiento</Label>
                                </div>
                                <Description>El recinto se encuentra en reparaciones.</Description>
                              </div>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </ConfirmSelect>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="venueDescription">Descripción:</Label>
                        <TextArea
                          id="venueDescription"
                          rows={3}
                          value={venue.venue.description || ""}
                          onChange={(e) => setVenue((p) => ({ ...p, venue: { ...p.venue, description: e.target.value || null } }))}
                        />
                      </div>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item id="pisos">
                  <Accordion.Heading>
                    <Accordion.Trigger>
                      Pisos
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-3">
                      <div className="flex gap-2 items-end">
                        <Select
                          className="flex-1"
                          placeholder="Selecciona un piso"
                          value={activeFloorId}
                          onChange={(v) => handleFloorChange(v as Id)}
                        >
                          <Label>Piso actual</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {venue.floors.map((f) => (
                                <ListBox.Item key={f.id} id={f.id} textValue={f.name}>
                                  {f.name} <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                        <Button variant="secondary" onPress={addFloor}>
                          <Plus className="w-4 h-4 mr-1" /> Piso
                        </Button>
                      </div>

                      <ScrollShadow className="max-h-[50vh] -m-2 p-2" hideScrollBar>
                        <Accordion allowsMultipleExpanded defaultExpandedKeys={[activeFloorId]} className="flex flex-col gap-2">
                          {venue.floors.map((f) => {
                            const floorSections = venue.sections.filter(s => s.floorId === f.id);
                            const floorElements = venue.canvasElements.filter(e => e.floorId === f.id);

                            return (
                              <Accordion.Item key={f.id} id={f.id} className={`bg-secondary/50 rounded-xl overflow-hidden border-1 transition-colors ${f.id === activeFloorId ? 'border-primary' : 'border-transparent'}`}>
                                <Accordion.Heading>
                                  <Accordion.Trigger className="px-3 py-2">
                                    <div className="flex gap-2 items-center flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                                      <TextField
                                        className="flex-1 min-w-0"
                                        value={f.name}
                                        onChange={(v) => renameFloor(f.id, v)}
                                      >
                                        <Input />
                                      </TextField>
                                      <Button
                                        isIconOnly
                                        variant="ghost"
                                        size="sm"
                                        className="text-danger shrink-0"
                                        isDisabled={venue.floors.length <= 1}
                                        onPress={() => removeFloor(f.id)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                    <Accordion.Indicator />
                                  </Accordion.Trigger>
                                </Accordion.Heading>
                                <Accordion.Panel>
                                  <Accordion.Body className="p-3 pt-0 flex flex-col gap-4">
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center justify-between">
                                        <Label className="font-semibold text-xs text-muted-foreground uppercase">Secciones</Label>
                                        {activeFloorId === f.id && (
                                          <div className="size-6 shrink-0 bg-secondary rounded-md flex items-center justify-center cursor-pointer hover:bg-secondary/80 transition-colors" onClick={() => addSection()}>
                                            <Plus className="w-4 h-4" />
                                          </div>
                                        )}
                                      </div>
                                      {floorSections.length === 0 && <Description className="text-xs">Sin secciones</Description>}
                                      {floorSections.map((z) => {
                                        const seatCount = venue.seats.filter(s => s.sectionId === z.id).length;
                                        const hasCloneOnCurrentFloor = venue.sections.some(sx => sx.floorId === activeFloorId && sx.baseId === (z.baseId || z.id));
                                        return (
                                          <div
                                            key={z.id}
                                            className={`w-full h-10 md:h-9 flex items-center gap-2 px-2 cursor-pointer group transition-colors rounded-2xl min-w-0 shrink-0 ${selectedIds.has(z.id)
                                              ? "bg-default/60 shadow-surface"
                                              : "hover:bg-default/60"
                                              }`}
                                            onClick={() => selectOnly(z.id)}
                                          >
                                            <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                                              <Checkbox variant="secondary" isSelected={selectedIds.has(z.id)} onChange={() => {
                                                const next = new Set(selectedIds);
                                                if (next.has(z.id)) {
                                                  next.delete(z.id);
                                                } else {
                                                  next.add(z.id);
                                                }
                                                selectMany(next);
                                              }}>
                                                <Checkbox.Content>
                                                  <Checkbox.Control>
                                                    <Checkbox.Indicator />
                                                  </Checkbox.Control>
                                                </Checkbox.Content>
                                              </Checkbox>
                                            </div>

                                            <Label className="flex-1 min-w-0 truncate">
                                              {z.name}
                                            </Label>

                                            {z.prefix && (
                                              <Chip variant="soft" size="sm" className="shrink-0">{z.prefix}</Chip>
                                            )}

                                            <Chip variant="soft" size="sm" className="shrink-0 gap-1">{seatCount > 0 ? (
                                              <>
                                                <span>{seatCount}</span>
                                                <Armchair className="size-3!" aria-label="lugares" />
                                              </>
                                            ) : (
                                              <>
                                                <span>{z.capacity}</span>
                                                <Users className="size-3!" aria-label="lugares" />
                                              </>
                                            )}</Chip>

                                            <Tooltip delay={0}>
                                              <Button size="sm" className="size-6 text-muted-foreground" variant="ghost" isIconOnly isDisabled={hasCloneOnCurrentFloor} onPress={() => replicateSectionToActiveFloor(z.id)}>
                                                <CopyPlus />
                                              </Button>
                                              <Tooltip.Content placement="top" showArrow offset={12}>
                                                <Tooltip.Arrow />
                                                <Label>Copiar a este piso</Label>
                                              </Tooltip.Content>
                                            </Tooltip>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <Separator />

                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center justify-between">
                                        <Label className="font-semibold text-xs text-muted-foreground uppercase">Elementos</Label>
                                        {activeFloorId === f.id && (
                                          <Select
                                            className="w-24 h-6 min-h-0"
                                            placeholder="Agregar"
                                            onChange={(v) => addCanvasElement(v as CanvasElementType)}
                                          >
                                            <Select.Trigger className="h-6 min-h-0 text-xs px-2 rounded-md">
                                              <Select.Value />
                                              <Select.Indicator className="size-3" />
                                            </Select.Trigger>
                                            <Select.Popover>
                                              <ListBox>
                                                {(Object.keys(ELEMENT_TYPE_LABEL) as CanvasElementType[]).map((t) => {
                                                  const Icon = ELEMENT_ICONS[t];
                                                  return (
                                                    <ListBox.Item key={t} id={t} textValue={ELEMENT_TYPE_LABEL[t]}>
                                                      <div className="flex items-center gap-2">
                                                        <Icon />
                                                        {ELEMENT_TYPE_LABEL[t]}
                                                      </div>
                                                    </ListBox.Item>
                                                  )
                                                })}
                                              </ListBox>
                                            </Select.Popover>
                                          </Select>
                                        )}
                                      </div>
                                      {floorElements.length === 0 && <Description className="text-xs">Sin elementos</Description>}
                                      {floorElements.map((s) => {
                                        const hasCloneOnCurrentFloor = venue.canvasElements.some(sx => sx.floorId === activeFloorId && sx.baseId === (s.baseId || s.id));
                                        const Icon = ELEMENT_ICONS[s.elementType];
                                        return (
                                          <div
                                            key={s.id}
                                            className={`w-full h-10 md:h-9 flex items-center gap-2 px-2 cursor-pointer group transition-colors rounded-2xl min-w-0 shrink-0 ${selectedIds.has(s.id)
                                              ? "bg-default/60 shadow-surface"
                                              : "hover:bg-default/60"
                                              }`}
                                            onClick={() => selectOnly(s.id)}
                                          >
                                            <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                                              <Checkbox variant="secondary" isSelected={selectedIds.has(s.id)} onChange={() => {
                                                const next = new Set(selectedIds);
                                                if (next.has(s.id)) {
                                                  next.delete(s.id);
                                                } else {
                                                  next.add(s.id);
                                                }
                                                selectMany(next);
                                              }}>
                                                <Checkbox.Content>
                                                  <Checkbox.Control>
                                                    <Checkbox.Indicator />
                                                  </Checkbox.Control>
                                                </Checkbox.Content>
                                              </Checkbox>
                                            </div>
                                            <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                                            <Label className="flex-1 min-w-0 truncate">
                                              {s.name}
                                            </Label>

                                            <Tooltip delay={0}>
                                              <Button size="sm" className="size-6 text-muted-foreground" variant="ghost" isIconOnly isDisabled={hasCloneOnCurrentFloor} onPress={() => replicateElementToActiveFloor(s.id)}>
                                                <CopyPlus />
                                              </Button>
                                              <Tooltip.Content placement="top" showArrow offset={12}>
                                                <Tooltip.Arrow />
                                                <Label>Copiar a este piso</Label>
                                              </Tooltip.Content>
                                            </Tooltip>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </Accordion.Body>
                                </Accordion.Panel>
                              </Accordion.Item>
                            );
                          })}
                        </Accordion>
                      </ScrollShadow>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>

                <Accordion.Item id="config">
                  <Accordion.Heading>
                    <Accordion.Trigger>
                      Configuración
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-4">

                      <NumberField
                        className="w-full"
                        minValue={1}
                        maxValue={100}
                        step={1}
                        value={snap}
                        onChange={(v) => setSnap(Math.max(1, v))}
                      >
                        <NumberField.Group className="grid-cols-[auto_1fr_auto]">
                          <p className="flex text-field-placeholder text-sm pl-3 items-center">
                            Ajuste de cuadrícula
                          </p>
                          <NumberField.Input />
                          <p className="flex text-field-placeholder text-sm pr-3 items-center">
                            px
                          </p>
                        </NumberField.Group>
                      </NumberField>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </div>
          </SmartPanel>

          {/* COLUMNA CENTRAL (Se adapta y centra dinámicamente al espacio sobrante entre paneles) */}
          <section className="flex-1 flex flex-col justify-between min-w-0 z-0 h-full">

            {/* Contenedor Superior (Botones Toggle + Toolbar Superior) */}
            {/* El contenedor padre tiene pointer-events-none para dejar pasar clicks, y solo los hijos interactivos tienen pointer-events-auto */}
            <div className="flex items-center gap-2 w-full mx-auto pointer-events-none shrink-0">
              <div className="bg-surface p-2 rounded-[10px] z-10 shadow-surface pointer-events-auto shrink-0">
                <Button size="sm" isIconOnly variant="ghost" onPress={() => setLeftOpen(!leftOpen)}>
                  {leftOpen ? <PanelRightOpen /> : <PanelLeftOpen />}
                </Button>
              </div>

              <div className="flex-1 flex items-center justify-center min-w-0">
                <ScrollShadow orientation="horizontal" className="max-w-full pointer-events-none p-5 -m-5" hideScrollBar>
                  <div className="flex items-center gap-2 pointer-events-none w-max">
                    <Toolbar className="gap-1 bg-surface p-2 rounded-[10px] z-10 shadow-surface pointer-events-auto shrink-0">
                      <ToggleButtonGroup
                        selectionMode="single"
                        selectedKeys={[tool]}
                        onSelectionChange={(keys) => {
                          const t = Array.from(keys)[0] as "select" | "pan";
                          if (t) setTool(t);
                        }}
                      >
                        <Tooltip delay={0}>
                          <ToggleButton id="select" size="sm" isIconOnly variant="ghost">
                            <MousePointer2 />
                          </ToggleButton>
                          <Tooltip.Content placement="bottom" showArrow offset={12}>
                            <Tooltip.Arrow />
                            <Label className="flex items-center gap-2">
                              Seleccionar
                              <Kbd>
                                <Kbd.Content>S</Kbd.Content>
                              </Kbd>
                            </Label>
                          </Tooltip.Content>
                        </Tooltip>

                        <Tooltip delay={0}>
                          <ToggleButton id="pan" size="sm" isIconOnly variant="ghost">
                            <Hand />
                          </ToggleButton>
                          <Tooltip.Content placement="bottom" showArrow offset={12}>
                            <Tooltip.Arrow />
                            <Label className="flex items-center gap-2">
                              Mover lienzo
                              <Kbd>
                                <Kbd.Content>H</Kbd.Content>
                              </Kbd>
                            </Label>
                          </Tooltip.Content>
                        </Tooltip>
                      </ToggleButtonGroup>
                    </Toolbar>
                    <Toolbar className="gap-1 bg-surface p-2 rounded-[10px] z-10 shadow-surface pointer-events-auto">

                      <Tooltip delay={0}>
                        <Button size="sm" isIconOnly variant="ghost" onPress={() => fitToBounds(computeVenueBounds(venue))}>
                          <LocateFixed />
                        </Button>
                        <Tooltip.Content placement="bottom" showArrow offset={12}>
                          <Tooltip.Arrow />
                          <Label className="flex items-center gap-2">
                            Ajustar a la vista
                            <Kbd>
                              <Kbd.Abbr keyValue="ctrl" />
                              <Kbd.Content>0</Kbd.Content>
                            </Kbd>
                          </Label>
                        </Tooltip.Content>
                      </Tooltip>
                      <Separator />

                      <ButtonGroup variant="ghost">

                        <Tooltip delay={0}>
                          <Button
                            size="sm"
                            isIconOnly
                            variant="ghost"
                            className="shrink-0"
                            onPress={() => zoomBy(1.2)}
                          >
                            <ZoomIn />
                          </Button>
                          <Tooltip.Content placement="bottom" showArrow offset={12}>
                            <Tooltip.Arrow />
                            <Label className="flex items-center gap-2">
                              Acercar
                              <Kbd>
                                <Kbd.Content>+</Kbd.Content>
                              </Kbd>
                            </Label>
                          </Tooltip.Content>
                        </Tooltip>

                        <Tooltip delay={0}>
                          <Button
                            size="sm"
                            isIconOnly
                            variant="ghost"
                            className="shrink-0"
                            onPress={() => zoomBy(0.8)}
                          >
                            <ZoomOut />
                          </Button>
                          <Tooltip.Content placement="bottom" showArrow offset={12}>
                            <Tooltip.Arrow />
                            <Label className="flex items-center gap-2">
                              Alejar
                              <Kbd>
                                <Kbd.Content>-</Kbd.Content>
                              </Kbd>
                            </Label>
                          </Tooltip.Content>
                        </Tooltip>
                      </ButtonGroup>
                      <Separator />

                      <ButtonGroup variant="ghost">

                        <Tooltip delay={0}>
                          <Button size="sm" isIconOnly variant="ghost" onPress={undo} isDisabled={!canUndo}>
                            <Undo2 />
                          </Button>
                          <Tooltip.Content placement="bottom" showArrow offset={12}>
                            <Tooltip.Arrow />
                            <Label className="flex items-center gap-2">
                              Deshacer
                              <Kbd>
                                <Kbd.Abbr keyValue="ctrl" />
                                <Kbd.Content>Z</Kbd.Content>
                              </Kbd>
                            </Label>
                          </Tooltip.Content>
                        </Tooltip>

                        <Tooltip delay={0}>
                          <Button size="sm" isIconOnly variant="ghost" onPress={redo} isDisabled={!canRedo}>
                            <Redo2 />
                          </Button>
                          <Tooltip.Content placement="bottom" showArrow offset={12}>
                            <Tooltip.Arrow />
                            <Label className="flex items-center gap-2">
                              Rehacer
                              <Kbd>
                                <Kbd.Abbr keyValue="ctrl" />
                                <Kbd.Content>Y</Kbd.Content>
                              </Kbd>
                            </Label>
                          </Tooltip.Content>
                        </Tooltip>
                      </ButtonGroup>

                      <Separator />
                      <ButtonGroup variant="ghost">
                        <Tooltip delay={0}>
                          <Button
                            size="sm"
                            isIconOnly
                            variant="ghost"
                            onPress={copySelection}
                            isDisabled={selectedIds.size === 0}
                          >
                            <Copy />
                          </Button>
                          <Tooltip.Content placement="bottom" showArrow offset={12}>
                            <Tooltip.Arrow />
                            <Label className="flex items-center gap-2">
                              Copiar
                              <Kbd>
                                <Kbd.Abbr keyValue="ctrl" />
                                <Kbd.Content>C</Kbd.Content>
                              </Kbd>
                            </Label>
                          </Tooltip.Content>
                        </Tooltip>

                        <Tooltip delay={0}>
                          <Button
                            size="sm"
                            isIconOnly
                            variant="ghost"
                            onPress={pasteClipboard}
                            isDisabled={!hasClipboard}
                          >
                            <ClipboardPaste />
                          </Button>
                          <Tooltip.Content placement="bottom" showArrow offset={12}>
                            <Tooltip.Arrow />
                            <Label className="flex items-center gap-2">
                              Pegar
                              <Kbd>
                                <Kbd.Abbr keyValue="ctrl" />
                                <Kbd.Content>V</Kbd.Content>
                              </Kbd>
                            </Label>
                          </Tooltip.Content>
                        </Tooltip>

                        <Tooltip delay={0}>
                          <Button
                            size="sm"
                            isIconOnly
                            variant="ghost"
                            onPress={duplicateSelection}
                            isDisabled={selectedIds.size === 0}
                          >
                            <ClipboardPlus />
                          </Button>
                          <Tooltip.Content placement="bottom" showArrow offset={12}>
                            <Tooltip.Arrow />
                            <Label className="flex items-center gap-2">
                              Duplicar
                              <Kbd>
                                <Kbd.Abbr keyValue="ctrl" />
                                <Kbd.Content>D</Kbd.Content>
                              </Kbd>
                            </Label>
                          </Tooltip.Content>
                        </Tooltip>

                        <Tooltip delay={0}>
                          <Button
                            size="sm"
                            isIconOnly
                            variant="ghost"
                            onPress={deleteSelected}
                            isDisabled={selectedIds.size === 0}
                            className="text-destructive"
                          >
                            <Trash2 className="text-danger" />
                          </Button>
                          <Tooltip.Content placement="bottom" showArrow offset={12}>
                            <Tooltip.Arrow />
                            <Label className="flex items-center gap-2">
                              Eliminar
                              <Kbd>
                                <Kbd.Content>Del</Kbd.Content>
                              </Kbd>
                            </Label>
                          </Tooltip.Content>
                        </Tooltip>
                      </ButtonGroup>
                    </Toolbar>
                  </div>
                </ScrollShadow>
              </div>
              <div className=" bg-surface p-2 rounded-[10px] z-10 shadow-surface pointer-events-auto shrink-0">
                <Button size="sm" isIconOnly variant="ghost" onPress={() => setRightOpen(!rightOpen)}>
                  {rightOpen ? <PanelLeftOpen /> : <PanelRightOpen />}
                </Button>
              </div>
            </div>

            {/* ESPACIO VACÍO CENTRAL: Crucial para que los clics toquen el canvas directamente */}
            <div className="flex-1 w-full pointer-events-none"></div>


            {/* Toolbar Inferior */}
            <div className="pointer-events-auto min-w-0 max-w-full shrink-0 self-center">
              <ScrollShadow orientation="horizontal" className="flex gap-2 p-5 -m-5" hideScrollBar>
                <FloorsToolbarReorderList
                  venue={venue}
                  activeFloorId={activeFloorId}
                  handleFloorChange={handleFloorChange}
                  removeFloor={removeFloor}
                  setVenue={setVenue}
                />
                <div
                  className="p-1 rounded-[10px] z-10 shadow-surface shrink-0 h-24 aspect-video flex flex-col gap-1 cursor-pointer transition-transform overflow-hidden bg-surface"
                  onClick={addFloor}
                  title="Agregar piso"
                >
                  <div className="flex-1 min-h-0 relative flex items-center justify-center text-muted">
                    <div className="flex items-center justify-center size-11 bg-default-soft rounded-[10px] shadow-surface mb-2 text-muted">

                      <Plus />
                    </div>
                  </div>
                  <Description className="text-center truncate px-3 text-muted">Agregar piso</Description>
                </div>
              </ScrollShadow>
            </div>

          </section>

          {/* Instancia de tu Panel Derecho (Respeta espacio en este flex) */}
          <SmartPanel
            isOpen={rightOpen}
            onOpenChange={setRightOpen}
            isDesktop={isDesktop}
            placement="right"
          >
            {selectedIds.size === 0 &&
              <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center gap-2">
                <div className="flex items-center justify-center size-11 bg-default-soft rounded-[10px] shadow-surface mb-2 text-muted">
                  <SquareDashedMousePointer />
                </div>
                <h6>
                  Nada seleccionado aún
                </h6>
                <p className="text-muted">Selecciona un objeto para ver sus propiedades</p>
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
                  <div className="px-3 py-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start gap-2">
                      <h5 className="line-clamp-3">
                        {selectedIds.size} Objetos seleccionados
                      </h5>
                    </div>
                    <ScrollShadow className="flex gap-1 justify-between" orientation="horizontal" hideScrollBar>
                      <Chip size="sm" variant="soft" className="shrink-0">{selectedIds.size} objetos</Chip>
                      {selectedSectionsList.length > 0 && <Chip size="sm" variant="soft" className="shrink-0">{selectedSectionsList.length} {selectedSectionsList.length === 1 ? "sección" : "secciones"}</Chip>}
                      {selectedElementsList.length > 0 && <Chip size="sm" variant="soft" className="shrink-0">{selectedElementsList.length} {selectedElementsList.length === 1 ? "elemento" : "elementos"}</Chip>}
                      {selectedSeatsList.length > 0 && <Chip size="sm" variant="soft" className="shrink-0">{selectedSeatsList.length} {selectedSeatsList.length === 1 ? "asiento" : "asientos"}</Chip>}
                    </ScrollShadow>
                  </div>
                  <Accordion
                    allowsMultipleExpanded
                    className="w-full border-border border-t"
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
                <div className="px-3 py-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <h5 className="line-clamp-3">
                      {selectedSection.name} <Description className="ml-1 inline-flex">{selectedSection.prefix || "-"}</Description>
                    </h5>
                    <div className="flex gap-1 items-center"></div>
                  </div>

                  <ScrollShadow className="flex gap-1 justify-between" orientation="horizontal" hideScrollBar>
                    <Chip size="sm" variant="soft" className="shrink-0">Admisión {isNumbered ? "numerada" : "general"}</Chip>
                    {isNumbered && (<Chip size="sm" variant="soft" className="shrink-0">{selectedSection.rowSeatCounts.length} {selectedSection.rowSeatCounts.length === 1 ? 'fila' : 'filas'}</Chip>)}
                    <Chip size="sm" variant="soft" className="shrink-0">{isNumbered ? venue.seats.filter(s => s.sectionId === selectedSection.id).length : selectedSection.capacity || 0} lugares</Chip>
                    <Chip size="sm" variant="soft" className="shrink-0">Coordenada {selectedSection.coordinateX ?? 0},{selectedSection.coordinateY ?? 0}</Chip>
                  </ScrollShadow>

                </div>
                <Accordion
                  allowsMultipleExpanded
                  className="w-full border-border border-t"
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
                          value={selectedSection.name}
                          onChange={(v) => patchSection(selectedSection.id, { name: v })}
                        >
                          <Label>Nombre</Label>
                          <Input />
                        </TextField>
                        <div className="grid grid-cols-2 gap-2">

                          <TextField
                            value={selectedSection.prefix || ""}
                            onChange={(v) => patchSection(selectedSection.id, { prefix: v.toUpperCase() })
                            }
                          >
                            <Label>Prefijo</Label>
                            <Input maxLength={6} />
                          </TextField>

                          <Select
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
                                  </div>
                                </div>
                                <div className="grid grid-cols-[1fr_1fr_auto] w-full gap-x-2 gap-y-3 items-center">
                                  {selectedSection.rowSeatCounts.map((count, i) => (
                                    <>

                                      <TextField
                                        className="min-w-0"
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

                  <Accordion.Item id="estilo">
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        Estilo
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">

                        <div className="grid grid-cols-[1fr_auto] w-full gap-x-2 items-end">
                          <Select
                            placeholder="Forma"
                            value={selectedSection.isEllipse ? "ELLIPSE" : "RECTANGLE"}
                            onChange={(v) => {
                              const wantEllipse = v === "ELLIPSE";
                              if (wantEllipse !== selectedSection.isEllipse) {
                                toggleEllipse(selectedSection.id, true);
                              }
                            }}
                          >
                            <Label>Forma</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                <ListBox.Item
                                  id="RECTANGLE"
                                  textValue="Rectangular"
                                >
                                  <div className="flex items-center gap-2">
                                    <Square />
                                    <span>Rectangular</span>
                                  </div>
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>

                                <ListBox.Item
                                  id="ELLIPSE"
                                  textValue="Circular"
                                >
                                  <div className="flex items-center gap-2">
                                    <Circle />
                                    <span>Circular</span>
                                  </div>
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <ColorField value={selectedSection.color || "#2563eb"} onCommit={(v) => patchSection(selectedSection.id, { color: v })} />

                        </div>

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
                        <div className="grid grid-cols-[1fr_1fr_auto] w-full gap-x-2 gap-y-3 items-end">
                          <NumberField
                            value={selectedSection.coordinateX || 0}
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
                            step={10}
                            onChange={(v) => patchSectionValidated(selectedSection.id, { coordinateY: v })}
                          >
                            <Label>Y</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>


                          <Tooltip delay={0}>
                            <ToggleButton
                              size="sm"
                              isIconOnly
                              variant="ghost"
                              className="text-muted-foreground"
                              isSelected={!!(selectedSection?.locked || selectedElement?.locked)}
                              onChange={(val) => {
                                if (selectedSection) patchSection(selectedSection.id, { locked: val });
                                else if (selectedElement) patchElement(selectedElement.id, { locked: val });
                              }}
                            >
                              {(props: any) => props.isSelected ? <LockKeyhole /> : <LockKeyholeOpen />}
                            </ToggleButton>
                            <Tooltip.Content placement="top" showArrow offset={12}>
                              <Tooltip.Arrow />
                              <Label className="flex items-center gap-2">Bloquear posición</Label>
                            </Tooltip.Content>
                          </Tooltip>

                          <NumberField
                            value={selectedSection.width || 0}
                            minValue={20}
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
                            minValue={20}
                            step={10}
                            onChange={(v) => resizeSectionDimension(selectedSection.id, "height", v)}
                          >
                            <Label>Alto</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          <Tooltip delay={0}>
                            <ToggleButton
                              size="sm"
                              isIconOnly
                              variant="ghost"
                              className="text-muted-foreground"
                              isSelected={!!(selectedSection?.lockAspect || selectedElement?.lockAspect)}
                              onChange={(val) => {
                                if (selectedSection) patchSection(selectedSection.id, { lockAspect: val });
                                else if (selectedElement) patchElement(selectedElement.id, { lockAspect: val });
                              }}
                            >
                              {(props: any) => props.isSelected ? <Link /> : <Unlink />}
                            </ToggleButton>
                            <Tooltip.Content placement="top" showArrow offset={12}>
                              <Tooltip.Arrow />
                              <Label className="flex items-center gap-2">Bloquear proporción</Label>
                            </Tooltip.Content>
                          </Tooltip>

                          <NumberField
                            value={selectedSection.rotationDegrees}
                            step={5}
                            onChange={(v) => patchSectionValidated(selectedSection.id, { rotationDegrees: v })}
                          >
                            <Label>Rotación</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>


                          <Tooltip delay={0}>
                            <ToggleButton
                              size="sm"
                              isIconOnly
                              variant="ghost"
                              className="text-muted-foreground"
                              isDisabled={selectedVertexIdx < 0 || !!(selectedSection?.isEllipse || selectedElement?.isEllipse)}
                              isSelected={(() => {
                                const item = selectedSection || selectedElement;
                                if (!item || selectedVertexIdx < 0 || item.isEllipse || !item.points) return false;
                                const pt = item.points.find(p => p.pointIndex === selectedVertexIdx);
                                return pt ? (pt.controlX !== null && pt.controlY !== null) : false;
                              })()}
                              onChange={() => {
                                const item = selectedSection || selectedElement;
                                if (item && selectedVertexIdx >= 0) {
                                  toggleCurveOnEdge(item.id, selectedVertexIdx);
                                }
                              }}
                            >
                              <Spline />
                            </ToggleButton>
                            <Tooltip.Content placement="top" showArrow offset={12}>
                              <Tooltip.Arrow />
                              <Label className="flex items-center gap-2">Curvar/Enderezar</Label>
                            </Tooltip.Content>
                          </Tooltip>

                          {selectedVertexIdx >= 0 && (() => {
                            const item = selectedSection || selectedElement;
                            const pt = item?.points?.find(p => p.pointIndex === selectedVertexIdx);
                            if (!pt || item?.isEllipse) return null;
                            return (
                              <NumberField
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
                <div className="px-3 py-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <h5 className="line-clamp-3">
                      {selectedElement.name}
                    </h5>
                    <div className="flex gap-1 items-center">
                      <ConfirmSwitch
                        isSelected={selectedElement.status}
                        onChange={(val) => patchElement(selectedElement.id, { status: val })}
                        confirmWhen="always"
                        title={(val) => val ? "¿Activar elemento?" : "¿Desactivar elemento?"}
                        description={(val) => val ? "Al activar este elemento volverá a estar visible. ¿Deseas continuar?" : "Al desactivar este elemento dejará de estar visible. ¿Deseas continuar?"}
                        confirmText={(val) => val ? "Activar" : "Desactivar"}
                        cancelText="Cancelar"
                        status={(val) => val ? "success" : "danger"}
                      />
                    </div>
                  </div>
                  <ScrollShadow className="flex gap-1 justify-between" orientation="horizontal" hideScrollBar>
                    <Chip size="sm" variant="soft" className="shrink-0">{ELEMENT_TYPE_LABEL[selectedElement.elementType]}</Chip>
                    <Chip size="sm" variant="soft" className="shrink-0">{selectedElement.isEllipse ? "Circular" : "Rectangular"}</Chip>
                    <Chip size="sm" variant="soft" className="shrink-0">{selectedElement.width ?? 0}x{selectedElement.height ?? 0} px</Chip>
                    <Chip size="sm" variant="soft" className="shrink-0">Coordenada {selectedElement.coordinateX ?? 0},{selectedElement.coordinateY ?? 0}</Chip>
                  </ScrollShadow>
                </div>
                <Accordion
                  allowsMultipleExpanded
                  className="w-full border-border border-t"
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
                          value={selectedElement.name}
                          onChange={(v) => patchElement(selectedElement.id, { name: v })}
                        >
                          <Label>Nombre</Label>
                          <Input />
                        </TextField>
                        <Select
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
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>

                  <Accordion.Item id="estilo">
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        Estilo
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">
                        <div className="grid grid-cols-[1fr_auto] w-full gap-x-2 items-end">
                          <Select
                            placeholder="Forma"
                            value={selectedElement.isEllipse ? "ELLIPSE" : "RECTANGLE"}
                            onChange={(v) => {
                              const wantEllipse = v === "ELLIPSE";
                              if (wantEllipse !== selectedElement.isEllipse) {
                                toggleEllipse(selectedElement.id, false);
                              }
                            }}
                          >
                            <Label>Forma</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                <ListBox.Item
                                  id="RECTANGLE"
                                  textValue="Recta"
                                >
                                  <div className="flex items-center gap-2">
                                    <Square />
                                    <span>Rectangular</span>
                                  </div>
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>

                                <ListBox.Item
                                  id="ELLIPSE"
                                  textValue="Curva"
                                >
                                  <div className="flex items-center gap-2">
                                    <Circle />
                                    <span>Circular</span>
                                  </div>
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <ColorField value={selectedElement.color || "#475569"} onCommit={(v) => patchElement(selectedElement.id, { color: v })} />
                        </div>
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>

                  <Accordion.Item id="disposicion">
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        Posición y dimensión
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">
                        <div className="grid grid-cols-[1fr_1fr_auto] w-full gap-x-2 gap-y-3 items-end">
                          <NumberField
                            value={selectedElement.coordinateX || 0}
                            step={10}
                            onChange={(v) => patchElementValidated(selectedElement.id, { coordinateX: v })}
                          >
                            <Label>X</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          <NumberField
                            value={selectedElement.coordinateY || 0}
                            step={10}
                            onChange={(v) => patchElementValidated(selectedElement.id, { coordinateY: v })}
                          >
                            <Label>Y</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          <Tooltip delay={0}>
                            <ToggleButton
                              size="sm"
                              isIconOnly
                              variant="ghost"
                              className="text-muted-foreground"
                              isSelected={!!(selectedSection?.locked || selectedElement?.locked)}
                              onChange={(val) => {
                                if (selectedSection) patchSection(selectedSection.id, { locked: val });
                                else if (selectedElement) patchElement(selectedElement.id, { locked: val });
                              }}
                            >
                              {(props: any) => props.isSelected ? <LockKeyhole /> : <LockKeyholeOpen />}
                            </ToggleButton>
                            <Tooltip.Content placement="top" showArrow offset={12}>
                              <Tooltip.Arrow />
                              <Label className="flex items-center gap-2">Bloquear posición</Label>
                            </Tooltip.Content>
                          </Tooltip>

                          <NumberField
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
                            minValue={20}
                            step={10}
                            onChange={(v) => patchElementValidated(selectedElement.id, { height: v })}
                          >
                            <Label>Alto</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          <Tooltip delay={0}>
                            <ToggleButton
                              size="sm"
                              isIconOnly
                              variant="ghost"
                              className="text-muted-foreground"
                              isSelected={!!(selectedSection?.lockAspect || selectedElement?.lockAspect)}
                              onChange={(val) => {
                                if (selectedSection) patchSection(selectedSection.id, { lockAspect: val });
                                else if (selectedElement) patchElement(selectedElement.id, { lockAspect: val });
                              }}
                            >
                              {(props: any) => props.isSelected ? <Link /> : <Unlink />}
                            </ToggleButton>
                            <Tooltip.Content placement="top" showArrow offset={12}>
                              <Tooltip.Arrow />
                              <Label className="flex items-center gap-2">Bloquear proporción</Label>
                            </Tooltip.Content>
                          </Tooltip>

                          <NumberField
                            value={selectedElement.rotationDegrees}
                            step={5}
                            onChange={(v) => patchElementValidated(selectedElement.id, { rotationDegrees: v })}
                          >
                            <Label>Rotación</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          {/**
                           * Border radius global eliminado — ahora es por vértice.
                           */}

                          <Tooltip delay={0}>
                            <ToggleButton
                              size="sm"
                              isIconOnly
                              variant="ghost"
                              className="text-muted-foreground"
                              isDisabled={selectedVertexIdx < 0 || !!(selectedSection?.isEllipse || selectedElement?.isEllipse)}
                              isSelected={(() => {
                                const item = selectedSection || selectedElement;
                                if (!item || selectedVertexIdx < 0 || item.isEllipse || !item.points) return false;
                                const pt = item.points.find(p => p.pointIndex === selectedVertexIdx);
                                return pt ? (pt.controlX !== null && pt.controlY !== null) : false;
                              })()}
                              onChange={() => {
                                const item = selectedSection || selectedElement;
                                if (item && selectedVertexIdx >= 0) {
                                  toggleCurveOnEdge(item.id, selectedVertexIdx);
                                }
                              }}
                            >
                              <Spline />
                            </ToggleButton>
                            <Tooltip.Content placement="top" showArrow offset={12}>
                              <Tooltip.Arrow />
                              <Label className="flex items-center gap-2">Curvar/Enderezar</Label>
                            </Tooltip.Content>
                          </Tooltip>

                          {selectedVertexIdx >= 0 && (() => {
                            const item = selectedSection || selectedElement;
                            const pt = item?.points?.find(p => p.pointIndex === selectedVertexIdx);
                            if (!pt || item?.isEllipse) return null;
                            return (
                              <NumberField
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
                <div className="px-3 py-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <h5 className="line-clamp-3">
                      Lugar {selectedSeat.row}{selectedSeat.number}
                    </h5>
                    <div className="flex gap-1 items-center">
                      <ConfirmSwitch
                        isSelected={selectedSeat.status === "AVAILABLE"}
                        onChange={(val) => patchSeat(selectedSeat.id, { status: val ? "AVAILABLE" : "UNAVAILABLE" })}
                        confirmWhen="always"
                        title={(val) => val ? "¿Habilitar asiento?" : "¿Deshabilitar asiento?"}
                        description={(val) => val ? "Al habilitar este asiento, volverá a estar disponible. ¿Deseas continuar?" : "Al deshabilitar este asiento, no estará disponible. ¿Deseas continuar?"}
                        confirmText={(val) => val ? "Habilitar" : "Deshabilitar"}
                        cancelText="Cancelar"
                        status={(val) => val ? "success" : "danger"}
                      />
                    </div>
                  </div>
                  <ScrollShadow className="flex gap-1 justify-between" orientation="horizontal" hideScrollBar>
                    <Chip size="sm" variant="soft" className="shrink-0">{venue.sections.find((z) => z.id === selectedSeat.sectionId)?.name || "Sección desconocida"}</Chip>
                    <Chip size="sm" variant="soft" className="shrink-0">
                      {selectedSeat.type === "VIP" ? "VIP" : selectedSeat.type === "PREMIUM" ? "Premium" : selectedSeat.type === "ACCESSIBLE" ? "Accesible" : "Estándar"}
                    </Chip>
                    <Chip size="sm" variant="soft" className="shrink-0">Coordenada {selectedSeat.coordinateX ?? 0},{selectedSeat.coordinateY ?? 0}</Chip>
                  </ScrollShadow>
                </div>
                <Accordion
                  allowsMultipleExpanded
                  className="w-full border-border border-t"
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
                            isReadOnly
                            value={selectedSeat.row}
                            onChange={(v) => patchSeat(selectedSeat.id, { row: v })}
                          >
                            <Label>Fila</Label>
                            <Input />
                          </TextField>
                          <TextField
                            isReadOnly
                            value={selectedSeat.number}
                            onChange={(v) => patchSeat(selectedSeat.id, { number: v })}
                          >
                            <Label>Número</Label>
                            <Input />
                          </TextField>
                        </div>
                        <Select
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
                          title={(val) => `Cambiar estatus del asiento`}
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
                        Posición y dimensión
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">
                        <div className="grid grid-cols-[1fr_1fr] w-full gap-x-2 gap-y-3 items-end">
                          <NumberField
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
          </SmartPanel>

        </div>
      </main >
    </div >
  );

}
