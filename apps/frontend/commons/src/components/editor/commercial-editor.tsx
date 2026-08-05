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
import { Button } from "@heroui/react";
import { ChevronDown, ChevronUp, Download, Loader2, Maximize, Minus, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import type { Id, Pt, PhysicalVenueState, CommercialEventState, EventZone, EventZonePriceTier, EventSeat } from "./types";
import { uid, sectionIsNumbered } from "./types";
import { sectionColorFor } from "./constants";
import { useHistory } from "./history";
import { usePixiStage, type PixiLayers, type StagePointerInfo } from "./canvas-engine";
import { drawGrid, drawRuler, renderSections, renderCanvasElements, renderSeats, hexToInt } from "./rendering";
import { computeZoneCapacity, computeVenueBounds, hitTestAt, drawMarquee, computeSelectionOBB, drawSelectionBBox } from "./selection";
import { useKeyboardShortcuts } from "./keyboard";
import { downloadJSON, exportVenueEditorFile } from "./serialization";
import { NumField, TextField, ColorField, SelectField, CheckField, DateTimeField } from "./controls";

const selectClassName =
  "w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none cursor-pointer focus:border-foreground transition-colors";
const fieldLabelClassName = "text-muted text-[10px] font-semibold uppercase tracking-wide";

export interface CommercialEditorProps {
  physical: PhysicalVenueState;
  initialCommercial?: CommercialEventState;
  onChange?: (state: CommercialEventState) => void;
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

export default function CommercialEditor({ physical, initialCommercial, onChange }: CommercialEditorProps) {
  const { state: commercial, commit: setCommercial, undo, redo, canUndo, canRedo } = useHistory<CommercialEventState>(
    initialCommercial ?? { eventId: uid("event"), eventName: "Nuevo Evento", zones: [], priceTiers: [], eventSeats: [] },
  );
  useEffect(() => { onChange?.(commercial); }, [commercial, onChange]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeZoneId, setActiveZoneId] = useState<Id | null>(null);
  const [activeFloorIdState, setActiveFloorIdState] = useState<Id>("");
  const activeFloorId = physical.floors.some((f) => f.id === activeFloorIdState) ? activeFloorIdState : (physical.floors[0]?.id ?? "");

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
    <div className="flex h-full w-full">
      {/* Panel izquierdo: evento, piso, zonas */}
      <div className="w-75 shrink-0 overflow-y-auto p-3 border-r border-border bg-surface flex flex-col gap-3">
        <TextField label="Nombre del evento" value={commercial.eventName} onCommit={(v) => setCommercial((p) => ({ ...p, eventName: v }))} />

        <SelectField
          label="Filtro de piso"
          value={activeFloorId}
          options={physical.floors.map((f) => ({ value: f.id, label: f.name }))}
          onCommit={(v) => setActiveFloorIdState(v)}
        />

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onPress={addZone}>
            <Plus className="size-3.5" />
            Zona de venta
          </Button>
          <Button size="sm" variant="ghost" isIconOnly isDisabled={!canUndo} onPress={undo} title="Deshacer">
            <Undo2 className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" isIconOnly isDisabled={!canRedo} onPress={redo} title="Rehacer">
            <Redo2 className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            title="Exportar JSON"
            onPress={() => downloadJSON(exportVenueEditorFile(physical, commercial), `${commercial.eventName || "evento"}.json`)}
          >
            <Download className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          {commercial.zones.map((z) => {
            const stats = zoneStats(z);
            const active = z.id === activeZoneId;
            return (
              <div
                key={z.id}
                className={`rounded-[10px] border p-2 flex flex-col gap-0.5 cursor-pointer transition-colors ${
                  active ? "border-foreground bg-surface-secondary" : "border-border hover:bg-surface-secondary"
                }`}
                onClick={() => setActiveZoneId(z.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs truncate ${active ? "text-foreground font-semibold" : "text-foreground font-medium"}`}>{z.publicName}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    color="danger"
                    isIconOnly
                    onPress={(e) => {
                      (e as unknown as React.MouseEvent).stopPropagation?.();
                      removeZone(z.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <span className="text-muted text-[11px]">
                  {z.sectionIds.length} secciones · {stats.available}/{stats.total} lugares
                  {stats.disabled > 0 && <span className="text-danger"> ({stats.disabled} deshabilitados)</span>}
                </span>
              </div>
            );
          })}
        </div>

        {activeZone && (
          <div className="mt-1 pt-3 border-t border-border flex flex-col gap-2.5">
            <div>
              <h4 className="text-foreground">{activeZone.publicName}</h4>
              <p className="text-muted text-xs mt-0.5">Haz clic en las secciones del lienzo para asignarlas o quitarlas de esta zona.</p>
            </div>
            <TextField label="Nombre público" value={activeZone.publicName} onCommit={(v) => patchZone(activeZone.id, { publicName: v })} />
            <SelectField label="Tipo de admisión" value={activeZone.admissionType} options={[{ value: "RESERVED", label: "Asiento reservado" }, { value: "GENERAL", label: "General" }]} onCommit={(v) => patchZone(activeZone.id, { admissionType: v })} />
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Precio base" value={activeZone.eventPrice} step={1} min={0} onCommit={(v) => patchZone(activeZone.id, { eventPrice: v })} />
              <NumField label="Máx. boletos/compra" value={activeZone.maxTicketsPerPurchase} step={1} min={1} onCommit={(v) => patchZone(activeZone.id, { maxTicketsPerPurchase: v })} />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className={fieldLabelClassName}>Color en mapa</label>
                <ColorField value={activeZone.mapColor || "#2563eb"} onCommit={(v) => patchZone(activeZone.id, { mapColor: v })} />
              </div>
              <div className="flex-1">
                <SelectField label="Estado" value={activeZone.status} options={[{ value: "ACTIVE", label: "Activa" }, { value: "INACTIVE", label: "Inactiva" }, { value: "SOLD_OUT", label: "Agotada" }]} onCommit={(v) => patchZone(activeZone.id, { status: v })} />
              </div>
            </div>

            <div className="pt-2 border-t border-border flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-foreground font-semibold text-xs">Etapas de precio</p>
                <Button size="sm" variant="ghost" onPress={() => addPriceTier(activeZone.id)}>
                  <Plus className="size-3.5" />
                  Etapa
                </Button>
              </div>
              {commercial.priceTiers
                .filter((t) => t.eventZoneId === activeZone.id)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((t) => (
                  <div key={t.id} className="border-t border-border pt-2 flex flex-col gap-2">
                    <div className="flex gap-1.5 items-end">
                      <div className="flex-1">
                        <TextField label="Nombre" value={t.name} onCommit={(v) => patchPriceTier(t.id, { name: v })} />
                      </div>
                      <Button size="sm" variant="ghost" isIconOnly onPress={() => moveTier(t.id, -1)} title="Subir">
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" isIconOnly onPress={() => moveTier(t.id, 1)} title="Bajar">
                        <ChevronDown className="size-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumField label="Precio" value={t.price} step={1} min={0} onCommit={(v) => patchPriceTier(t.id, { price: v })} />
                      <NumField label="Capacidad inicial" value={t.initialCapacity ?? 0} step={10} min={0} onCommit={(v) => patchPriceTier(t.id, { initialCapacity: v || null })} />
                    </div>
                    <DateTimeField label="Inicio" value={t.startsAt} onCommit={(v) => patchPriceTier(t.id, { startsAt: v })} />
                    <DateTimeField label="Fin" value={t.endsAt} onCommit={(v) => patchPriceTier(t.id, { endsAt: v })} />
                    <SelectField label="Estado" value={t.status} options={[{ value: "PENDING", label: "Pendiente" }, { value: "ACTIVE", label: "Activa" }, { value: "EXHAUSTED", label: "Agotada" }, { value: "CLOSED", label: "Cerrada" }]} onCommit={(v) => patchPriceTier(t.id, { status: v })} />
                    <Button size="sm" variant="ghost" color="danger" fullWidth onPress={() => removePriceTier(t.id)}>
                      <Trash2 className="size-3.5" />
                      Eliminar etapa
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Lienzo */}
      <div className="flex-1 relative bg-background">
        <div ref={containerRef} className="absolute inset-0" style={{ touchAction: "none" }} />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted text-sm">
            <Loader2 className="size-4 animate-spin" />
            Cargando lienzo…
          </div>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-surface/95 backdrop-blur border border-border rounded-[10px] p-1 shadow-overlay">
          <Button size="sm" variant="ghost" isIconOnly onPress={() => zoomBy(1.2)} title="Acercar">
            <Plus className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" isIconOnly onPress={() => zoomBy(0.8)} title="Alejar">
            <Minus className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" isIconOnly onPress={() => fitToBounds(computeVenueBounds(physical))} title="Ajustar a la vista">
            <Maximize className="size-4" />
          </Button>
          <span className="text-muted text-[11px] px-1.5 font-mono">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Panel derecho: selección */}
      <div className="w-70 shrink-0 overflow-y-auto p-3 border-l border-border bg-surface flex flex-col gap-3">
        {selectedIds.size === 0 && <p className="text-muted text-xs">Sin selección. Haz clic en una sección o asiento del lienzo.</p>}
        {selectedIds.size === 1 && (() => {
          const id = [...selectedIds][0];
          const selectedSection = physical.sections.find(z => z.id === id);
          const selectedSeat = physical.seats.find(s => s.id === id);
          if (selectedSection) {
            return (
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-foreground font-semibold text-sm">Sección: {selectedSection.name}</p>
                  <p className="text-muted text-xs mt-0.5">Aforo: {selectedSection.capacity}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={fieldLabelClassName}>Zona comercial</label>
                  <select
                    value={commercial.zones.find(z => z.sectionIds.includes(selectedSection.id))?.id || ""}
                    onChange={(e) => assignSectionToZone(selectedSection.id, e.target.value)}
                    className={selectClassName}
                  >
                    <option value="">Ninguna</option>
                    {commercial.zones.map(z => (
                      <option key={z.id} value={z.id}>{z.publicName}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          }
          if (selectedSeat) {
            const section = physical.sections.find(z => z.id === selectedSeat.sectionId);
            const inZone = commercial.zones.some(z => z.sectionIds.includes(selectedSeat.sectionId));
            return (
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-foreground font-semibold text-sm">Asiento {selectedSeat.row}{selectedSeat.number}</p>
                  <p className="text-muted text-xs mt-0.5">Sección: {section?.name}</p>
                </div>
                {!inZone && <p className="text-danger text-xs">La sección de este asiento no tiene zona comercial asignada.</p>}
                <CheckField
                  label="Deshabilitado (bloqueado)"
                  checked={eventSeatOf(selectedSeat.id)?.status === "DISABLED"}
                  onCommit={(disabled) => toggleSeatState(selectedSeat.id, disabled)}
                />
              </div>
            );
          }
          return null;
        })()}
        {selectedIds.size > 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-foreground font-semibold text-sm">{selectedIds.size} objetos seleccionados</p>
            {Array.from(selectedIds).some(id => physical.sections.some(s => s.id === id)) && (
              <div className="flex flex-col gap-1">
                <label className={fieldLabelClassName}>Zona comercial (lote)</label>
                <select
                  value=""
                  onChange={(e) => assignMultipleSectionsToZone(e.target.value)}
                  className={selectClassName}
                >
                  <option value="" disabled>Seleccionar zona...</option>
                  <option value="NONE">Ninguna (quitar de zona)</option>
                  {commercial.zones.map(z => (
                    <option key={z.id} value={z.id}>{z.publicName}</option>
                  ))}
                </select>
              </div>
            )}
            {Array.from(selectedIds).some(id => physical.seats.some(s => s.id === id)) && (
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" fullWidth onPress={() => toggleMultipleSeatsState(true)}>
                  Deshabilitar
                </Button>
                <Button size="sm" variant="ghost" fullWidth onPress={() => toggleMultipleSeatsState(false)}>
                  Habilitar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
