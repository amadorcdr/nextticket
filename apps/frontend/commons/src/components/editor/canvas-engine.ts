/**
 * canvas-engine.ts — Motor PixiJS compartido: cámara, grid, regla, ciclo de dibujo.
 */

"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import type { Pt } from "./types";
import { clamp } from "./geometry";
import { MIN_ZOOM, MAX_ZOOM, STROKE_COLOR, RULER_SIZE } from "./constants";

export interface PixiLayers {
  app: Application;
  world: Container;
  gridGfx: Graphics;
  mainGfx: Graphics;
  selectionGfx: Graphics;
  handlesGfx: Graphics;
  labelsLayer: Container;
  rulerGfx: Graphics;
  rulerTexts: Text[];
  isMovingCamera: boolean;
}

export interface StagePointerInfo {
  world: Pt;
  clientX: number;
  clientY: number;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export interface UsePixiStageOptions {
  panWithLeftClick: boolean;
  showGrid: boolean;
  showRuler: boolean;
  onPointerDown?: (info: StagePointerInfo) => void;
  onPointerMove?: (info: StagePointerInfo) => void;
  onPointerUp?: (info: StagePointerInfo) => void;
  onWheelZoomChange?: (zoom: number) => void;
}

export const getRulerStep = (zoom: number): number => {
  if (zoom >= 8) return 5;
  if (zoom >= 4) return 10;
  if (zoom >= 2) return 20;
  if (zoom >= 1) return 50;
  if (zoom >= 0.5) return 100;
  if (zoom >= 0.2) return 200;
  if (zoom >= 0.1) return 500;
  return 1000;
};

export function usePixiStage(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UsePixiStageOptions,
  drawFn: (layers: PixiLayers) => void,
) {
  const layersRef = useRef<PixiLayers | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);

  const dirtyRef = useRef(true);
  const isMovingCameraRef = useRef(false);
  const drawFnRef = useRef(drawFn);
  const optionsRef = useRef(options);

  useLayoutEffect(() => {
    drawFnRef.current = drawFn;
    optionsRef.current = options;
  });

