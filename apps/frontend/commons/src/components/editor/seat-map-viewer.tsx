"use client";

/**
 * seat-map-viewer.tsx — Mapa de asientos (usuarios CLIENTES, solo lectura + clic para elegir)
 *
 * Reutiliza el mismo motor de canvas (PixiJS) que PhysicalEditor/CommercialEditor,
 * pero como componente controlado: la selección vive en el padre (el carrito real
 * de compra), este componente solo dibuja el plano coloreado por zona comercial y
 * reporta clics sobre asientos reservables. No persiste nada ni conoce holds/checkout.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "pixi.js";
import { Button } from "@heroui/react";
import { Minus, Plus, Maximize } from "lucide-react";
import type { Id, PhysicalVenueState, EventZone } from "./types";
import { SEAT_RADIUS } from "./constants";
import { usePixiStage, type PixiLayers, type StagePointerInfo } from "./canvas-engine";
import { renderSections, renderCanvasElements, renderSeats, hexToInt } from "./rendering";
import { computeVenueBounds } from "./selection";
import { useKeyboardShortcuts } from "./keyboard";

export interface SeatMapViewerProps {
  physical: PhysicalVenueState;
  /** Solo necesita id/sectionIds/mapColor/admissionType/status para colorear y decidir si un asiento es clicable. */
  zones: EventZone[];
  selectedSeatIds: Set<Id>;
  /** Asientos vendidos/reservados/deshabilitados: se pintan apagados y no son clicables. */
  unavailableSeatIds: Set<Id>;
  onToggleSeat: (seatId: Id) => void;
  className?: string;
}

