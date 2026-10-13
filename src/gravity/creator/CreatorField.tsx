import { useEffect, useId, useRef, useState } from "react";
import { bodyStrength, distance } from "../../game/physics";
import type { Body, Vec2 } from "../../game/types";
import {
  clampPosition,
  gravityRing,
  ringStrength,
  snapPosition,
} from "./controls";
import { MAX_CREATOR_STRENGTH, type CreatorLevel } from "./model";
export type CreatorTool = "select" | Body["kind"];
type Drag = {
  id: string;
  pointer: number;
  kind: "move" | "size" | "gravity" | "place";
  start: Vec2;
  offset: Vec2;
  radius: number;
  strength: number;
  distance: number;
};

export default function CreatorField({
  level,
  selected,
  tool,
  onSelect,
  onMove,
  onBodyChange,
  onPlace,
  onRemove,
}: {
  level: CreatorLevel;
  selected: string;
  tool: CreatorTool;
  onSelect: (id: string) => void;
  onMove: (id: string, point: Vec2) => void;
  onBodyChange: (id: string, update: Partial<Body>) => void;
  onPlace: (kind: Body["kind"], point: Vec2) => void;
  onRemove: (id: string) => void;
}) {
  const field = useRef<SVGSVGElement>(null),
    drag = useRef<Drag | null>(null);
  const [scale, setScale] = useState(1);
  const [alignment, setAlignment] = useState<Partial<Vec2> | null>(null);
  const grid = useId();
  const cancel = () => {
    const active = drag.current;
    drag.current = null;
    setAlignment(null);
    if (active && field.current?.hasPointerCapture?.(active.pointer))
      field.current.releasePointerCapture(active.pointer);
  };
  useEffect(() => {
    const resize = () => {
      cancel();
      const rect = field.current?.getBoundingClientRect();
      if (rect?.width && rect.height)
        setScale(Math.min(rect.width / 900, rect.height / 900));
    };
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (field.current) observer?.observe(field.current);
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("blur", cancel);
    };
  }, []);
  useEffect(() => {
    cancel();
  }, [level.id]);
  const point = (x: number, y: number): Vec2 => {
    const rect = field.current!.getBoundingClientRect();
    const fitted = Math.min(
      (rect.width || 900) / 900,
      (rect.height || 900) / 900,
    );
    return {
      x: (x - rect.left - ((rect.width || 900) - fitted * 900) / 2) / fitted,
      y: (y - rect.top - ((rect.height || 900) - fitted * 900) / 2) / fitted,
    };
  };
  const getPosition = (id: string) =>
    id === "launcher"
      ? level.launch
      : level.bodies.find((b) => b.id === id)!.position;
  const move = (id: string, p: Vec2) =>
    onMove(
      id,
      clampPosition(
        p,
        id === "launcher"
          ? 10
          : (level.bodies.find((b) => b.id === id)?.radius ?? 10),
      ),
    );
  const begin = (
    e: React.PointerEvent<SVGGElement>,
    id: string,
    kind: Drag["kind"],
  ) => {
    e.stopPropagation();
    if (e.button !== 0 || e.isPrimary === false || drag.current) {
      cancel();
      return;
    }
    e.preventDefault();
    onSelect(id);
    const start = point(e.clientX, e.clientY),
      origin = getPosition(id),
      body = level.bodies.find((b) => b.id === id);
    drag.current = {
      id,
      pointer: e.pointerId,
      kind,
      start,
      offset: { x: start.x - origin.x, y: start.y - origin.y },
      radius: body?.radius ?? 0,
      strength: body?.strength ?? 0,
      distance: distance(start, origin),
    };
    field.current?.setPointerCapture?.(e.pointerId);
  };
  const contextSelect = (e: React.MouseEvent<SVGGElement>, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    cancel();
    onSelect(id);
  };
  const bodyProps = (id: string, label: string) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    "aria-pressed": selected === id,
    onFocus: () => onSelect(id),
    onClick: () => {
      onSelect(id);
    },
    onPointerDown: (e: React.PointerEvent<SVGGElement>) => begin(e, id, "move"),
    onContextMenu: (e: React.MouseEvent<SVGGElement>) => contextSelect(e, id),
    onKeyDown: (e: React.KeyboardEvent<SVGGElement>) => {
      if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
        e.preventDefault();
        onSelect(id);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (id !== "launcher") onRemove(id);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(id);
        return;
      }
      const d = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[e.key];
      if (!d) return;
      e.preventDefault();
      const p = getPosition(id),
        step = e.shiftKey ? 1 : 10;
      move(id, { x: p.x + d[0] * step, y: p.y + d[1] * step });
    },
  });
  const movePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const active = drag.current;
    if (!active || active.pointer !== e.pointerId) return;
    const p = point(e.clientX, e.clientY);
    if (active.kind === "place") return;
    if (active.kind === "move") {
      const rect = field.current!.getBoundingClientRect();
      const screenScale = Math.min(
        (rect.width || 900) / 900,
        (rect.height || 900) / 900,
      );
      const snapped = snapPosition(
        level,
        active.id,
        {
          x: p.x - active.offset.x,
          y: p.y - active.offset.y,
        },
        10 / screenScale,
      );
      setAlignment(snapped.axes);
      onMove(active.id, snapped.position);
      return;
    }
    const body = level.bodies.find((b) => b.id === active.id);
    if (!body) return;
    const origin = {
      x: active.start.x - active.offset.x,
      y: active.start.y - active.offset.y,
    };
    const delta = distance(p, origin) - active.distance;
    if (active.kind === "size") {
      const radius = Math.round(
        Math.max(16, Math.min(80, active.radius + delta)),
      );
      onBodyChange(body.id, {
        radius,
        position: clampPosition(origin, radius),
      });
    } else
      onBodyChange(body.id, {
        strength: ringStrength(gravityRing(active.strength) + delta),
      });
  };
  const selectedBody = level.bodies.find((b) => b.id === selected);
  const slider = (
    body: Body,
    kind: "size" | "gravity",
    x: number,
    y: number,
  ) => {
    const strengthValue = Math.sqrt(body.strength / bodyStrength(1));
    return (
      <g
        key={kind}
        role="slider"
        tabIndex={0}
        aria-label={kind === "size" ? "Body size" : "Gravity strength"}
        aria-valuemin={kind === "size" ? 16 : 0}
        aria-valuemax={kind === "size" ? 80 : 160}
        aria-valuenow={
          kind === "size" ? body.radius : Math.round(strengthValue)
        }
        aria-valuetext={
          kind === "size"
            ? `${body.radius} size`
            : `${(body.strength / bodyStrength(40)).toFixed(2)} times gravity`
        }
        className={`creator-handle creator-handle-${kind}`}
        onPointerDown={(e) => begin(e, body.id, kind)}
        onContextMenu={(e) => contextSelect(e, body.id)}
        onKeyDown={(e) => {
          const dir = {
            ArrowLeft: -1,
            ArrowDown: -1,
            ArrowRight: 1,
            ArrowUp: 1,
          }[e.key];
          if (!dir && e.key !== "Home" && e.key !== "End") return;
          e.preventDefault();
          e.stopPropagation();
          if (kind === "size") {
            const radius =
              e.key === "Home"
                ? 16
                : e.key === "End"
                  ? 80
                  : Math.max(
                      16,
                      Math.min(80, body.radius + dir! * (e.shiftKey ? 5 : 1)),
                    );
            onBodyChange(body.id, {
              radius,
              position: clampPosition(body.position, radius),
            });
          } else {
            const strength =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? MAX_CREATOR_STRENGTH
                  : bodyStrength(
                      Math.max(
                        0,
                        Math.min(
                          160,
                          strengthValue + dir! * (e.shiftKey ? 5 : 1),
                        ),
                      ),
                    );
            onBodyChange(body.id, { strength });
          }
        }}
      >
        <circle cx={x} cy={y} r={22 / scale} fill="transparent" />
        <circle
          className="creator-handle-dot"
          cx={x}
          cy={y}
          r={8 / scale}
          fill={kind === "size" ? "#303943" : "#527c9a"}
          stroke="#f4f6f8"
          strokeWidth={2 / scale}
        />
        <text
          x={x}
          y={y + (kind === "size" ? -19 : 27) / scale}
          textAnchor="middle"
          fontSize={11 / scale}
          fill={kind === "size" ? "#303943" : "#527c9a"}
          pointerEvents="none"
        >
          {kind === "size" ? "Size" : "Gravity"}
        </text>
      </g>
    );
  };
  return (
    <svg
      ref={field}
      className={`creator-field ${tool !== "select" ? "creator-placing" : ""}`}
      viewBox="0 0 900 900"
      aria-label="Level design field"
      onPointerDown={(e) => {
        if (e.button !== 0 || e.isPrimary === false || drag.current) {
          cancel();
          return;
        }
        e.preventDefault();
        onSelect("");
        const start = point(e.clientX, e.clientY);
        if (
          tool !== "select" &&
          start.x >= 0 &&
          start.y >= 0 &&
          start.x <= 900 &&
          start.y <= 900
        ) {
          drag.current = {
            id: "",
            pointer: e.pointerId,
            kind: "place",
            start,
            offset: start,
            radius: 0,
            strength: 0,
            distance: 0,
          };
          field.current?.setPointerCapture?.(e.pointerId);
        }
      }}
      onPointerMove={movePointer}
      onPointerUp={(e) => {
        const active = drag.current;
        if (active?.pointer !== e.pointerId) return;
        if (active.kind === "place") {
          const p = point(e.clientX, e.clientY);
          if (distance(p, active.start) * scale < 12 && tool !== "select")
            onPlace(tool, p);
        } else movePointer(e);
        cancel();
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
    >
      <defs>
        <pattern id={grid} width="50" height="50" patternUnits="userSpaceOnUse">
          <circle cx="25" cy="25" r="1.2" fill="#bdc7cf" />
        </pattern>
      </defs>
      <rect
        width="900"
        height="900"
        fill={`url(#${grid})`}
        stroke="#cbd3d9"
        strokeDasharray="3 12"
        rx="8"
      />
      <g
        aria-hidden="true"
        pointerEvents="none"
        stroke="#527c9a"
        strokeWidth={1 / scale}
        strokeDasharray={`${5 / scale} ${5 / scale}`}
        opacity=".7"
      >
        {alignment?.x !== undefined && (
          <line
            data-testid="creator-alignment-x"
            x1={alignment.x}
            x2={alignment.x}
            y1="0"
            y2="900"
          />
        )}
        {alignment?.y !== undefined && (
          <line
            data-testid="creator-alignment-y"
            y1={alignment.y}
            y2={alignment.y}
            x1="0"
            x2="900"
          />
        )}
      </g>
      {level.bodies.map((body, i) => (
        <g
          key={body.id}
          {...bodyProps(
            body.id,
            `${body.kind === "attractor" ? "Attractor" : "Repeller"} ${i + 1} on field`,
          )}
          className="creator-object"
        >
          <circle
            cx={body.position.x}
            cy={body.position.y}
            r={gravityRing(body.strength)}
            fill="none"
            stroke={body.kind === "attractor" ? "#527c9a" : "#a45c52"}
            strokeWidth={selected === body.id ? 1.5 / scale : 1 / scale}
            opacity={selected === body.id ? 0.6 : 0.14}
            pointerEvents="none"
          />
          <circle
            cx={body.position.x}
            cy={body.position.y}
            r={Math.max(body.radius, 22 / scale)}
            fill="transparent"
          />
          <circle
            cx={body.position.x}
            cy={body.position.y}
            r={body.radius}
            fill={body.kind === "attractor" ? "#303943" : "#a45c52"}
          />
          {selected === body.id && (
            <circle
              cx={body.position.x}
              cy={body.position.y}
              r={body.radius + 6 / scale}
              fill="none"
              stroke="#527c9a"
              strokeDasharray="4 5"
              strokeWidth={1 / scale}
              pointerEvents="none"
            />
          )}
          {body.kind === "repellent" && (
            <path
              d={`M${body.position.x - 8} ${body.position.y}h16`}
              stroke="white"
              strokeWidth="2"
              pointerEvents="none"
            />
          )}
        </g>
      ))}
      <g
        {...bodyProps("launcher", "Launcher on field")}
        className="creator-object"
      >
        <circle
          cx={level.launch.x}
          cy={level.launch.y}
          r={22 / scale}
          fill="transparent"
        />
        <circle
          cx={level.launch.x}
          cy={level.launch.y}
          r="25"
          fill="#e9ecef"
          stroke="#527c9a"
          strokeWidth={selected === "launcher" ? 3 : 1}
          strokeDasharray="4 5"
        />
        <circle cx={level.launch.x} cy={level.launch.y} r="7" fill="#527c9a" />
      </g>
      {selectedBody &&
        (() => {
          const b = selectedBody,
            r = Math.max(b.radius + 24, 44 / scale),
            sx = b.position.x + (b.position.x <= 450 ? r : -r),
            gy =
              b.position.y +
              (b.position.y < 450 ? 1 : -1) *
                Math.max(gravityRing(b.strength), 44 / scale);
          return (
            <g>
              <path
                d={`M${b.position.x} ${b.position.y}H${sx}`}
                stroke="#303943"
                opacity=".35"
                strokeWidth={1 / scale}
                pointerEvents="none"
              />
              {gravityRing(b.strength) < 44 / scale && (
                <path
                  d={`M${b.position.x} ${b.position.y + (b.position.y < 450 ? 1 : -1) * gravityRing(b.strength)}V${gy}`}
                  stroke="#527c9a"
                  opacity=".6"
                  strokeWidth={1 / scale}
                  pointerEvents="none"
                />
              )}
              {slider(b, "size", sx, b.position.y)}
              {slider(b, "gravity", b.position.x, gy)}
            </g>
          );
        })()}
    </svg>
  );
}
