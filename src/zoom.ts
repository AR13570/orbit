import type { Vec2 } from "./game/types";
import type { Camera } from "./render/coordinates";
export interface ZoomFocus {
  from: Vec2;
  to: Vec2;
}
export const MIN_GAMEPLAY_ZOOM = 0.25;
export const MIN_GRAVITY_ZOOM = 0.5;
export const MAX_GAMEPLAY_ZOOM = 2;
export const MAX_ODESSEY_ZOOM = 1.2;
export const MIN_ODESSEY_ZOOM = 1 / MAX_ODESSEY_ZOOM;
export function clampGameplayZoom(
  value: number,
  minimum = MIN_GAMEPLAY_ZOOM,
  maximum = MAX_GAMEPLAY_ZOOM,
) {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : 1;
}
export function zoomCamera(
  camera: Camera,
  factor: number,
  minimum = MIN_GAMEPLAY_ZOOM,
  maximum = MAX_GAMEPLAY_ZOOM,
): Camera {
  return {
    ...(camera.rotation !== undefined ? { rotation: camera.rotation } : {}),
    center: { ...camera.center },
    scale: camera.scale * clampGameplayZoom(factor, minimum, maximum),
  };
}
/** A pinch owns the whole touch session, including the last remaining finger. */
export class PinchZoom {
  constructor(
    private minimum = MIN_GAMEPLAY_ZOOM,
    private maximum = MAX_GAMEPLAY_ZOOM,
    private panEnabled = false,
  ) {}
  private midpoint: Vec2 | null = null;
  private points = new Map<number, Vec2>();
  private pinching = false;
  private startDistance = 1;
  private startZoom = 1;
  private lastZoom = 1;
  get pointerIds() {
    return [...this.points.keys()];
  }
  down(id: number, point: Vec2, zoom: number) {
    const before = this.points.size;
    this.points.set(id, { ...point });
    if (before < 2 && this.points.size >= 2) {
      this.pinching = true;
      this.startDistance = Math.max(1, this.distance());
      this.startZoom = clampGameplayZoom(zoom, this.minimum, this.maximum);
      this.lastZoom = this.startZoom;
      this.midpoint = this.center();
    }
    return this.pinching;
  }
  move(
    id: number,
    point: Vec2,
  ): { consumed: boolean; zoom?: number; pan?: Vec2; focus?: ZoomFocus } {
    if (!this.points.has(id)) return { consumed: false };
    this.points.set(id, { ...point });
    if (!this.pinching) return { consumed: false };
    if (this.points.size < 2) return { consumed: true };
    // Ease the distance ratio so a small finger spread does not hit the cap.
    this.lastZoom = clampGameplayZoom(
      this.startZoom * (this.distance() / this.startDistance) ** 0.65,
      this.minimum,
      this.maximum,
    );
    const center = this.center();
    const focus = { from: this.midpoint ?? center, to: center };
    const pan = this.midpoint
      ? { x: center.x - this.midpoint.x, y: center.y - this.midpoint.y }
      : { x: 0, y: 0 };
    this.midpoint = center;
    return {
      consumed: true,
      zoom: this.lastZoom,
      focus,
      ...(this.panEnabled ? { pan } : {}),
    };
  }

  up(id: number) {
    if (!this.points.has(id)) return false;
    const consumed = this.pinching;
    this.points.delete(id);
    if (this.points.size === 0) this.pinching = false;
    else if (this.pinching && this.points.size >= 2) {
      this.startDistance = Math.max(1, this.distance());
      this.startZoom = this.lastZoom;
      this.midpoint = this.center();
    }
    return consumed;
  }
  reset() {
    this.points.clear();
    this.pinching = false;
    this.midpoint = null;
  }
  private center() {
    const [a, b] = [...this.points.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  private distance() {
    const [a, b] = [...this.points.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
