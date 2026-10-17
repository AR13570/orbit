import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent,
} from "react";
import {
  clampGameplayZoom,
  MIN_GAMEPLAY_ZOOM,
  MAX_GAMEPLAY_ZOOM,
  PinchZoom,
  type ZoomFocus,
} from "./zoom";
export function useGameplayZoom({
  canvas,
  blocked,
  cancel,
  apply,
  minimum = MIN_GAMEPLAY_ZOOM,
  maximum = MAX_GAMEPLAY_ZOOM,
  pan,
  restoreView,
}: {
  canvas: RefObject<HTMLCanvasElement | null>;
  blocked: () => boolean;
  cancel: () => void;
  apply: (zoom: number, focus?: ZoomFocus) => void;
  minimum?: number;
  maximum?: number;
  pan?: (x: number, y: number) => void;
  restoreView?: (fraction?: number) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [panned, setPanned] = useState(false);
  const [panReady, setPanReady] = useState(false),
    [panning, setPanning] = useState(false);
  const spaceHeld = useRef(false),
    mousePan = useRef<{ id: number; x: number; y: number } | null>(null);
  const value = useRef(1),
    pinch = useRef(new PinchZoom(minimum, maximum, !!pan));
  const resetFrame = useRef<number | null>(null);
  const stopReset = useCallback(() => {
    if (resetFrame.current !== null) cancelAnimationFrame(resetFrame.current);
    resetFrame.current = null;
  }, []);
  const callbacks = useRef({ blocked, cancel, apply, pan, restoreView });
  callbacks.current = { blocked, cancel, apply, pan, restoreView };
  const change = useCallback(
    (next: number, focus?: ZoomFocus) => {
      if (callbacks.current.blocked()) return;
      stopReset();
      const clamped = clampGameplayZoom(next, minimum, maximum);
      const translated =
        focus && (focus.from.x !== focus.to.x || focus.from.y !== focus.to.y);
      if (clamped === value.current && !translated) return;
      callbacks.current.cancel();
      value.current = clamped;
      callbacks.current.apply(value.current, focus);
      if (focus) setPanned(true);
      setZoom(value.current);
    },
    [minimum, maximum, stopReset],
  );
  const resetView = useCallback(() => {
    if (callbacks.current.blocked()) return;
    stopReset();
    callbacks.current.cancel();
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      callbacks.current.restoreView?.(1);
      value.current = 1;
      callbacks.current.apply(1);
      setZoom(1);
      setPanned(false);
      return;
    }
    const startZoom = value.current;
    const started = performance.now();
    let previousRemaining = 1;
    callbacks.current.restoreView?.(0);
    const frame = (now: number) => {
      if (callbacks.current.blocked()) {
        resetFrame.current = null;
        return;
      }
      const progress = Math.min(1, Math.max(0, (now - started) / 280));
      const remaining = (1 - progress) ** 3;
      callbacks.current.restoreView?.(1 - remaining / previousRemaining);
      value.current = 1 + (startZoom - 1) * remaining;
      callbacks.current.apply(value.current);
      setZoom(value.current);
      if (progress === 1) setPanned(false);
      previousRemaining = remaining;
      resetFrame.current = progress < 1 ? requestAnimationFrame(frame) : null;
    };
    resetFrame.current = requestAnimationFrame(frame);
  }, [stopReset]);
  useEffect(() => {
    const element = canvas.current!;
    const wheel = (event: WheelEvent) => {
      if (callbacks.current.blocked()) return;
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientHeight
            : 1;
      change(
        value.current *
          Math.exp(
            -Math.max(-1000, Math.min(1000, event.deltaY * unit)) * 0.0012,
          ),
        {
          from: { x: event.clientX, y: event.clientY },
          to: { x: event.clientX, y: event.clientY },
        },
      );
    };
    const key = (event: KeyboardEvent) => {
      if (
        callbacks.current.blocked() ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        event.defaultPrevented
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
        )
      )
        return;
      if (
        callbacks.current.pan &&
        (event.code === "Space" || event.key === " ") &&
        !(event.target instanceof Element && event.target.closest("button,a"))
      ) {
        event.preventDefault();
        spaceHeld.current = true;
        setPanReady(true);
        return;
      }
      if (["+", "=", "-", "_", "0"].includes(event.key)) {
        event.preventDefault();
        if (event.key === "0") {
          resetView();
          return;
        }
        change(
          value.current * (["+", "="].includes(event.key) ? 1.15 : 1 / 1.15),
        );
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.key === " ") {
        spaceHeld.current = false;
        setPanReady(false);
      }
    };
    const end = (event: globalThis.PointerEvent) => {
      if (event.pointerType === "touch") pinch.current.up(event.pointerId);
      if (mousePan.current?.id === event.pointerId) {
        mousePan.current = null;
        setPanning(false);
      }
    };
    const reset = () => {
      stopReset();
      pinch.current.reset();
      mousePan.current = null;
      spaceHeld.current = false;
      setPanReady(false);
      setPanning(false);
      callbacks.current.cancel();
    };
    const hidden = () => {
      if (document.hidden) reset();
    };
    element.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", keyUp);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
    window.addEventListener("resize", reset);
    window.addEventListener("orientationchange", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      element.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", keyUp);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
      window.removeEventListener("resize", reset);
      window.removeEventListener("orientationchange", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", hidden);
      pinch.current.reset();
      stopReset();
    };
  }, [canvas, change, resetView, stopReset]);
  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    if (callbacks.current.blocked()) return false;
    stopReset();
    if (
      callbacks.current.pan &&
      event.pointerType !== "touch" &&
      (event.button === 1 || (event.button === 0 && spaceHeld.current))
    ) {
      callbacks.current.cancel();
      mousePan.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setPanning(true);
      event.preventDefault();
      return true;
    }
    if (event.pointerType !== "touch" || callbacks.current.blocked())
      return false;
    if (
      !pinch.current.down(
        event.pointerId,
        { x: event.clientX, y: event.clientY },
        value.current,
      )
    )
      return false;
    callbacks.current.cancel();
    for (const id of pinch.current.pointerIds)
      event.currentTarget.setPointerCapture(id);
    event.preventDefault();
    return true;
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (mousePan.current?.id === event.pointerId) {
      const previous = mousePan.current;
      mousePan.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      if (!callbacks.current.blocked()) {
        if (event.clientX !== previous.x || event.clientY !== previous.y)
          setPanned(true);
        callbacks.current.pan?.(
          event.clientX - previous.x,
          event.clientY - previous.y,
        );
      }
      event.preventDefault();
      return true;
    }
    if (event.pointerType !== "touch") return false;
    const result = pinch.current.move(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (!result.consumed) return false;
    if (result.zoom !== undefined) change(result.zoom, result.focus);
    event.preventDefault();
    return true;
  };
  const end = (event: PointerEvent<HTMLCanvasElement>) => {
    if (mousePan.current?.id === event.pointerId) {
      mousePan.current = null;
      setPanning(false);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      callbacks.current.cancel();
      event.preventDefault();
      return true;
    }
    if (event.pointerType !== "touch" || !pinch.current.up(event.pointerId))
      return false;
    callbacks.current.cancel();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    event.preventDefault();
    return true;
  };
  return {
    zoom,
    panned,
    panReady,
    panning,
    change,
    down,
    move,
    end,
    zoomIn: () => change(value.current * 1.15),
    zoomOut: () => change(value.current / 1.15),
    reset: resetView,
  };
}