export default function SeatMapViewer({
  physical,
  zones,
  selectedSeatIds,
  unavailableSeatIds,
  onToggleSeat,
  className,
}: SeatMapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeFloorIdState, setActiveFloorIdState] = useState<Id>("");
  const activeFloorId = physical.floors.some((f) => f.id === activeFloorIdState)
    ? activeFloorIdState
    : (physical.floors[0]?.id ?? "");
  const sectionLabelPoolRef = useRef<Text[]>([]);
  const elementLabelPoolRef = useRef<Text[]>([]);
  const seatLabelPoolRef = useRef<Text[]>([]);
  const didFitRef = useRef<string>("");

  const zoneOfSection = useCallback((sectionId: Id) => zones.find((z) => z.sectionIds.includes(sectionId)), [zones]);

  const draw = useCallback(
    (layers: PixiLayers) => {
      const { mainGfx, handlesGfx, labelsLayer, world } = layers;
      mainGfx.clear();
      handlesGfx.clear();
      const vp = getViewportWorldBounds();
      const visibleSections = physical.sections.filter((s) => s.floorId === activeFloorId);
      const visibleSectionIds = new Set(visibleSections.map((s) => s.id));
      const visibleElements = physical.canvasElements.filter((e) => e.floorId === activeFloorId);
      // Las secciones de zonas GENERAL (admisión general) sí pueden tener
      // asientos físicos dibujados en el editor de Admin, pero se venden por
      // cantidad, no por asiento puntual (ver el stepper arriba del mapa):
      // no se dibujan asiento por asiento para no aparentar que se pueden
      // elegir uno por uno. La sección igual se ve completa, coloreada por
      // su zona, solo sin la grilla de asientos individuales encima.
      const visibleSeats = physical.seats.filter((s) => {
        if (!visibleSectionIds.has(s.sectionId)) return false;
        return zoneOfSection(s.sectionId)?.admissionType === "RESERVED";
      });

      renderSections({
        gfx: mainGfx,
        labelsLayer,
        labelPool: sectionLabelPoolRef.current,
        sections: visibleSections,
        selectedIds: new Set(),
        vp,
        colorOf: (s) => zoneOfSection(s.id)?.mapColor || "#94a3b8",
        showLabels: true,
        zoom: world.scale.x,
      });
      renderCanvasElements({
        gfx: mainGfx,
        labelsLayer,
        labelPool: elementLabelPoolRef.current,
        elements: visibleElements,
        selectedIds: new Set(),
        vp,
        zoom: world.scale.x,
      });
      renderSeats({
        gfx: mainGfx,
        labelsLayer,
        labelPool: seatLabelPoolRef.current,
        seats: visibleSeats,
        selectedIds: selectedSeatIds,
        vp,
        colorOf: (seat) => hexToInt(zoneOfSection(seat.sectionId)?.mapColor, 0x94a3b8),
        // Las zonas GENERAL (admisión general) no se compran eligiendo un
        // asiento — se pintan apagadas, igual que "ocupado", para que quede
        // claro a simple vista que no son clicables (el stepper de arriba sí
        // los vende, solo que por cantidad, no por asiento puntual).
        statusOf: (seat) => {
          const zone = zoneOfSection(seat.sectionId);
          if (!zone || zone.admissionType !== "RESERVED") return "DISABLED";
          return unavailableSeatIds.has(seat.id) ? "SOLD" : "AVAILABLE";
        },
        showLabels: true,
        labelOf: (seat) => `${seat.row}${seat.number}`,
        zoom: world.scale.x,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [physical, zoneOfSection, selectedSeatIds, unavailableSeatIds, activeFloorId],
  );

  const handlePointerDown = useCallback(
    (info: StagePointerInfo) => {
      const hitSeat = physical.seats.find((s) => {
        const section = physical.sections.find((sec) => sec.id === s.sectionId);
        if (section?.floorId !== activeFloorId) return false;
        return Math.hypot((s.coordinateX ?? 0) - info.world.x, (s.coordinateY ?? 0) - info.world.y) < SEAT_RADIUS + 4;
      });
      if (!hitSeat) return;
      const zone = zoneOfSection(hitSeat.sectionId);
      if (!zone || zone.admissionType !== "RESERVED" || zone.status !== "ACTIVE") return;
      if (unavailableSeatIds.has(hitSeat.id) && !selectedSeatIds.has(hitSeat.id)) return;
      onToggleSeat(hitSeat.id);
    },
    [physical.seats, physical.sections, zoneOfSection, unavailableSeatIds, selectedSeatIds, activeFloorId, onToggleSeat],
  );

  const { ready, zoom, requestRedraw, zoomBy, fitToBounds, getViewportWorldBounds } = usePixiStage(
    containerRef,
    { panWithLeftClick: false, showGrid: false, showRuler: false, onPointerDown: handlePointerDown, onWheelZoomChange: () => requestRedraw() },
    draw,
  );

  useEffect(() => {
    requestRedraw();
  }, [physical, zones, selectedSeatIds, unavailableSeatIds, activeFloorId, requestRedraw]);

  // Encuadra automáticamente la primera vez que el canvas queda listo, y de
  // nuevo si el comprador cambia de piso — pero no en cada redraw (si no,
  // nunca podría alejar/acercar sin que se le resetee la vista).
  useEffect(() => {
    if (!ready) return;
    const key = `${activeFloorId}`;
    if (didFitRef.current === key) return;
    didFitRef.current = key;
    fitToBounds(computeVenueBounds(physical));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeFloorId]);

  useKeyboardShortcuts({
    onZoomIn: () => zoomBy(1.2),
    onZoomOut: () => zoomBy(0.8),
    onFitView: () => fitToBounds(computeVenueBounds(physical)),
  });

  return (
    <div className={["relative w-full h-full rounded-[10px] bg-surface-secondary overflow-hidden", className].filter(Boolean).join(" ")}>
      <div ref={containerRef} className="absolute inset-0" style={{ touchAction: "none" }} />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-muted text-xs">Cargando mapa…</div>
      )}

      {physical.floors.length > 1 && (
        <select
          value={activeFloorId}
          onChange={(e) => setActiveFloorIdState(e.target.value)}
          className="absolute top-2 left-2 rounded-[8px] bg-surface border border-border text-foreground text-xs px-2 py-1.5"
        >
          {physical.floors.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      )}

      <div className="absolute top-2 right-2 flex items-center gap-1 rounded-[8px] bg-surface border border-border p-1">
        <Button size="sm" variant="ghost" isIconOnly aria-label="Alejar" onPress={() => zoomBy(0.8)}>
          <Minus className="size-3.5" />
        </Button>
        <span className="text-[11px] text-muted w-9 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button size="sm" variant="ghost" isIconOnly aria-label="Acercar" onPress={() => zoomBy(1.2)}>
          <Plus className="size-3.5" />
        </Button>
        <Button size="sm" variant="ghost" isIconOnly aria-label="Ajustar vista" onPress={() => fitToBounds(computeVenueBounds(physical))}>
          <Maximize className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
