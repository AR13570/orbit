import type { Vec2 } from "./game/types";
import type { Camera } from "./render/coordinates";
export const MIN_GAMEPLAY_ZOOM = 0.25;
export const MIN_GRAVITY_ZOOM = 0.5;
export const MAX_GAMEPLAY_ZOOM = 4;
export function clampGameplayZoom(value: number, minimum = MIN_GAMEPLAY_ZOOM) {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.min(MAX_GAMEPLAY_ZOOM, value))
    : 1;
}
export function zoomCamera(
  camera: Camera,
  factor: number,
  minimum = MIN_GAMEPLAY_ZOOM,
): Camera {
  return {
    center: { ...camera.center },
    scale: camera.scale * clampGameplayZoom(factor, minimum),
  };
}
/** A pinch owns the whole touch session, including the last remaining finger. */
export class PinchZoom {
  constructor(private minimum = MIN_GAMEPLAY_ZOOM) {}
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
      this.startZoom = clampGameplayZoom(zoom, this.minimum);
      this.lastZoom = this.startZoom;
    }
    return this.pinching;
  }
  move(id: number, point: Vec2): { consumed: boolean; zoom?: number } {
    if (!this.points.has(id)) return { consumed: false };
    this.points.set(id, { ...point });
    if (!this.pinching) return { consumed: false };
    if (this.points.size < 2) return { consumed: true };
    this.lastZoom = clampGameplayZoom(
      (this.startZoom * this.distance()) / this.startDistance,
      this.minimum,
    );
    return { consumed: true, zoom: this.lastZoom };
  }

  up(id: number) {
    if (!this.points.has(id)) return false;
    const consumed = this.pinching;
    this.points.delete(id);
    if (this.points.size === 0) this.pinching = false;
    else if (this.pinching && this.points.size >= 2) {
      this.startDistance = Math.max(1, this.distance());
      this.startZoom = this.lastZoom;
    }
    return consumed;
  }
  reset() {
    this.points.clear();
    this.pinching = false;
  }
  private distance() {
    const [a, b] = [...this.points.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
