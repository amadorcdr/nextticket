/**
 * history.ts — Hook de historial para deshacer/rehacer.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { HISTORY_LIMIT } from "./constants";

export function useHistory<T>(initial: T) {
  const [state, setStateRaw] = useState<T>(initial);
  const stackRef = useRef<T[]>([initial]);
  const idxRef = useRef(0);

  const commit = useCallback((updater: T | ((prev: T) => T)) => {
    setStateRaw((prev) => {
      const next =
        typeof updater === "function"
          ? (updater as (p: T) => T)(prev)
          : updater;
      if (next === prev) return prev;
      stackRef.current = [
        ...stackRef.current.slice(0, idxRef.current + 1),
        next,
      ].slice(-HISTORY_LIMIT);
      idxRef.current = stackRef.current.length - 1;
      return next;
    });
  }, []);

  const mutateSilently = useCallback((updater: T | ((prev: T) => T)) => {
    setStateRaw((prev) =>
      typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater,
    );
  }, []);

  const settle = useCallback(() => {
    setStateRaw((cur) => {
      const last = stackRef.current[idxRef.current];
      if (last === cur) return cur;
      stackRef.current = [
        ...stackRef.current.slice(0, idxRef.current + 1),
        cur,
      ].slice(-HISTORY_LIMIT);
      idxRef.current = stackRef.current.length - 1;
      return cur;
    });
  }, []);

  const undo = useCallback(() => {
    if (idxRef.current > 0) {
      idxRef.current -= 1;
      setStateRaw(stackRef.current[idxRef.current]);
    }
  }, []);

  const redo = useCallback(() => {
    if (idxRef.current < stackRef.current.length - 1) {
      idxRef.current += 1;
      setStateRaw(stackRef.current[idxRef.current]);
    }
  }, []);

  const canUndo = idxRef.current > 0;
  const canRedo = idxRef.current < stackRef.current.length - 1;

  return {
    state,
    commit,
    mutateSilently,
    settle,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
