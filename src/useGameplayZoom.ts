import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type PointerEvent,
} from "react";
import { clampGameplayZoom, MIN_GAMEPLAY_ZOOM, PinchZoom } from "./zoom";
export function useGameplayZoom({
  canvas,
  blocked,
  cancel,
  apply,
  minimum = MIN_GAMEPLAY_ZOOM,
}: {
  canvas: RefObject<HTMLCanvasElement | null>;
  blocked: () => boolean;
  cancel: () => void;
  apply: (zoom: number) => void;
  minimum?: number;
}) {
  const [zoom, setZoom] = useState(1);
  const value = useRef(1),
    pinch = useRef(new PinchZoom(minimum));
  const callbacks = useRef({ blocked, cancel, apply });
  callbacks.current = { blocked, cancel, apply };
  const change = useCallback(
    (next: number) => {
      if (callbacks.current.blocked()) return;
      const clamped = clampGameplayZoom(next, minimum);
      if (clamped === value.current) return;
      callbacks.current.cancel();
      value.current = clamped;
      callbacks.current.apply(value.current);
      setZoom(value.current);
    },
    [minimum],
  );
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
            -Math.max(-1000, Math.min(1000, event.deltaY * unit)) * 0.002,
          ),
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
      if (["+", "=", "-", "_", "0"].includes(event.key)) {
        event.preventDefault();
        change(
          event.key === "0"
            ? 1
            : value.current *
                (["+", "="].includes(event.key) ? 1.15 : 1 / 1.15),
        );
      }
    };
    const end = (event: globalThis.PointerEvent) => {
      if (event.pointerType === "touch") pinch.current.up(event.pointerId);
    };
    const reset = () => {
      pinch.current.reset();
      callbacks.current.cancel();
    };
    const hidden = () => {
      if (document.hidden) reset();
    };
    element.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", key);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
    window.addEventListener("resize", reset);
    window.addEventListener("orientationchange", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      element.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
      window.removeEventListener("resize", reset);
      window.removeEventListener("orientationchange", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", hidden);
      pinch.current.reset();
    };
  }, [canvas, change]);
  const down = (event: PointerEvent<HTMLCanvasElement>) => {
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
    if (event.pointerType !== "touch") return false;
    const result = pinch.current.move(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (!result.consumed) return false;
    if (result.zoom !== undefined) change(result.zoom);
    event.preventDefault();
    return true;
  };
  const end = (event: PointerEvent<HTMLCanvasElement>) => {
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
    change,
    down,
    move,
    end,
    zoomIn: () => change(value.current * 1.15),
    zoomOut: () => change(value.current / 1.15),
    reset: () => change(1),
  };
}
