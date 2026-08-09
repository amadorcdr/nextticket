/**
 * keyboard.ts — Hook de atajos de teclado compartidos por los 3 editores.
 */

"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

export interface KeyboardShortcutHandlers {
  enabled?: boolean;
  onDelete?: () => void;
  onSelectAll?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
  onEscape?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onNudge?: (dx: number, dy: number, coarse: boolean) => void;
  onToolSelect?: () => void;
  onToolPan?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      if (h.enabled === false) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const meta = e.ctrlKey || e.metaKey;
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
        const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
        h.onNudge?.(dx, dy, e.shiftKey);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") { h.onDelete?.(); return; }
      if (meta && e.key.toLowerCase() === "a") { e.preventDefault(); h.onSelectAll?.(); return; }
      if (meta && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); h.onUndo?.(); return; }
      if ((meta && e.key.toLowerCase() === "y") || (meta && e.shiftKey && e.key.toLowerCase() === "z")) { e.preventDefault(); h.onRedo?.(); return; }
      if (meta && e.key.toLowerCase() === "c") { h.onCopy?.(); return; }
      if (meta && e.key.toLowerCase() === "v") { h.onPaste?.(); return; }
      if (meta && e.key.toLowerCase() === "d") { e.preventDefault(); h.onDuplicate?.(); return; }
      if (meta && e.key === "0") { e.preventDefault(); h.onFitView?.(); return; }
      if (e.key === "Escape") { h.onEscape?.(); return; }
      if (e.key === "+" || e.key === "=") { h.onZoomIn?.(); return; }
      if (e.key === "-") { h.onZoomOut?.(); return; }
      if (e.key.toLowerCase() === "s" && !meta) { h.onToolSelect?.(); return; }
      if (e.key.toLowerCase() === "h" && !meta) { h.onToolPan?.(); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
