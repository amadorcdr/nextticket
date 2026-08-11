"use client";

/**
 * preview-editor.tsx — Vista Previa (usuarios CLIENTES)
 *
 * Solo lectura: carga el mapa físico coloreado por zona comercial y permite:
 * - Seleccionar/deseleccionar asientos disponibles (zonas RESERVED)
 * - Ajustar cantidad (zonas GENERAL)
 * - Respetar máximo de boletos por compra de cada zona
 * - Ver asientos deshabilitados por el organizador
 * - Zoom, pan y atajos de teclado
 * - Etiquetas de asientos visibles
 * - Leyenda de zonas con colores y precios
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "pixi.js";
import type { Id, Seat, EventSeat, EventSeatStatus, PhysicalVenueState, CommercialEventState, EventZone } from "./types";
import { uid } from "./types";
import { SEAT_RADIUS } from "./constants";
import { usePixiStage, type PixiLayers, type StagePointerInfo } from "./canvas-engine";
import { drawGrid, drawRuler, renderSections, renderCanvasElements, renderSeats, hexToInt } from "./rendering";
import { computeVenueBounds } from "./selection";
import { useKeyboardShortcuts } from "./keyboard";

export interface PreviewEditorProps {
  physical: PhysicalVenueState;
  commercial: CommercialEventState;
  eventSeats?: EventSeat[];
  onEventSeatsChange?: (seats: EventSeat[]) => void;
}

export default function PreviewEditor({ physical, commercial, eventSeats = [], onEventSeatsChange }: PreviewEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<Id>>(new Set());
  const [activeFloorIdState, setActiveFloorIdState] = useState<Id>("");
  const activeFloorId = physical.floors.some((f) => f.id === activeFloorIdState) ? activeFloorIdState : (physical.floors[0]?.id ?? "");
  const [generalQty, setGeneralQty] = useState<Record<Id, number>>({});
  const sectionLabelPoolRef = useRef<Text[]>([]);
  const elementLabelPoolRef = useRef<Text[]>([]);
  const seatLabelPoolRef = useRef<Text[]>([]);

  const zoneOfSection = useCallback((sectionId: Id) => commercial.zones.find((z) => z.sectionIds.includes(sectionId)), [commercial.zones]);

  const eventSeatStatus = useCallback((seatId: Id): EventSeatStatus => {
    // Primero verificar event_seats del comercial (asientos deshabilitados por organizador)
    const commercialEs = commercial.eventSeats.find(es => es.seatId === seatId);
    if (commercialEs?.status === "DISABLED") return "DISABLED";
    // Luego verificar event_seats del cliente (reservas)
    return eventSeats.find((es) => es.seatId === seatId)?.status ?? "AVAILABLE";
  }, [eventSeats, commercial.eventSeats]);

  const draw = useCallback((layers: PixiLayers) => {
    const { world, mainGfx, handlesGfx, labelsLayer, app } = layers;
    mainGfx.clear(); handlesGfx.clear();
    const vp = getViewportWorldBounds();
    const visibleSections = physical.sections.filter((s) => s.floorId === activeFloorId);
    const visibleSectionIds = new Set(visibleSections.map(s => s.id));
    const visibleElements = physical.canvasElements.filter((e) => e.floorId === activeFloorId);
    const visibleSeats = physical.seats.filter((s) => visibleSectionIds.has(s.sectionId));
    renderSections({ gfx: mainGfx, labelsLayer, labelPool: sectionLabelPoolRef.current, sections: visibleSections, selectedIds: new Set(), vp, colorOf: (z) => zoneOfSection(z.id)?.mapColor || "#94a3b8", showLabels: true, zoom: world.scale.x });
    renderCanvasElements({ gfx: mainGfx, labelsLayer, labelPool: elementLabelPoolRef.current, elements: visibleElements, selectedIds: new Set(), vp, zoom: world.scale.x });
    renderSeats({
      gfx: mainGfx, labelsLayer, labelPool: seatLabelPoolRef.current, seats: visibleSeats,
      selectedIds: selectedSeatIds, vp, colorOf: (seat) => hexToInt(zoneOfSection(seat.sectionId)?.mapColor, 0x94a3b8),
      statusOf: (seat) => eventSeatStatus(seat.id),
      showLabels: true,
      labelOf: (seat) => `${seat.row}${seat.number}`,
      zoom: world.scale.x,
    });
  }, [physical, zoneOfSection, eventSeatStatus, selectedSeatIds, activeFloorId]);

  const handlePointerDown = useCallback((info: StagePointerInfo) => {
    const hitSeat = physical.seats.find((s) => {
      const section = physical.sections.find(sec => sec.id === s.sectionId);
      if (section?.floorId !== activeFloorId) return false;
      return Math.hypot((s.coordinateX ?? 0) - info.world.x, (s.coordinateY ?? 0) - info.world.y) < SEAT_RADIUS + 4;
    });
    if (!hitSeat) return;
    const zone = zoneOfSection(hitSeat.sectionId);
    if (!zone || zone.admissionType !== "RESERVED" || zone.status !== "ACTIVE") return;
    const st = eventSeatStatus(hitSeat.id);
    if (st === "DISABLED" || st === "SOLD") return;
    if (st !== "AVAILABLE" && !selectedSeatIds.has(hitSeat.id)) return;
    setSelectedSeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(hitSeat.id)) { next.delete(hitSeat.id); return next; }
      const inZone = [...next].filter((id) => { const s = physical.seats.find((sc) => sc.id === id); return s && zoneOfSection(s.sectionId)?.id === zone.id; }).length;
      if (inZone >= zone.maxTicketsPerPurchase) { window.alert(`Máximo ${zone.maxTicketsPerPurchase} boletos por compra en "${zone.publicName}".`); return prev; }
      next.add(hitSeat.id);
      return next;
    });
  }, [physical.seats, physical.sections, zoneOfSection, eventSeatStatus, selectedSeatIds, activeFloorId]);

  const { ready, zoom, requestRedraw, zoomBy, fitToBounds, getViewportWorldBounds } = usePixiStage(containerRef, {
    panWithLeftClick: false, showGrid: false, showRuler: false, onPointerDown: handlePointerDown, onWheelZoomChange: () => requestRedraw(),
  }, draw);
  useEffect(() => { requestRedraw(); }, [physical, commercial, selectedSeatIds, eventSeats, activeFloorId, requestRedraw]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onZoomIn: () => zoomBy(1.2), onZoomOut: () => zoomBy(0.8),
    onFitView: () => fitToBounds(computeVenueBounds(physical)),
    onEscape: () => setSelectedSeatIds(new Set()),
  });

  const priceForZone = useCallback((zone: EventZone) => {
    const activeTier = commercial.priceTiers.find((t) => t.eventZoneId === zone.id && t.status === "ACTIVE");
    return activeTier ? activeTier.price : zone.eventPrice;
  }, [commercial.priceTiers]);

  const selectedSeats = physical.seats.filter((s) => selectedSeatIds.has(s.id));
  const seatsByZone = new Map<Id, Seat[]>();
  for (const s of selectedSeats) {
    const zone = zoneOfSection(s.sectionId);
    if (!zone) continue;
    if (!seatsByZone.has(zone.id)) seatsByZone.set(zone.id, []);
    seatsByZone.get(zone.id)!.push(s);
  }

  // Cálculo de total
  let total = 0;
  for (const [zoneId, seats] of seatsByZone) {
    const zone = commercial.zones.find((z) => z.id === zoneId);
    if (zone) total += priceForZone(zone) * seats.length;
  }
  for (const zone of commercial.zones.filter((z) => z.admissionType === "GENERAL"))
    total += priceForZone(zone) * (generalQty[zone.id] || 0);

  const confirmSelection = () => {
    if (!onEventSeatsChange) return;
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const updated: EventSeat[] = [...eventSeats];
    for (const seat of selectedSeats) {
      const zone = zoneOfSection(seat.sectionId);
      if (!zone) continue;
      const idx = updated.findIndex((es) => es.seatId === seat.id);
      const record: EventSeat = { id: idx >= 0 ? updated[idx].id : uid("eventseat"), eventZoneId: zone.id, seatId: seat.id, sectionId: seat.sectionId, lockedUntil: expiry, status: "RESERVED" };
      if (idx >= 0) updated[idx] = record; else updated.push(record);
    }
    onEventSeatsChange(updated);
    window.alert(`Se reservaron ${selectedSeats.length} asiento(s) por 10 minutos.`);
  };

  return (
    <div style={{ display: "flex", height: "100%", width: "100%" }}>
      <div style={{ flex: 1, position: "relative" }}>
        <div ref={containerRef} style={{ position: "absolute", inset: 0, touchAction: "none" }} />
        {!ready && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>Cargando mapa…</div>}
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
          <button onClick={() => zoomBy(1.2)}>+</button>
          <button onClick={() => zoomBy(0.8)}>-</button>
          <button onClick={() => fitToBounds(computeVenueBounds(physical))}>Ajustar</button>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
      </div>
      <div style={{ width: 300, padding: 8, overflowY: "auto", borderLeft: "1px solid #333" }}>
        <div style={{ margin: "0 0 1rem 0" }}>
          <h3 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Filtro de Piso</h3>
          <select value={activeFloorId} onChange={(e) => setActiveFloorIdState(e.target.value)} style={{ width: "100%", padding: "4px" }}>
            {physical.floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {/* Leyenda de zonas */}
        <h4>Zonas disponibles</h4>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {commercial.zones.filter(z => z.status === "ACTIVE").map((zone) => (
            <li key={zone.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: zone.mapColor || "#94a3b8", display: "inline-block" }} />
              <span>{zone.publicName}</span>
              <span style={{ marginLeft: "auto" }}>${priceForZone(zone).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <hr />

        <h4>Tu selección</h4>
        {/* Zonas generales */}
        {commercial.zones.filter((z) => z.admissionType === "GENERAL" && z.status === "ACTIVE").map((zone) => (
          <div key={zone.id} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
            <span>{zone.publicName} (${priceForZone(zone).toFixed(2)})</span>
            <button onClick={() => setGeneralQty((q) => ({ ...q, [zone.id]: Math.max(0, (q[zone.id] || 0) - 1) }))}>-</button>
            <span>{generalQty[zone.id] || 0}</span>
            <button onClick={() => setGeneralQty((q) => ({ ...q, [zone.id]: Math.min(zone.maxTicketsPerPurchase, (q[zone.id] || 0) + 1) }))}>+</button>
          </div>
        ))}

        {/* Asientos reservados seleccionados */}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {[...seatsByZone.entries()].map(([zoneId, seats]) => {
            const zone = commercial.zones.find((z) => z.id === zoneId);
            if (!zone) return null;
            return (
              <li key={zoneId} style={{ marginBottom: 6 }}>
                <strong>{zone.publicName}</strong> — {seats.length} × ${priceForZone(zone).toFixed(2)} = ${(priceForZone(zone) * seats.length).toFixed(2)}
                <ul style={{ listStyle: "none", padding: 0, margin: "2px 0 0 12px" }}>
                  {seats.map((s) => (
                    <li key={s.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {physical.sections.find((sec) => sec.id === s.sectionId)?.prefix || "SEC"}-{s.row}{s.number}
                      <button onClick={() => setSelectedSeatIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; })} style={{ fontSize: "0.8rem" }}>Quitar</button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>

        <hr />
        <p><strong>Total estimado: ${total.toFixed(2)}</strong></p>
        <button onClick={confirmSelection} disabled={selectedSeats.length === 0 && Object.values(generalQty).every((q) => !q)}>Confirmar selección</button>
      </div>
    </div>
  );
}
