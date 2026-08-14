/**
 * controls.tsx — Controles de formulario mínimos (sin librerías externas).
 */

"use client";

import React, { useState, useEffect, startTransition } from "react";
import type { Id, PhysicalVenueState } from "./types";
import { Reorder } from "framer-motion";
import { Button, Description } from "@heroui/react";
import { Trash2, GripVertical, Check, Layers } from "lucide-react";
import { sectionColorFor, ELEMENT_TYPE_DEFAULT_COLOR } from "./constants";
import { ConfirmAlertDialog } from "./layout-components";
const fieldLabelClassName = "text-muted text-[10px] font-semibold uppercase tracking-wide";
const fieldInputClassName =
  "w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none focus:border-foreground transition-colors";

export const NumField: React.FC<{
  label: string;
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}> = ({ label, value, onCommit, step = 1, min, max, suffix }) => {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);
  const commit = () => {
    const n = Number(local);
    if (!Number.isNaN(n)) onCommit(n);
  };
  return (
    <div className="flex flex-col gap-1">
      <label className={fieldLabelClassName}>{label}</label>
      <div className="relative">
        <input
          type="number"
          value={local}
          step={step}
          min={min}
          max={max}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={`${fieldInputClassName} ${suffix ? "pr-8" : ""}`}
        />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted text-[11px]">{suffix}</span>}
      </div>
    </div>
  );
};

export const TextField: React.FC<{
  label: string;
  value: string;
  onCommit: (v: string) => void;
  maxLength?: number;
}> = ({ label, value, onCommit, maxLength }) => {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div className="flex flex-col gap-1">
      {label && <label className={fieldLabelClassName}>{label}</label>}
      <input
        type="text"
        value={local}
        maxLength={maxLength}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onCommit(local)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={fieldInputClassName}
      />
    </div>
  );
};

import {
  ColorPicker,
  ColorSwatch,
  ColorSwatchPicker,
  ColorArea,
  ColorSlider,
  ColorField as HeroUIColorField,
  Label
} from "@heroui/react";
import { PaintBucket, Palette, Shuffle } from "lucide-react";

const COLORS: string[] = [
  "#0485F7",
  "#ec4899",
  "#f59e0b",
  "#22c55e",
  "#06b6d4",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];

