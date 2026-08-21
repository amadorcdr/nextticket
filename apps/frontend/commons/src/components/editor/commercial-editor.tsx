"use client";

/**
 * commercial-editor.tsx — Editor Comercial (usuarios ORGANIZADORES)
 *
 * Carga el canvas físico (solo lectura estructural) y permite:
 * - Crear/eliminar zonas de venta (event_zones)
 * - Asignar secciones a una zona haciendo clic en el lienzo
 * - Definir precio/aforo máximo/color por zona
 * - Gestionar etapas de precio (event_zone_price_tiers) con fechas y capacidad
 * - Generar event_seats automáticamente al asignar secciones
 * - Deshabilitar asientos individuales (event_seats.status = DISABLED)
 * - Undo/redo y atajos de teclado
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "pixi.js";
import { Button, toast, Tooltip, Kbd, Separator, NumberField, Accordion, Label, Description, TextField, Select, ListBox, Input, InputGroup, Tabs, ScrollShadow, SearchField } from "@heroui/react";
import { ChevronDown, ChevronUp, Download, Loader2, Maximize, Minus, Plus, Redo2, Trash2, Undo2, Upload, ZoomIn, ZoomOut, PanelLeftOpen, PanelRightOpen, LocateFixed, Shapes, Armchair, Search, X } from "lucide-react";
import type { Id, Pt, PhysicalVenueState, CommercialEventState, EventZone, EventZonePriceTier, EventSeat, VenueEditorFile } from "./types";
import { uid, sectionIsNumbered } from "./types";
import { sectionColorFor } from "./constants";
import { useHistory } from "./history";
import { usePixiStage, type PixiLayers, type StagePointerInfo } from "./canvas-engine";
import { drawGrid, drawRuler, renderSections, renderCanvasElements, renderSeats, hexToInt } from "./rendering";
import { computeZoneCapacity, computeVenueBounds, hitTestAt, drawMarquee, computeSelectionOBB, drawSelectionBBox } from "./selection";
import { useKeyboardShortcuts } from "./keyboard";
import { downloadJSON, exportVenueEditorFile, readJSONFile } from "./serialization";
import { ColorField, CheckField, DateTimeField } from "./controls";
import { Panel } from "../organisms/Panel";
import { useIsDesktop } from "./layout-components";

const selectClassName =
  "w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none cursor-pointer focus:border-foreground transition-colors";
const fieldLabelClassName = "text-muted text-[10px] font-semibold uppercase tracking-wide";

export interface CommercialEditorProps {
  physical: PhysicalVenueState;
  initialCommercial?: CommercialEventState;
  onChange?: (state: CommercialEventState) => void;
  topbarStartContent?: React.ReactNode;
  topbarEndContent?: React.ReactNode;
}

/** Genera event_seats para todas las secciones asignadas a zonas. */
const generateEventSeats = (zones: EventZone[], physical: PhysicalVenueState, existing: EventSeat[]): EventSeat[] => {
  const result: EventSeat[] = [];
  const existingBySeatId = new Map(existing.map(es => [es.seatId, es]));
  for (const zone of zones) {
    for (const sectionId of zone.sectionIds) {
      const section = physical.sections.find(s => s.id === sectionId);
      if (!section || !sectionIsNumbered(section)) continue;
      const sectionSeats = physical.seats.filter(s => s.sectionId === sectionId);
      for (const seat of sectionSeats) {
        const prev = existingBySeatId.get(seat.id);
        result.push({
          id: prev?.id ?? uid("eventseat"),
          eventZoneId: zone.id,
          seatId: seat.id,
          sectionId: sectionId,
          lockedUntil: null,
          status: prev?.status ?? "AVAILABLE",
        });
      }
    }
  }
  return result;
};

