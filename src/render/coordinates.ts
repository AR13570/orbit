import type { Vec2 } from "../game/types";
import {
  MOBILE_PULL_DISTANCE,
  pullDistance,
  usesTouchLayout,
} from "../controls";

export interface FieldBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Camera {
  center: Vec2;
  scale: number;
  /** Rotation of the world into screen space, in radians. */
  rotation?: number;
}
export function rotateVector(point: Vec2, rotation = 0): Vec2 {
  const c = Math.cos(rotation),
    s = Math.sin(rotation);
  return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
}
export interface FocusArea {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface WalkthroughFocus {
  position: Vec2;
  radius: number;
  area: FocusArea;
}
/** A view-only lens. Never used to change simulation bounds or the saved camera. */
export function walkthroughCamera(
  camera: Camera,
  focus: WalkthroughFocus | null,
  width: number,
  height: number,
): Camera {
  if (!focus) return camera;
  const { area } = focus;
  const scale = Math.max(
    0.001,
    Math.min(
      camera.scale,
      Math.max(1, area.width - 40) / Math.max(1, focus.radius * 2),
      Math.max(1, area.height - 40) / Math.max(1, focus.radius * 2),
    ),
  );
  const offset = rotateVector(
    {
      x: (area.left + area.width / 2 - width / 2) / scale,
      y: (area.top + area.height / 2 - height / 2) / scale,
    },
    -(camera.rotation ?? 0),
  );
  return {
    ...(camera.rotation !== undefined ? { rotation: camera.rotation } : {}),
    scale,
    center: {
      x: focus.position.x - offset.x,
      y: focus.position.y - offset.y,
    },
  };
}
export type DisplayRect = Pick<DOMRect, "left" | "top" | "width" | "height">;

/** Fit physical content while reserving real screen space around the launch control. */
export function fitPlayableCamera(
  bounds: FieldBounds,
  launch: Vec2,
  width: number,
  height: number,
  controlInset = MOBILE_PULL_DISTANCE + 18,
  padding = 18,
): Camera {
  const w = Math.max(1, width),
    h = Math.max(1, height);
  const inset = Math.min(controlInset, Math.min(w, h) / 2 - 1);
  let scale = Math.min(
    (w - 2 * padding) / Math.max(1, bounds.width),
    (h - 2 * padding) / Math.max(1, bounds.height),
  );
  for (const [span, start, size, anchor] of [
    [w, bounds.x, bounds.width, launch.x],
    [h, bounds.y, bounds.height, launch.y],
  ]) {
    scale = Math.min(
      scale,
      (span - padding - inset) / Math.max(1, anchor - start),
      (span - padding - inset) / Math.max(1, start + size - anchor),
    );
  }
  scale = Math.max(0.001, scale);
  function center(start: number, size: number, anchor: number, span: number) {
    const low = Math.max(
      start + size - (span / 2 - padding) / scale,
      anchor - (span / 2 - inset) / scale,
    );
    const high = Math.min(
      start + (span / 2 - padding) / scale,
      anchor + (span / 2 - inset) / scale,
    );
    return Math.min(high, Math.max(low, start + size / 2));
  }
  return {
    scale,
    center: {
      x: center(bounds.x, bounds.width, launch.x, w),
      y: center(bounds.y, bounds.height, launch.y, h),
    },
  };
}

export function contentBounds(
  circles: readonly { position: Vec2; radius: number }[],
): FieldBounds {
  const left = Math.min(...circles.map((c) => c.position.x - c.radius));
  const top = Math.min(...circles.map((c) => c.position.y - c.radius));
  return {
    x: left,
    y: top,
    width: Math.max(
      1,
      Math.max(...circles.map((c) => c.position.x + c.radius)) - left,
    ),
    height: Math.max(
      1,
      Math.max(...circles.map((c) => c.position.y + c.radius)) - top,
    ),
  };
}

export function fitCamera(
  bounds: FieldBounds,
  width: number,
  height: number,
): Camera {
  const w = Math.max(1, width),
    h = Math.max(1, height);
  const padding = Math.min(44, Math.min(w, h) * 0.08);
  return {
    center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    scale: Math.min(
      (w - padding * 2) / Math.max(1, bounds.width),
      (h - padding * 2) / Math.max(1, bounds.height),
    ),
  };
}

/** Portrait follows a readable portion of the field instead of shrinking the entire journey. */
export function fitFieldCamera(
  bounds: FieldBounds,
  launch: Vec2,
  width: number,
  height: number,
  leadX?: number,
  checkpoint?: { position: Vec2; radius: number },
  touchLayout = usesTouchLayout(width, height),
): Camera {
  if (checkpoint && touchLayout) {
    const camera = fitPlayableCamera(bounds, launch, width, height);
    if (leadX !== undefined && width < height) {
      const screenX = (leadX - camera.center.x) * camera.scale + width / 2;
      if (screenX > width * 0.65)
        camera.center.x = leadX - (width * 0.15) / camera.scale;
      else if (screenX < width * 0.2)
        camera.center.x = leadX + (width * 0.3) / camera.scale;
    }
    return camera;
  }
  if (width >= height) return fitCamera(bounds, width, height);
  let scale = Math.min(
    Math.max(1, width) / Math.min(900, bounds.width),
    Math.max(1, height - 60) / bounds.height,
  );
  const inset = 32;
  const left = Math.min(
    launch.x,
    checkpoint ? checkpoint.position.x - checkpoint.radius : launch.x,
  );
  const right = Math.max(
    launch.x,
    checkpoint ? checkpoint.position.x + checkpoint.radius : launch.x,
  );
  // Include the full capture ring and the fixed-size launcher affordance.
  // Keep this scale during flight so launching does not cause a zoom jump.
  if (checkpoint)
    scale = Math.min(
      scale,
      Math.max(1, width - inset * 2) / Math.max(1, right - left),
    );
  const visibleWidth = width / scale;
  const desired = leadX === undefined ? launch.x + 300 : leadX + 160;
  const low = bounds.x + visibleWidth / 2;
  const high = bounds.x + bounds.width - visibleWidth / 2;
  let centerX =
    low <= high
      ? Math.min(high, Math.max(low, desired))
      : bounds.x + bounds.width / 2;
  if (checkpoint && leadX === undefined)
    centerX = Math.min(
      left + visibleWidth / 2 - inset / scale,
      Math.max(right - visibleWidth / 2 + inset / scale, centerX),
    );
  return {
    center: {
      x: centerX,
      y: bounds.y + bounds.height / 2,
    },
    scale,
  };
}

/** Match the course's long axis to the viewport, preserving room for a full pull. */
export function fitOdesseyCamera(
  bounds: FieldBounds,
  launch: Vec2,
  width: number,
  height: number,
  _leadX?: number,
  checkpoint?: { position: Vec2; radius: number },
): Camera {
  const portrait = width < height;
  const viewWidth = portrait ? height : width;
  const viewHeight = portrait ? width : height;
  const reach = pullDistance("mouse", width, height);
  const left = Math.min(viewWidth / 2, reach + (portrait ? 80 : 24));
  const y = portrait
    ? viewHeight / 2
    : Math.max(reach + 24, Math.min(height - reach - 24, height * 0.55));
  const edges = {
    left: Math.min(
      bounds.x,
      launch.x,
      checkpoint ? checkpoint.position.x - checkpoint.radius : launch.x,
    ),
    right: Math.max(
      bounds.x + bounds.width,
      launch.x,
      checkpoint ? checkpoint.position.x + checkpoint.radius : launch.x,
    ),
    top: Math.min(
      bounds.y,
      launch.y,
      checkpoint ? checkpoint.position.y - checkpoint.radius : launch.y,
    ),
    bottom: Math.max(
      bounds.y + bounds.height,
      launch.y,
      checkpoint ? checkpoint.position.y + checkpoint.radius : launch.y,
    ),
  };
  // Solve all four edge constraints at the fixed launch anchor. This is the
  // closest possible default view with the complete playable content visible.
  let scale = Infinity;
  for (const [space, extent] of [
    [left - 24, launch.x - edges.left],
    [viewWidth - left - (portrait ? 100 : 24), edges.right - launch.x],
    [y - (portrait ? 24 : 80), launch.y - edges.top],
    [viewHeight - y - (portrait ? 24 : 60), edges.bottom - launch.y],
  ]) {
    if (extent > 0) scale = Math.min(scale, Math.max(1, space) / extent);
  }
  scale = Number.isFinite(scale) ? Math.max(0.001, scale) : 1;
  return {
    ...(portrait ? { rotation: -Math.PI / 2 } : {}),
    center: {
      x: launch.x + (viewWidth / 2 - left) / scale,
      y: launch.y + (viewHeight / 2 - y) / scale,
    },
    scale,
  };
}

export function interpolateCamera(
  from: Camera,
  to: Camera,
  progress: number,
): Camera {
  const t = 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3;
  return {
    ...(to.rotation !== undefined ? { rotation: to.rotation } : {}),
    center: {
      x: from.center.x + (to.center.x - from.center.x) * t,
      y: from.center.y + (to.center.y - from.center.y) * t,
    },
    scale: from.scale + (to.scale - from.scale) * t,
  };
}

export function clientToWorld(
  clientX: number,
  clientY: number,
  rect: DisplayRect,
  camera: Camera,
): Vec2 {
  if (!(camera.scale > 0) || !(rect.width > 0) || !(rect.height > 0))
    return { x: NaN, y: NaN };
  const offset = rotateVector(
    {
      x: (clientX - rect.left - rect.width / 2) / camera.scale,
      y: (clientY - rect.top - rect.height / 2) / camera.scale,
    },
    -(camera.rotation ?? 0),
  );
  return { x: camera.center.x + offset.x, y: camera.center.y + offset.y };
}

export function worldToClient(
  point: Vec2,
  rect: DisplayRect,
  camera: Camera,
): Vec2 {
  const offset = rotateVector(
    { x: point.x - camera.center.x, y: point.y - camera.center.y },
    camera.rotation,
  );
  return {
    x: rect.left + rect.width / 2 + offset.x * camera.scale,
    y: rect.top + rect.height / 2 + offset.y * camera.scale,
  };
}

export function visibleWorldBounds(
  camera: Camera,
  width: number,
  height: number,
): FieldBounds {
  const c = Math.abs(Math.cos(camera.rotation ?? 0));
  const s = Math.abs(Math.sin(camera.rotation ?? 0));
  const worldWidth = (width * c + height * s) / camera.scale;
  const worldHeight = (height * c + width * s) / camera.scale;
  return {
    x: camera.center.x - worldWidth / 2,
    y: camera.center.y - worldHeight / 2,
    width: worldWidth,
    height: worldHeight,
  };
}

/** Clip the optical pull along its original ray, leaving the actual gesture unchanged. */
export function visiblePullPoint(
  anchor: Vec2,
  pull: Vec2,
  camera: Camera,
  width: number,
  height: number,
): Vec2 {
  const screen = worldToClient(
    anchor,
    { left: 0, top: 0, width, height },
    camera,
  );
  const delta = rotateVector(
    { x: pull.x - anchor.x, y: pull.y - anchor.y },
    camera.rotation,
  );
  const dx = delta.x * camera.scale,
    dy = delta.y * camera.scale;
  let fraction = Math.min(1, 85 / Math.max(0.001, Math.hypot(dx, dy)));
  const inset = 14;
  if (dx > 0) fraction = Math.min(fraction, (width - inset - screen.x) / dx);
  if (dx < 0) fraction = Math.min(fraction, (inset - screen.x) / dx);
  if (dy > 0) fraction = Math.min(fraction, (height - inset - screen.y) / dy);
  if (dy < 0) fraction = Math.min(fraction, (inset - screen.y) / dy);
  fraction = Math.max(0, fraction);
  return {
    x: anchor.x + (pull.x - anchor.x) * fraction,
    y: anchor.y + (pull.y - anchor.y) * fraction,
  };
}