  const requestRedraw = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || layersRef.current) return;
    let cancelled = false;
    const app = new Application();

    app
      .init({
        resizeTo: el,
        antialias: true,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      .then(() => {
        if (cancelled) {
          try { app.destroy(true); } catch { /* noop */ }
          return;
        }
        el.appendChild(app.canvas);

        const world = new Container();
        app.stage.addChild(world);
        world.x = el.clientWidth / 2;
        world.y = el.clientHeight / 2;

        const gridGfx = new Graphics();
        world.addChild(gridGfx);
        const mainGfx = new Graphics();
        world.addChild(mainGfx);
        const labelsLayer = new Container();
        world.addChild(labelsLayer);
        const selectionGfx = new Graphics();
        world.addChild(selectionGfx);
        const handlesGfx = new Graphics();
        world.addChild(handlesGfx);

        const rulerContainer = new Container();
        app.stage.addChild(rulerContainer);
        const rulerGfx = new Graphics();
        rulerContainer.addChild(rulerGfx);
        const rulerTexts = Array.from({ length: 140 }, () => {
          const t = new Text({
            text: "",
            style: {
              fontFamily: "Figtree, sans-serif",

              fontSize: 10,
              fill: STROKE_COLOR,
            },
          });
          t.resolution = 2;
          t.visible = false;
          rulerContainer.addChild(t);
          return t;
        });

        layersRef.current = {
          app, world, gridGfx, mainGfx, selectionGfx, handlesGfx,
          labelsLayer, rulerGfx, rulerTexts, isMovingCamera: false,
        };

        app.canvas.style.touchAction = "none";
        app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

        const toWorld = (clientX: number, clientY: number): Pt => {
          const rect = app.canvas.getBoundingClientRect();
          return {
            x: (clientX - rect.left - world.x) / world.scale.x,
            y: (clientY - rect.top - world.y) / world.scale.y,
          };
        };

        const applyZoom = (factor: number, cx: number, cy: number) => {
          const nx = clamp(world.scale.x * factor, MIN_ZOOM, MAX_ZOOM);
          world.x = cx - (cx - world.x) * (nx / world.scale.x);
          world.y = cy - (cy - world.y) * (nx / world.scale.y);
          world.scale.set(nx);
          setZoom(Math.round(nx * 1000) / 1000);
          optionsRef.current.onWheelZoomChange?.(nx);
          dirtyRef.current = true;
        };

        let cameraMoveTimer: ReturnType<typeof setTimeout> | null = null;
        const markCameraMoving = () => {
          if (!isMovingCameraRef.current) {
            isMovingCameraRef.current = true;
            dirtyRef.current = true;
          }
          if (cameraMoveTimer) clearTimeout(cameraMoveTimer);
          cameraMoveTimer = setTimeout(() => {
            isMovingCameraRef.current = false;
            dirtyRef.current = true;
          }, 150);
        };

        app.canvas.addEventListener(
          "wheel",
          (e: WheelEvent) => {
            e.preventDefault();
            markCameraMoving();
            const rect = app.canvas.getBoundingClientRect();
            if (e.ctrlKey || e.metaKey) {
              applyZoom(
                e.deltaY < 0 ? 1.1 : 0.9,
                e.clientX - rect.left,
                e.clientY - rect.top,
              );
            } else if (e.shiftKey) {
              world.x -= e.deltaY;
              dirtyRef.current = true;
            } else {
              world.x -= e.deltaX;
              world.y -= e.deltaY;
              dirtyRef.current = true;
            }
          },
          { passive: false },
        );

        let panning = false, panX = 0, panY = 0;
        const startPan = (x: number, y: number) => {
          panning = true; panX = x; panY = y;
          app.canvas.style.cursor = "grabbing";
        };
        const movePan = (x: number, y: number) => {
          markCameraMoving();
          world.x += x - panX; world.y += y - panY;
          panX = x; panY = y;
          dirtyRef.current = true;
        };
        const endPan = () => { panning = false; app.canvas.style.cursor = ""; };

        app.canvas.addEventListener("pointerdown", (e: PointerEvent) => {
          const isPanTrigger =
            e.button === 2 || e.button === 1 ||
            (e.button === 0 && e.altKey) ||
            (e.button === 0 && optionsRef.current.panWithLeftClick);
          if (isPanTrigger) { startPan(e.clientX, e.clientY); return; }
          if (e.button !== 0) return;
          const w = toWorld(e.clientX, e.clientY);
          optionsRef.current.onPointerDown?.({
            world: w, clientX: e.clientX, clientY: e.clientY,
            button: e.button, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey,
            altKey: e.altKey, metaKey: e.metaKey,
          });
        });
        app.canvas.addEventListener("pointermove", (e: PointerEvent) => {
          if (panning) { movePan(e.clientX, e.clientY); return; }
          const w = toWorld(e.clientX, e.clientY);
          optionsRef.current.onPointerMove?.({
            world: w, clientX: e.clientX, clientY: e.clientY,
            button: e.button, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey,
            altKey: e.altKey, metaKey: e.metaKey,
          });
        });
        const finishPointer = (e: PointerEvent) => {
          if (panning) { endPan(); return; }
          const w = toWorld(e.clientX, e.clientY);
          optionsRef.current.onPointerUp?.({
            world: w, clientX: e.clientX, clientY: e.clientY,
            button: e.button, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey,
            altKey: e.altKey, metaKey: e.metaKey,
          });
        };
        app.canvas.addEventListener("pointerup", finishPointer);
        app.canvas.addEventListener("pointerleave", () => { if (panning) endPan(); });

        // Touch
        let pinchDist: number | null = null;
        let pinchCenter: Pt | null = null;
        let touchPanning = false, tpX = 0, tpY = 0;
        const touchDist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const touchCenter = (a: Touch, b: Touch) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });

        app.canvas.addEventListener("touchstart", (e: TouchEvent) => {
          if (e.touches.length === 1 && optionsRef.current.panWithLeftClick) {
            touchPanning = true; tpX = e.touches[0].clientX; tpY = e.touches[0].clientY;
          } else if (e.touches.length === 2) {
            touchPanning = false;
            pinchDist = touchDist(e.touches[0], e.touches[1]);
            pinchCenter = touchCenter(e.touches[0], e.touches[1]);
          }
        }, { passive: false });

        app.canvas.addEventListener("touchmove", (e: TouchEvent) => {
          e.preventDefault();
          markCameraMoving();
          if (e.touches.length === 1 && touchPanning) {
            const dx = e.touches[0].clientX - tpX, dy = e.touches[0].clientY - tpY;
            world.x += dx; world.y += dy;
            tpX = e.touches[0].clientX; tpY = e.touches[0].clientY;
            dirtyRef.current = true;
          } else if (e.touches.length === 2) {
            const nd = touchDist(e.touches[0], e.touches[1]);
            const nc = touchCenter(e.touches[0], e.touches[1]);
            const rect = app.canvas.getBoundingClientRect();
            if (pinchCenter) { world.x += nc.x - pinchCenter.x; world.y += nc.y - pinchCenter.y; }
            if (pinchDist && pinchDist > 0) applyZoom(nd / pinchDist, nc.x - rect.left, nc.y - rect.top);
            pinchDist = nd; pinchCenter = nc;
            dirtyRef.current = true;
          }
        }, { passive: false });

        const endTouch = (e: TouchEvent) => {
          if (e.touches.length < 2) { pinchDist = null; pinchCenter = null; }
          if (e.touches.length === 0) { touchPanning = false; dirtyRef.current = true; }
          else if (e.touches.length === 1 && optionsRef.current.panWithLeftClick) {
            touchPanning = true; tpX = e.touches[0].clientX; tpY = e.touches[0].clientY;
          }
        };
        app.canvas.addEventListener("touchend", endTouch);
        app.canvas.addEventListener("touchcancel", endTouch);

        const resizeObserver = new ResizeObserver(() => {
          app.renderer.resize(el.clientWidth, el.clientHeight);
          dirtyRef.current = true;
        });
        resizeObserver.observe(el);

        let lastDrawTime = 0;
        app.ticker.add(() => {
          if (dirtyRef.current && layersRef.current) {
            const now = performance.now();
            dirtyRef.current = false;
            lastDrawTime = now;
            drawFnRef.current({ ...layersRef.current, isMovingCamera: isMovingCameraRef.current });
          }
        });

        (app as unknown as { __resizeObserver?: ResizeObserver }).__resizeObserver = resizeObserver;
        setReady(true);
        dirtyRef.current = true;
      });

    return () => {
      cancelled = true;
      const layers = layersRef.current;
      if (layers) {
        const ro = (layers.app as unknown as { __resizeObserver?: ResizeObserver }).__resizeObserver;
        ro?.disconnect();
        try { layers.app.ticker.stop(); } catch { /* noop */ }
        try { (layers.app as unknown as { resizeTo?: unknown }).resizeTo = undefined; } catch { /* noop */ }
        try { layers.app.destroy(true, { children: true }); } catch { /* noop */ }
      }
      layersRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  const zoomBy = useCallback((factor: number) => {
    const layers = layersRef.current;
    if (!layers) return;
    const { app, world } = layers;
    const cx = app.canvas.clientWidth / 2, cy = app.canvas.clientHeight / 2;
    const nx = clamp(world.scale.x * factor, MIN_ZOOM, MAX_ZOOM);
    world.x = cx - (cx - world.x) * (nx / world.scale.x);
    world.y = cy - (cy - world.y) * (nx / world.scale.y);
    world.scale.set(nx);
    setZoom(Math.round(nx * 1000) / 1000);
    dirtyRef.current = true;
  }, []);

  const fitToBounds = useCallback(
    (bounds: { minX: number; maxX: number; minY: number; maxY: number } | null) => {
      const layers = layersRef.current;
      if (!layers || !bounds) return;
      const { app, world } = layers;
      const w = Math.max(1, bounds.maxX - bounds.minX);
      const h = Math.max(1, bounds.maxY - bounds.minY);
      const pad = 80;
      const scaleX = (app.canvas.clientWidth - pad * 2) / w;
      const scaleY = (app.canvas.clientHeight - pad * 2) / h;
      const s = clamp(Math.min(scaleX, scaleY), MIN_ZOOM, MAX_ZOOM);
      world.scale.set(s);
      world.x = app.canvas.clientWidth / 2 - ((bounds.minX + bounds.maxX) / 2) * s;
      world.y = app.canvas.clientHeight / 2 - ((bounds.minY + bounds.maxY) / 2) * s;
      setZoom(Math.round(s * 1000) / 1000);
      dirtyRef.current = true;
    },
    [],
  );

  const centerOn = useCallback((x: number, y: number) => {
    const layers = layersRef.current;
    if (!layers) return;
    const { app, world } = layers;
    world.x = app.canvas.clientWidth / 2 - x * world.scale.x;
    world.y = app.canvas.clientHeight / 2 - y * world.scale.y;
    dirtyRef.current = true;
  }, []);

  const getViewCenter = useCallback((): Pt => {
    const layers = layersRef.current;
    if (!layers) return { x: 0, y: 0 };
    const { app, world } = layers;
    return {
      x: (app.canvas.clientWidth / 2 - world.x) / world.scale.x,
      y: (app.canvas.clientHeight / 2 - world.y) / world.scale.y,
    };
  }, []);

  const getViewportWorldBounds = useCallback(() => {
    const layers = layersRef.current;
    if (!layers) return null;
    const { app, world } = layers;
    const margin = 60;
    return {
      minX: -world.x / world.scale.x - margin,
      minY: -world.y / world.scale.y - margin,
      maxX: (app.canvas.clientWidth - world.x) / world.scale.x + margin,
      maxY: (app.canvas.clientHeight - world.y) / world.scale.y + margin,
    };
  }, []);

  return {
    layersRef, ready, zoom, requestRedraw, zoomBy,
    fitToBounds, centerOn, getViewCenter, getViewportWorldBounds,
  };
}