export const ColorField: React.FC<{
  value: string;
  onCommit: (v: string) => void;
  fullWidth?: boolean;
  className?: string;
}> = ({ value, onCommit, fullWidth, className }) => {
  const shuffleColor = () => {
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    onCommit(randomColor);
  };

  return (
    <ColorPicker
      value={value || "#3a3a3a"}
      onChange={(c) => onCommit(c.toString("hex"))}
      className={`w-full ${className || ""}`}
    >
      <ColorPicker.Trigger>

        <Button
          isIconOnly
          variant="ghost"
          className="shrink-0"
          size="sm"
        >
          <PaintBucket />
        </Button>
      </ColorPicker.Trigger>
      <ColorPicker.Popover className="gap-3 min-w-50" placement="left top" >
        <ColorSwatchPicker
          className="justify-center pt-2"
          size="xs"
        >
          {COLORS.map((preset) => (
            <ColorSwatchPicker.Item
              key={preset}
              color={preset}
            >
              <ColorSwatchPicker.Swatch />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
        <ColorArea
          aria-label="Color area"
          className="max-w-full"
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
        >
          <ColorArea.Thumb />
        </ColorArea>
        <ColorSlider

          aria-label="Hue slider"
          channel="hue"
          className="flex-1"
          colorSpace="hsb"
        >
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
        <div className="flex items-center gap-2">

          <HeroUIColorField aria-label="Color field">
            <HeroUIColorField.Group variant="secondary">
              <HeroUIColorField.Prefix>
                <ColorSwatch size="xs" />
              </HeroUIColorField.Prefix>
              <HeroUIColorField.Input />
            </HeroUIColorField.Group>
          </HeroUIColorField>
          <Button
            isIconOnly
            aria-label="Shuffle color"
            size="sm"
            variant="ghost"
            onPress={shuffleColor}
          >
            <Shuffle />
          </Button>
        </div>
      </ColorPicker.Popover>
    </ColorPicker>
  );
};

export function SelectField<T extends string>({
  label,
  value,
  options,
  onCommit,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onCommit: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={fieldLabelClassName}>{label}</label>
      <select value={value} onChange={(e) => onCommit(e.target.value as T)} className={`${fieldInputClassName} cursor-pointer`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export const CheckField: React.FC<{
  label: string;
  checked: boolean;
  onCommit: (v: boolean) => void;
}> = ({ label, checked, onCommit }) => (
  <div className="flex items-center gap-2">
    <label className="flex items-center gap-2 text-foreground text-xs cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCommit(e.target.checked)}
        className="size-3.5 cursor-pointer accent-foreground"
      />
      {label}
    </label>
  </div>
);

export const DateTimeField: React.FC<{
  label: string;
  value: string | null;
  onCommit: (v: string | null) => void;
}> = ({ label, value, onCommit }) => {
  const [local, setLocal] = useState(value ? value.slice(0, 16) : "");
  useEffect(() => setLocal(value ? value.slice(0, 16) : ""), [value]);
  return (
    <div className="flex flex-col gap-1">
      <label className={fieldLabelClassName}>{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="datetime-local"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onCommit(local ? new Date(local).toISOString() : null)}
          className={fieldInputClassName}
        />
        {value && (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => {
              setLocal("");
              onCommit(null);
            }}
          >
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
};

const StaticMiniMapComponent = ({ venue, floorId, isSelected }: { venue: PhysicalVenueState, floorId: Id, isSelected?: boolean }) => {
  const sections = venue.sections.filter(s => s.floorId === floorId);
  const elements = venue.canvasElements.filter(e => e.floorId === floorId);

  const allItems = [...sections, ...elements];
  if (allItems.length === 0) {
    return (
      <div className={`w-full h-full overflow-hidden flex items-center justify-center text-sm relative shrink-0 rounded-[6px] text-muted transition-colors bg-transparent`}>
        <div className="flex items-center justify-center size-11 bg-default-soft rounded-[10px] shadow-surface mb-2">
          <Layers />
        </div>
      </div>
    );
  }

  const minX = Math.min(...allItems.map((e) => (e.coordinateX ?? 0) - (e.width ?? 100) / 2));
  const minY = Math.min(...allItems.map((e) => (e.coordinateY ?? 0) - (e.height ?? 100) / 2));
  const maxX = Math.max(...allItems.map((e) => (e.coordinateX ?? 0) + (e.width ?? 100) * 1.5));
  const maxY = Math.max(...allItems.map((e) => (e.coordinateY ?? 0) + (e.height ?? 100) * 1.5));

  const pad = 100;
  const vMinX = minX - pad;
  const vMinY = minY - pad;
  const vW = Math.max(10, (maxX - minX) + pad * 2);
  const vH = Math.max(10, (maxY - minY) + pad * 2);

  const renderItem = (item: any, color: string, opacity: number) => {
    if (item.points && item.points.length >= 3) {
      const rad = ((item.rotationDegrees || 0) * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const cx = item.coordinateX ?? 0, cy = item.coordinateY ?? 0;
      const pts = item.points.map((p: any) => ({
        x: cx + p.x * cos - p.y * sin,
        y: cy + p.x * sin + p.y * cos,
      }));
      let d = `M${pts[0].x},${pts[0].y}`;
      for (let i = 0; i < pts.length; i++) {
        const ni = (i + 1) % pts.length;
        const p0 = item.points[i];
        if (p0.controlX !== null && p0.controlY !== null) {
          const cpx = cx + p0.controlX * cos - p0.controlY * sin;
          const cpy = cy + p0.controlX * sin + p0.controlY * cos;
          d += ` Q${cpx},${cpy} ${pts[ni].x},${pts[ni].y}`;
        } else {
          d += ` L${pts[ni].x},${pts[ni].y}`;
        }
      }
      d += "Z";
      return <path key={item.id} d={d} fill={color} opacity={opacity} />;
    }
    const w = item.width ?? 100;
    const h = item.height ?? 100;
    return <rect key={item.id} x={(item.coordinateX ?? 0)} y={(item.coordinateY ?? 0)} width={w} height={h} fill={color} opacity={opacity} transform={`rotate(${item.rotationDegrees || 0} ${(item.coordinateX ?? 0) + w / 2} ${(item.coordinateY ?? 0) + h / 2})`} rx={item.isEllipse ? Math.min(w, h) / 2 : 0} />;
  }

  return (
    <div className={`w-full h-full overflow-hidden relative shrink-0 rounded-[6px]`}>
      <svg
        viewBox={`${vMinX} ${vMinY} ${vW} ${vH}`}
        className="w-full h-full bg-transparent"
        preserveAspectRatio="xMidYMid meet"
      >
        {elements.map((s: any) => renderItem(s, s.color || "#555", 0.6))}
        {sections.map((z: any) => renderItem(z, z.color || "#14c9e1", 0.8))}
      </svg>
    </div>
  );
}

export const StaticMiniMap = React.memo(StaticMiniMapComponent, (prev, next) => {
  return prev.floorId === next.floorId &&
    prev.isSelected === next.isSelected &&
    prev.venue.sections === next.venue.sections &&
    prev.venue.canvasElements === next.venue.canvasElements;
});

export function FloorsToolbarReorderList({
  venue,
  activeFloorId,
  handleFloorChange,
  removeFloor,
  setVenue
}: {
  venue: PhysicalVenueState,
  activeFloorId: Id,
  handleFloorChange: (id: Id) => void,
  removeFloor: (id: Id) => void,
  setVenue: React.Dispatch<React.SetStateAction<PhysicalVenueState>>
}) {
  const [localFloors, setLocalFloors] = useState(venue.floors);
  const [floorToDelete, setFloorToDelete] = useState<Id | null>(null);

  useEffect(() => {
    setLocalFloors(venue.floors);
  }, [venue.floors]);

  return (
    <>
      <Reorder.Group
        axis="y"
        values={localFloors.map(f => f.id)}
        onReorder={(newIds) => {
          const next = newIds.map(id => localFloors.find(f => f.id === id)!);
          setLocalFloors(next);
        }}
        className="flex flex-col gap-2"
      >
        {localFloors.map((floor) => (
          <Reorder.Item
            key={floor.id}
            value={floor.id}
            onDragEnd={() => {
              startTransition(() => {
                setVenue((prev) => ({
                  ...prev,
                  floors: localFloors.map((f, i) => ({ ...f, levelIndex: i })),
                }));
              });
            }}
            className={`relative p-1 rounded-[10px] z-10 shrink-0 h-24 aspect-video flex flex-col gap-1 cursor-pointer transition-shadow duration-300 overflow-hidden bg-surface ${activeFloorId === floor.id ? 'shadow-overlay' : 'shadow-surface'}`}
            onClick={() => handleFloorChange(floor.id)}
            title={floor.name}
          >
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="absolute bottom-2 size-4 right-2 text-danger shrink-0"
              isDisabled={venue.floors.length <= 1}
              onPress={() => setFloorToDelete(floor.id)}
            >
              <Trash2 />
            </Button>
            <div className="absolute top-2 right-2 cursor-grab active:cursor-grabbing">
              <GripVertical />
            </div>
            {activeFloorId === floor.id && (
              <div className="absolute top-2 left-2 z-20">
                <Check />
              </div>
            )}
            <div className="flex-1 min-h-0 relative pointer-events-none">
              <StaticMiniMap venue={venue} floorId={floor.id} isSelected={activeFloorId === floor.id} />
            </div>
            <Description className={`text-center pointer-events-none truncate px-3 ${activeFloorId === floor.id ? "text-foreground font-medium" : "text-muted"}`}>{floor.name}</Description>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <ConfirmAlertDialog
        isOpen={floorToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setFloorToDelete(null);
        }}
        title="Eliminar Piso"
        description="¿Estás seguro de que deseas eliminar este piso? Se perderán todas sus secciones y elementos permanentemente."
        confirmText="Eliminar"
        status="danger"
        onConfirm={() => {
          if (floorToDelete) {
            removeFloor(floorToDelete);
            setFloorToDelete(null);
          }
        }}
      />
    </>
  );
};