export default function CommercialEditor({ physical, initialCommercial, onChange, topbarStartContent, topbarEndContent }: CommercialEditorProps) {
  const isDesktop = useIsDesktop();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const { state: commercial, commit: setCommercial, undo, redo, canUndo, canRedo } = useHistory<CommercialEventState>(
    initialCommercial ?? { eventId: uid("event"), eventName: "Nuevo Evento", zones: [], priceTiers: [], eventSeats: [] },
  );
  useEffect(() => { onChange?.(commercial); }, [commercial, onChange]);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeZoneId, setActiveZoneId] = useState<Id | null>(null);
  const [activeFloorIdState, setActiveFloorIdState] = useState<Id>("");
  const activeFloorId = physical.floors.some((f) => f.id === activeFloorIdState) ? activeFloorIdState : (physical.floors[0]?.id ?? "");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(new Set());
  const marqueeRef = useRef<{ active: boolean; start: Pt; current: Pt }>({ active: false, start: { x: 0, y: 0 }, current: { x: 0, y: 0 } });
  const requestRedrawRef = useRef<() => void>(() => { });

  const sectionLabelPoolRef = useRef<Text[]>([]);
  const elementLabelPoolRef = useRef<Text[]>([]);
  const seatLabelPoolRef = useRef<Text[]>([]);

  const zoneColorForSection = useCallback((sectionId: Id): string | undefined =>
    commercial.zones.find((z) => z.sectionIds.includes(sectionId))?.mapColor ?? undefined,
    [commercial.zones]);

  const eventSeatOf = useCallback((seatId: Id): EventSeat | undefined =>
    commercial.eventSeats.find(es => es.seatId === seatId),
    [commercial.eventSeats]);

  const draw = useCallback((layers: PixiLayers) => {
    const { world, mainGfx, handlesGfx, labelsLayer, app } = layers;
    mainGfx.clear(); handlesGfx.clear();
    const vp = getViewportWorldBounds();
    const visibleSections = physical.sections.filter((s) => s.floorId === activeFloorId);
    const visibleSectionIds = new Set(visibleSections.map(s => s.id));
    const visibleElements = physical.canvasElements.filter((e) => e.floorId === activeFloorId);
    const visibleSeats = physical.seats.filter((s) => visibleSectionIds.has(s.sectionId));

    // Render sections and elements
    renderSections({ gfx: mainGfx, labelsLayer, labelPool: sectionLabelPoolRef.current, sections: visibleSections, selectedIds: selectedIds, vp, colorOf: (z) => zoneColorForSection(z.id) || "#94a3b8", showLabels: true, zoom: world.scale.x });
    renderCanvasElements({ gfx: mainGfx, labelsLayer, labelPool: elementLabelPoolRef.current, elements: visibleElements, selectedIds: selectedIds, vp, zoom: world.scale.x });

    // Mostrar asientos con estado de event_seat
    renderSeats({
      gfx: mainGfx, labelsLayer: null, labelPool: seatLabelPoolRef.current,
      seats: visibleSeats, selectedIds: selectedIds, vp,
      colorOf: (seat) => hexToInt(zoneColorForSection(seat.sectionId), 0x94a3b8),
      statusOf: (seat) => {
        const es = eventSeatOf(seat.id);
        return es?.status === "DISABLED" ? "DISABLED" : seat.status;
      },
      showLabels: false,
      zoom: world.scale.x,
    });

    if (selectedIds.size > 0) {
      const obb = computeSelectionOBB(physical.sections, physical.canvasElements, physical.seats, selectedIds);
      if (obb) {
        const seatOnly = [...selectedIds].every((id) => physical.seats.some((s) => s.id === id));
        drawSelectionBBox(handlesGfx, obb, false, seatOnly);
      }
    }
    if (marqueeRef.current.active) drawMarquee(handlesGfx, marqueeRef.current.start.x, marqueeRef.current.start.y, marqueeRef.current.current.x, marqueeRef.current.current.y);
  }, [physical, selectedIds, activeFloorId, zoneColorForSection, eventSeatOf]);

  const handlePointerDown = useCallback((info: StagePointerInfo) => {
    const hit = hitTestAt(physical, info.world, activeFloorId);
    if (hit) {
      let nextSel: Set<Id>;
      if (info.shiftKey || info.ctrlKey || info.metaKey) {
        nextSel = new Set(selectedIds);
        nextSel.has(hit.id) ? nextSel.delete(hit.id) : nextSel.add(hit.id);
      } else {
        nextSel = selectedIds.has(hit.id) ? new Set(selectedIds) : new Set([hit.id]);
      }
      setSelectedIds(nextSel);
    } else if (!(info.shiftKey || info.ctrlKey || info.metaKey)) {
      setSelectedIds(new Set());
      marqueeRef.current = { active: true, start: info.world, current: info.world };
    }
  }, [physical, activeFloorId, selectedIds]);

  const handlePointerMove = useCallback((info: StagePointerInfo) => {
    if (marqueeRef.current.active) {
      marqueeRef.current.current = info.world;
      requestRedrawRef.current();
    }
  }, []);

  const handlePointerUp = useCallback((_info: StagePointerInfo) => {
    if (marqueeRef.current.active) {
      const m = marqueeRef.current;
      const x1 = Math.min(m.start.x, m.current.x), x2 = Math.max(m.start.x, m.current.x);
      const y1 = Math.min(m.start.y, m.current.y), y2 = Math.max(m.start.y, m.current.y);
      const ids = new Set<Id>();
      const validSectionIds = new Set(physical.sections.filter((z) => z.floorId === activeFloorId).map((z) => z.id));
      for (const z of physical.sections) if (z.floorId === activeFloorId && (z.coordinateX ?? 0) >= x1 && (z.coordinateX ?? 0) <= x2 && (z.coordinateY ?? 0) >= y1 && (z.coordinateY ?? 0) <= y2) ids.add(z.id);
      for (const s of physical.canvasElements) if (s.floorId === activeFloorId && s.coordinateX >= x1 && s.coordinateX <= x2 && s.coordinateY >= y1 && s.coordinateY <= y2) ids.add(s.id);
      for (const s of physical.seats) if (validSectionIds.has(s.sectionId) && (s.coordinateX ?? 0) >= x1 && (s.coordinateX ?? 0) <= x2 && (s.coordinateY ?? 0) >= y1 && (s.coordinateY ?? 0) <= y2) ids.add(s.id);
      setSelectedIds(ids);
      marqueeRef.current = { active: false, start: { x: 0, y: 0 }, current: { x: 0, y: 0 } };
      requestRedrawRef.current();
    }
  }, [physical, activeFloorId]);

  const { ready, zoom, requestRedraw, zoomBy, fitToBounds, getViewportWorldBounds } = usePixiStage(containerRef, {
    panWithLeftClick: false, showGrid: false, showRuler: false,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onWheelZoomChange: () => requestRedrawRef.current(),
  }, draw);
  requestRedrawRef.current = requestRedraw;
  useEffect(() => { requestRedraw(); }, [physical, commercial, activeFloorId, selectedIds, requestRedraw]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onUndo: undo, onRedo: redo,
    onZoomIn: () => zoomBy(1.2), onZoomOut: () => zoomBy(0.8),
    onFitView: () => fitToBounds(computeVenueBounds(physical)),
    onEscape: () => { setSelectedIds(new Set()); setActiveZoneId(null); },
  });

  const addZone = () => {
    const zone: EventZone = {
      id: uid("zone"), eventId: commercial.eventId, publicName: `Zona ${commercial.zones.length + 1}`,
      admissionType: "RESERVED", eventPrice: 0, availableCapacity: 0, mapColor: sectionColorFor(commercial.zones.length),
      maxTicketsPerPurchase: 10, status: "ACTIVE", sectionIds: [],
    };
    setCommercial((prev) => ({ ...prev, zones: [...prev.zones, zone] }));
    setActiveZoneId(zone.id);
  };
  const removeZone = (id: Id) => {
    setCommercial((prev) => ({
      ...prev,
      zones: prev.zones.filter((z) => z.id !== id),
      priceTiers: prev.priceTiers.filter((t) => t.eventZoneId !== id),
      eventSeats: prev.eventSeats.filter((es) => es.eventZoneId !== id),
    }));
    if (activeZoneId === id) { setActiveZoneId(null); }
  };
  const patchZone = (id: Id, patch: Partial<EventZone>) =>
    setCommercial((prev) => ({ ...prev, zones: prev.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) }));

  /*
   * Importa solo la parte "commercial" de un archivo exportado (o armado a
   * mano): las zonas de venta y a qué secciones apuntan. El "physical" del
   * archivo se ignora a propósito — el recinto en pantalla es el real del
   * evento (viene del backend), no algo que el organizador deba poder
   * reemplazar.
   *
   * Cada recinto nuevo trae ids reales distintos aunque tenga las mismas
   * secciones (mismo nombre, misma geometría): un archivo armado con ids
   * fijos de UN recinto en particular nunca sirve para otro. Por eso las
   * zonas se resuelven de preferencia por `sectionNames` (nombre de sección,
   * que sí se repite entre recintos hechos con la misma plantilla) contra el
   * recinto físico real de ESTE evento; `sectionIds` solo queda como
   * respaldo para archivos viejos que no traigan nombres. Lo que no matchea
   * ni por nombre ni por id se descarta con aviso, para no dejar zonas
   * apuntando a secciones fantasma.
   */
  const handleImportJSON = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await readJSONFile<VenueEditorFile>(file);
      if (!data.commercial) {
        toast.danger("El archivo no contiene una sección \"commercial\" (zonas de venta).");
        return;
      }
      const sectionIdById = new Set(physical.sections.map((s) => s.id));
      const sectionIdByName = new Map(physical.sections.map((s) => [s.name, s.id]));

      let unresolvedCount = 0;
      const zones: EventZone[] = data.commercial.zones.map((z) => {
        const resolvedIds = new Set<Id>();
        // sectionNames manda si viene poblado (sirve para cualquier recinto
        // con esos nombres); sectionIds solo es respaldo para archivos viejos.
        if (z.sectionNames && z.sectionNames.length > 0) {
          for (const name of z.sectionNames) {
            const id = sectionIdByName.get(name);
            if (id) resolvedIds.add(id);
            else unresolvedCount += 1;
          }
        } else {
          for (const id of z.sectionIds) {
            if (sectionIdById.has(id)) resolvedIds.add(id);
            else unresolvedCount += 1;
          }
        }

        return { ...z, eventId: commercial.eventId, sectionIds: [...resolvedIds], availableCapacity: 0 };
      });
      const zonesWithCapacity = zones.map((z) => ({ ...z, availableCapacity: computeZoneCapacity(z, physical) }));
      const eventSeats = generateEventSeats(zonesWithCapacity, physical, data.commercial.eventSeats);

      setCommercial({
        eventId: commercial.eventId,
        eventName: data.commercial.eventName || commercial.eventName,
        zones: zonesWithCapacity,
        priceTiers: data.commercial.priceTiers.map((t) => ({ ...t })),
        eventSeats,
      });
      setActiveZoneId(null);

      if (unresolvedCount > 0) {
        toast.danger(`Se importó, pero ${unresolvedCount} sección(es) del archivo no existen en este recinto y se omitieron.`);
      } else {
        toast.success("Zonas importadas");
      }
    } catch {
      toast.danger("Archivo JSON inválido.");
    } finally {
      e.target.value = "";
    }
  }, [physical, commercial.eventId, commercial.eventName, setCommercial]);

  const addPriceTier = (zoneId: Id) => {
    const count = commercial.priceTiers.filter((t) => t.eventZoneId === zoneId).length;
    const tier: EventZonePriceTier = { id: uid("tier"), eventZoneId: zoneId, name: `Etapa ${count + 1}`, price: 0, initialCapacity: null, availableCapacity: null, startsAt: null, endsAt: null, sortOrder: count, status: "PENDING" };
    setCommercial((prev) => ({ ...prev, priceTiers: [...prev.priceTiers, tier] }));
  };
  const patchPriceTier = (id: Id, patch: Partial<EventZonePriceTier>) =>
    setCommercial((prev) => ({ ...prev, priceTiers: prev.priceTiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const removePriceTier = (id: Id) =>
    setCommercial((prev) => ({ ...prev, priceTiers: prev.priceTiers.filter((t) => t.id !== id) }));

  const moveTier = (id: Id, direction: -1 | 1) => {
    setCommercial((prev) => {
      const idx = prev.priceTiers.findIndex(t => t.id === id);
      if (idx < 0) return prev;
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= prev.priceTiers.length) return prev;
      const tiers = [...prev.priceTiers];
      [tiers[idx], tiers[swapIdx]] = [tiers[swapIdx], tiers[idx]];
      return { ...prev, priceTiers: tiers.map((t, i) => ({ ...t, sortOrder: i })) };
    });
  };

  const assignSectionToZone = useCallback((sectionId: Id, newZoneId: string) => {
    setCommercial((prev) => {
      const zones = prev.zones.map((z) => ({
        ...z,
        sectionIds: z.sectionIds.filter((id) => id !== sectionId),
      }));
      if (newZoneId && newZoneId !== "NONE") {
        const target = zones.find(z => z.id === newZoneId);
        if (target) target.sectionIds.push(sectionId);
      }
      const updatedZones = zones.map((z) => ({ ...z, availableCapacity: computeZoneCapacity(z, physical) }));
      const eventSeats = generateEventSeats(updatedZones, physical, prev.eventSeats);
      return { ...prev, zones: updatedZones, eventSeats };
    });
  }, [physical, setCommercial]);

  const assignMultipleSectionsToZone = useCallback((newZoneId: string) => {
    const selectedSectionIdsArr = Array.from(selectedIds).filter(id => physical.sections.some(s => s.id === id));
    if (selectedSectionIdsArr.length === 0) return;

    setCommercial((prev) => {
      const zones = prev.zones.map((z) => ({
        ...z,
        sectionIds: z.sectionIds.filter((id) => !selectedSectionIdsArr.includes(id)),
      }));
      if (newZoneId && newZoneId !== "NONE") {
        const target = zones.find(z => z.id === newZoneId);
        if (target) {
          target.sectionIds.push(...selectedSectionIdsArr);
        }
      }
      const updatedZones = zones.map((z) => ({ ...z, availableCapacity: computeZoneCapacity(z, physical) }));
      const eventSeats = generateEventSeats(updatedZones, physical, prev.eventSeats);
      return { ...prev, zones: updatedZones, eventSeats };
    });
  }, [physical, setCommercial, selectedIds]);

  const toggleSeatState = useCallback((seatId: Id, disabled: boolean) => {
    setCommercial((prev) => {
      const existing = prev.eventSeats.find(es => es.seatId === seatId);
      const hitSeat = physical.seats.find(s => s.id === seatId);
      if (!hitSeat) return prev;
      const zone = prev.zones.find(z => z.sectionIds.includes(hitSeat.sectionId));
      if (!zone) return prev;

      if (existing) {
        return { ...prev, eventSeats: prev.eventSeats.map(es => es.seatId === seatId ? { ...es, status: disabled ? "DISABLED" : "AVAILABLE" } as EventSeat : es) };
      } else if (disabled) {
        const newEs: EventSeat = { id: uid("eventseat"), eventZoneId: zone.id, seatId: hitSeat.id, sectionId: hitSeat.sectionId, lockedUntil: null, status: "DISABLED" };
        return { ...prev, eventSeats: [...prev.eventSeats, newEs] };
      }
      return prev;
    });
  }, [physical, setCommercial]);

  const toggleMultipleSeatsState = useCallback((disabled: boolean) => {
    const selectedSeatIdsArr = Array.from(selectedIds).filter(id => physical.seats.some(s => s.id === id));
    if (selectedSeatIdsArr.length === 0) return;
    setCommercial((prev) => {
      let newEventSeats = [...prev.eventSeats];
      for (const seatId of selectedSeatIdsArr) {
        const existingIdx = newEventSeats.findIndex(es => es.seatId === seatId);
        const hitSeat = physical.seats.find(s => s.id === seatId);
        if (!hitSeat) continue;
        const zone = prev.zones.find(z => z.sectionIds.includes(hitSeat.sectionId));
        if (!zone) continue;

        if (existingIdx >= 0) {
          newEventSeats[existingIdx] = { ...newEventSeats[existingIdx], status: disabled ? "DISABLED" : "AVAILABLE" };
        } else if (disabled) {
          newEventSeats.push({ id: uid("eventseat"), eventZoneId: zone.id, seatId: hitSeat.id, sectionId: hitSeat.sectionId, lockedUntil: null, status: "DISABLED" });
        }
      }
      return { ...prev, eventSeats: newEventSeats };
    });
  }, [physical, setCommercial, selectedIds]);

  const activeZone = commercial.zones.find((z) => z.id === activeZoneId) || null;

  // Resumen de asientos por zona
  const zoneStats = (zone: EventZone) => {
    const total = computeZoneCapacity(zone, physical);
    const disabled = commercial.eventSeats.filter(es => es.eventZoneId === zone.id && es.status === "DISABLED").length;
    return { total, disabled, available: total - disabled };
  };

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Top Navbar Fila 1 */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex flex-row items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 items-center">
              <h2>Zonas Comerciales</h2>
              <div className="flex gap-1 items-center">
                <Tooltip>
                  <Button isIconOnly variant="ghost" size="sm" onPress={() => fileInputRef.current?.click()}>
                    <Upload />
                  </Button>
                  <Tooltip.Content showArrow offset={12}>
                    <Tooltip.Arrow />
                    <span>Importar JSON de zonas</span>
                  </Tooltip.Content>
                </Tooltip>
                <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportJSON} className="hidden" />

                <Tooltip>
                  <Button isIconOnly variant="ghost" size="sm" onPress={() => downloadJSON(exportVenueEditorFile(physical, commercial), `evento.json`)}>
                    <Download />
                  </Button>
                  <Tooltip.Content showArrow offset={12}>
                    <Tooltip.Arrow />
                    <span>Exportar JSON</span>
                  </Tooltip.Content>
                </Tooltip>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 items-center h-[36px]">
            {topbarEndContent}
          </div>
        </div>
      </div>

      {/* Contenedor Combinado de Fila 2 (Tabs) + Canvas */}
      <div className="flex flex-col gap-3 flex-1 min-h-0">
        {/* Fila 2: Movida adentro para unificarse con el Canvas */}
        <div className="flex flex-row items-center gap-1 p-2 shrink-0 bg-surface shadow-surface rounded-[10px] w-full overflow-x-auto scrollbar-none">
          <Tooltip>
            <Button isIconOnly variant="ghost" size="sm" className="shrink-0" onPress={() => setLeftOpen(!leftOpen)}>
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
                onSelectionChange={(key) => setActiveFloorIdState(key as string)}
              >
                <Tabs.ListContainer className="border-none">
                  <Tabs.List aria-label="Pisos">
                    {physical.floors.map((f) => (
                      <Tabs.Tab key={f.id} id={f.id} className="w-max px-3 h-9 flex items-center justify-center cursor-pointer relative">
                        <span className="relative z-10">{f.name}</span>
                        <Tabs.Indicator className="bg-default size-full rounded-[10px]" />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
            </ScrollShadow>
          </div>

          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />

          {topbarStartContent}

          {activeZone && (
            <Tooltip>
              <div>
                <ColorField value={activeZone.mapColor || "#2563eb"} onCommit={(v) => patchZone(activeZone.id, { mapColor: v })} />
              </div>
              <Tooltip.Content showArrow offset={12}>
                <Tooltip.Arrow />
                <span>Color</span>
              </Tooltip.Content>
            </Tooltip>
          )}

          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />

          <Tooltip>
            <Button isIconOnly variant="ghost" size="sm" className="shrink-0" onPress={() => fitToBounds(computeVenueBounds(physical))}>
              <LocateFixed />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">Ajustar a la vista<Kbd><Kbd.Abbr keyValue="ctrl" /><Kbd.Content>0</Kbd.Content></Kbd></span>
            </Tooltip.Content>
          </Tooltip>

          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />

          <Tooltip>
            <Button isIconOnly variant="ghost" size="sm" className="shrink-0" onPress={undo} isDisabled={!canUndo}>
              <Undo2 />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">Deshacer<Kbd><Kbd.Abbr keyValue="ctrl" /><Kbd.Content>Z</Kbd.Content></Kbd></span>
            </Tooltip.Content>
          </Tooltip>

          <Tooltip>
            <Button isIconOnly variant="ghost" size="sm" className="shrink-0" onPress={redo} isDisabled={!canRedo}>
              <Redo2 />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">Rehacer<Kbd><Kbd.Abbr keyValue="ctrl" /><Kbd.Content>Y</Kbd.Content></Kbd></span>
            </Tooltip.Content>
          </Tooltip>

          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />

          <Tooltip>
            <Button isIconOnly variant="ghost" size="sm" className="shrink-0" onPress={() => zoomBy(1.2)}>
              <ZoomIn />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">Acercar<Kbd><Kbd.Content>+</Kbd.Content></Kbd></span>
            </Tooltip.Content>
          </Tooltip>

          <NumberField
            variant="secondary"
            minValue={20}
            maxValue={1000}
            step={1}
            value={Math.round(zoom * 100)}
            onChange={(v) => { if (v > 0 && zoom > 0) zoomBy((v / 100) / zoom); }}
          >
            <NumberField.Group className="grid-cols-[1fr_auto]">
              <NumberField.Input className="text-center w-15 text-sm" />
              <p className="flex text-field-placeholder text-sm pr-3 items-center">%</p>
            </NumberField.Group>
          </NumberField>

          <Tooltip>
            <Button isIconOnly variant="ghost" size="sm" className="shrink-0" onPress={() => zoomBy(0.8)}>
              <ZoomOut />
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span className="flex items-center gap-1">Alejar<Kbd><Kbd.Content>-</Kbd.Content></Kbd></span>
            </Tooltip.Content>
          </Tooltip>

          <Separator orientation="vertical" className="h-1/2 mx-1 self-center" />

          <Tooltip>
            <Button isIconOnly variant="ghost" size="sm" className="shrink-0" onPress={() => setRightOpen(!rightOpen)}>
              {rightOpen ? <PanelLeftOpen /> : <PanelRightOpen />}
            </Button>
            <Tooltip.Content showArrow offset={12}>
              <Tooltip.Arrow />
              <span>{rightOpen ? 'Ocultar panel derecho' : 'Mostrar panel derecho'}</span>
            </Tooltip.Content>
          </Tooltip>
        </div>

        {/* Contenedor Base Relativo (Actúa como borde/padding) */}
        <main className="relative flex-1 overflow-hidden w-full h-full flex flex-row">
          {/* Panel izquierdo */}
          <Panel isOpen={leftOpen} onOpenChange={setLeftOpen} isDrawer={!isDesktop} placement="left" className="pointer-events-auto">
            <div className="flex flex-col h-full">
              <div className="px-4 py-4 flex flex-col gap-3 min-h-0 flex-1 overflow-y-auto">
                <div className="flex gap-1">
                  <div className="pt-1 flex flex-col gap-3 w-full">
                    <div className="flex justify-between gap-4">
                      <h4 className="line-clamp-3">{physical.floors.find(f => f.id === activeFloorId)?.name || "Piso"}</h4>
                      
                      <Tooltip>
                        <Button isIconOnly variant="ghost" size="sm" className="shrink-0" onPress={addZone}>
                          <Plus />
                        </Button>
                        <Tooltip.Content showArrow offset={12}>
                          <Tooltip.Arrow />
                          <span>Agregar zona comercial</span>
                        </Tooltip.Content>
                      </Tooltip>
                    </div>
                    
                    <SearchField
                      name="search-zones"
                      variant="secondary"
                      className="w-full"
                      value={searchQuery}
                      onChange={setSearchQuery}
                    >
                      <SearchField.Group>
                        <SearchField.SearchIcon>
                          <Search />
                        </SearchField.SearchIcon>
                        <SearchField.Input placeholder="Buscar zonas..." />
                        <SearchField.ClearButton>
                          <X />
                        </SearchField.ClearButton>
                      </SearchField.Group>
                    </SearchField>
                  </div>
                </div>

                <ScrollShadow className="flex flex-col gap-3 -mx-2 overflow-y-auto overflow-x-hidden px-2 pb-2">
                  {commercial.zones.filter(z => !searchQuery || (z.publicName || "Nueva zona").toLowerCase().includes(searchQuery.toLowerCase())).map((z) => {
                    const stats = zoneStats(z);
                    const active = z.id === activeZoneId;
                    return (
                      <button
                        key={z.id}
                        type="button"
                        className={` text-left w-full rounded-[10px] cursor-pointer flex flex-col transition-all duration-300 group active:outline-none p-2 gap-0.5 ${active ? "bg-default" : "bg-default-soft"}`}
                        onClick={() => setActiveZoneId(z.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs truncate ${active ? "text-foreground font-semibold" : "text-foreground font-medium"}`}>{z.publicName || "Nueva zona"}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 text-destructive"
                            isIconOnly
                            onPress={(e: any) => {
                              e.stopPropagation?.();
                              removeZone(z.id);
                            }}
                          >
                            <Trash2 className="size-3.5 text-danger" />
                          </Button>
                        </div>
                        <span className="text-muted text-[11px]">
                          {z.sectionIds.length} secciones · {stats.available}/{stats.total} lugares
                          {stats.disabled > 0 && <span className="text-danger"> ({stats.disabled} deshabilitados)</span>}
                        </span>
                      </button>
                    );
                  })}
                </ScrollShadow>
              </div>
            </div>
          </Panel>

    {/* Lienzo */}
        <div className="relative flex-1 rounded-[10px] overflow-hidden bg-surface shadow-surface">
          <div className="absolute inset-0 z-0 bg-surface" ref={containerRef}></div>
          {!ready && (
            <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
        </div>

        {/* Panel derecho */}
        <Panel isOpen={rightOpen} onOpenChange={setRightOpen} isDrawer={!isDesktop} placement="right" className="pointer-events-auto">
        {/* Caso 1: Nada seleccionado en el lienzo, mostramos propiedades de la Zona activa */}
        {selectedIds.size === 0 && activeZone && (
          <div>
            <div className="px-3 py-3 flex flex-col gap-3">
              <h4 className="text-foreground line-clamp-3">{activeZone.publicName || "Nueva zona"}</h4>
              <Description>Propiedades de la zona comercial</Description>
            </div>
            
            <Accordion allowsMultipleExpanded className="w-full border-t border-border" defaultExpandedKeys={["info", "precios"]}>
              <Accordion.Item id="info">
                <Accordion.Heading><Accordion.Trigger>Información <Accordion.Indicator/></Accordion.Trigger></Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="flex flex-col gap-3">
                    <TextField variant="secondary" value={activeZone.publicName} onChange={(v: string) => patchZone(activeZone.id, { publicName: v })}>
                      <Label>Nombre público</Label>
                      <Input />
                    </TextField>

                    <Select variant="secondary" aria-label="Tipo de admisión" value={activeZone.admissionType} onChange={(v: any) => patchZone(activeZone.id, { admissionType: v })}>
                      <Label>Tipo de admisión</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="RESERVED" textValue="Asiento reservado">Asiento reservado <ListBox.ItemIndicator /></ListBox.Item>
                          <ListBox.Item id="GENERAL" textValue="General">General <ListBox.ItemIndicator /></ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>

                    <div className="grid grid-cols-2 gap-2">
                      <NumberField variant="secondary" value={activeZone.eventPrice} minValue={0} onChange={(v) => patchZone(activeZone.id, { eventPrice: v })}>
                        <Label>Precio base ($)</Label>
                        <NumberField.Group className="grid-cols-[1fr]">
                          <NumberField.Input />
                        </NumberField.Group>
                      </NumberField>

                      <NumberField variant="secondary" value={activeZone.maxTicketsPerPurchase} minValue={1} onChange={(v) => patchZone(activeZone.id, { maxTicketsPerPurchase: v })}>
                        <Label>Max. boletos</Label>
                        <NumberField.Group className="grid-cols-[1fr]">
                          <NumberField.Input />
                        </NumberField.Group>
                      </NumberField>
                    </div>

                    <Select variant="secondary" aria-label="Estatus" value={activeZone.status} onChange={(v: any) => patchZone(activeZone.id, { status: v })}>
                      <Label>Estatus</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="ACTIVE" textValue="Activo">Activo <ListBox.ItemIndicator /></ListBox.Item>
                          <ListBox.Item id="INACTIVE" textValue="Inactivo">Inactivo <ListBox.ItemIndicator /></ListBox.Item>
                          <ListBox.Item id="SOLD_OUT" textValue="Agotado">Agotado <ListBox.ItemIndicator /></ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>

              {/* Oculto temporalmente: Etapas de Precios
              <Accordion.Item id="precios">
                <Accordion.Heading><Accordion.Trigger>Precios <Accordion.Indicator/></Accordion.Trigger></Accordion.Heading>
                <Accordion.Panel>
                  <Accordion.Body className="flex flex-col gap-3">
                    {commercial.priceTiers.filter(t => t.eventZoneId === activeZone.id).map((t) => (
                      <div key={t.id} className="border-t border-border pt-3 flex flex-col gap-3">
                        <div className="flex gap-1.5 items-end">
                          <TextField className="flex-1" variant="secondary" value={t.name} onChange={(v: string) => patchPriceTier(t.id, { name: v })}>
                            <Label>Nombre</Label>
                            <Input />
                          </TextField>
                          <Button isIconOnly variant="ghost" className="text-destructive shrink-0" size="sm" onPress={() => removePriceTier(t.id)}><Trash2 className="size-4 text-danger"/></Button>
                        </div>
                        
                        <NumberField className="w-full" variant="secondary" value={t.price} onChange={(v) => patchPriceTier(t.id, { price: v })}>
                          <Label>Precio ($)</Label>
                          <NumberField.Group>
                            <NumberField.Input />
                          </NumberField.Group>
                        </NumberField>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <NumberField variant="secondary" value={t.initialCapacity ?? 0} minValue={0} onChange={(v) => patchPriceTier(t.id, { initialCapacity: v || null })}>
                            <Label>Aforo inicial</Label>
                            <NumberField.Group className="grid-cols-[1fr]">
                              <NumberField.Input />
                            </NumberField.Group>
                          </NumberField>

                          <Select variant="secondary" aria-label="Estatus" value={t.status} onChange={(v: any) => patchPriceTier(t.id, { status: v })}>
                            <Label>Estatus</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                <ListBox.Item id="PENDING" textValue="Pendiente">Pendiente <ListBox.ItemIndicator /></ListBox.Item>
                                <ListBox.Item id="ACTIVE" textValue="Activo">Activo <ListBox.ItemIndicator /></ListBox.Item>
                                <ListBox.Item id="EXHAUSTED" textValue="Agotado">Agotado <ListBox.ItemIndicator /></ListBox.Item>
                                <ListBox.Item id="CLOSED" textValue="Cerrado">Cerrado <ListBox.ItemIndicator /></ListBox.Item>
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-2">
                          <DateTimeField label="Inicia" value={t.startsAt} onCommit={(v) => patchPriceTier(t.id, { startsAt: v })} />
                          <DateTimeField label="Termina" value={t.endsAt} onCommit={(v) => patchPriceTier(t.id, { endsAt: v })} />
                        </div>
                      </div>
                    ))}
                    <Button variant="secondary" size="sm" onPress={() => addPriceTier(activeZone.id)}>Agregar precio</Button>
                  </Accordion.Body>
                </Accordion.Panel>
              </Accordion.Item>
              */}
            </Accordion>
          </div>
        )}

        {/* Caso 2: Nada seleccionado, ni zona activa */}
        {selectedIds.size === 0 && !activeZone && (
          <div className="flex flex-1 flex-col items-center justify-center p-4 text-center gap-1">
            <Label>Sin selección</Label>
            <Description>Haz clic en una sección o asiento del lienzo, o selecciona una zona comercial a la izquierda.</Description>
          </div>
        )}
        
        {/* Caso 3: Un solo objeto seleccionado en el lienzo */}
        {selectedIds.size === 1 && (() => {
          const id = [...selectedIds][0];
          const selectedSection = physical.sections.find(z => z.id === id);
          const selectedSeat = physical.seats.find(s => s.id === id);
          if (selectedSection) {
            return (
              <div className="flex flex-col gap-3">
                <div className="px-3 py-3 flex flex-col gap-3">
                  <h4 className="line-clamp-3">{selectedSection.name}</h4>
                  <Description>Aforo: {selectedSection.capacity}</Description>
                </div>
                <Accordion allowsMultipleExpanded className="w-full border-t border-border" defaultExpandedKeys={["info"]}>
                  <Accordion.Item id="info">
                    <Accordion.Heading><Accordion.Trigger>Información <Accordion.Indicator/></Accordion.Trigger></Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">
                        <Select
                          variant="secondary"
                          aria-label="Zona comercial"
                          value={commercial.zones.find(z => z.sectionIds.includes(selectedSection.id))?.id || ""}
                          onChange={(v: any) => assignSectionToZone(selectedSection.id, v || "")}
                        >
                          <Label>Zona comercial</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="" textValue="Ninguna">Ninguna <ListBox.ItemIndicator/></ListBox.Item>
                              {commercial.zones.map(z => (
                                <ListBox.Item key={z.id} id={z.id} textValue={z.publicName}>{z.publicName} <ListBox.ItemIndicator/></ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </div>
            );
          }
          if (selectedSeat) {
            const section = physical.sections.find(z => z.id === selectedSeat.sectionId);
            const inZone = commercial.zones.some(z => z.sectionIds.includes(selectedSeat.sectionId));
            return (
              <div className="flex flex-col gap-3">
                <div className="px-3 py-3 flex flex-col gap-3">
                  <h4 className="line-clamp-3">Asiento {selectedSeat.row}{selectedSeat.number}</h4>
                  <Description>Sección: {section?.name}</Description>
                </div>
                <Accordion allowsMultipleExpanded className="w-full border-t border-border" defaultExpandedKeys={["info"]}>
                  <Accordion.Item id="info">
                    <Accordion.Heading><Accordion.Trigger>Información <Accordion.Indicator/></Accordion.Trigger></Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body className="flex flex-col gap-3">
                        {!inZone && <p className="text-danger text-xs">La sección de este asiento no tiene zona comercial asignada.</p>}
                        <CheckField
                          label="Deshabilitado (bloqueado)"
                          checked={eventSeatOf(selectedSeat.id)?.status === "DISABLED"}
                          onCommit={(disabled) => toggleSeatState(selectedSeat.id, disabled)}
                        />
                      </Accordion.Body>
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </div>
            );
          }
          return null;
        })()}
        
        {/* Caso 4: Selección múltiple en el lienzo */}
        {selectedIds.size > 1 && (
          <div>
             <div className="px-3 py-3 flex flex-col gap-3">
               <h4 className="line-clamp-3">{selectedIds.size} <Description className="ml-1 inline-flex">Objetos seleccionados</Description></h4>
             </div>
             <Accordion allowsMultipleExpanded className="w-full border-t border-border" defaultExpandedKeys={["acciones"]}>
               <Accordion.Item id="acciones">
                 <Accordion.Heading><Accordion.Trigger>Acciones en lote <Accordion.Indicator/></Accordion.Trigger></Accordion.Heading>
                 <Accordion.Panel>
                   <Accordion.Body className="flex flex-col gap-4">
                      {Array.from(selectedIds).some(id => physical.sections.some(s => s.id === id)) && (
                        <Select
                          variant="secondary"
                          aria-label="Zona comercial (lote)"
                          value=""
                          onChange={(v: any) => { if (v) assignMultipleSectionsToZone(v); }}
                        >
                          <Label>Asignar Zona comercial</Label>
                          <Select.Trigger>
                            <p className="text-field-placeholder">Seleccionar zona...</p>
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="NONE" textValue="Ninguna (quitar de zona)">Ninguna (quitar de zona) <ListBox.ItemIndicator/></ListBox.Item>
                              {commercial.zones.map(z => (
                                <ListBox.Item key={z.id} id={z.id} textValue={z.publicName}>{z.publicName} <ListBox.ItemIndicator/></ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      )}
                      
                      {Array.from(selectedIds).some(id => physical.seats.some(s => s.id === id)) && (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="secondary" fullWidth onPress={() => toggleMultipleSeatsState(true)}>Deshabilitar</Button>
                          <Button size="sm" variant="ghost" fullWidth onPress={() => toggleMultipleSeatsState(false)}>Habilitar</Button>
                        </div>
                      )}
                   </Accordion.Body>
                 </Accordion.Panel>
               </Accordion.Item>
              </Accordion>
           </div>
          )}
        </Panel>
      </main>
      </div>
    </div>
  );
}
