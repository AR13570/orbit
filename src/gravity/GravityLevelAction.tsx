import { useLayoutEffect, useRef, type RefObject } from "react";
import Icon from "../components/Icon";

export default function GravityLevelAction({
  complete,
  borderRef,
  onNext,
  onSkip,
}: {
  complete: boolean;
  borderRef: RefObject<SVGPathElement | null>;
  onNext: () => void;
  onSkip: () => void;
}) {
  const face = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!complete || !face.current) return;
    const measure = () => {
      const width = face.current!.clientWidth - 2;
      const height = face.current!.clientHeight - 2;
      if (width <= 0 || height <= 0) return;
      const radius = Math.min(width / 2, height / 2);
      const track = face.current!.querySelector(".gravity-next-track");
      track?.setAttribute("rx", String(radius));
      track?.setAttribute("ry", String(radius));
      // Start at twelve o'clock, then follow the rounded rectangle clockwise.
      borderRef.current?.setAttribute(
        "d",
        [
          `M ${width / 2} 0`,
          `H ${width - radius} A ${radius} ${radius} 0 0 1 ${width} ${radius}`,
          `V ${height - radius} A ${radius} ${radius} 0 0 1 ${width - radius} ${height}`,
          `H ${radius} A ${radius} ${radius} 0 0 1 0 ${height - radius}`,
          `V ${radius} A ${radius} ${radius} 0 0 1 ${radius} 0`,
          `H ${width / 2} Z`,
        ].join(" "),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(face.current);
    return () => observer.disconnect();
  }, [complete, borderRef]);
  return (
    <>
      <button
        className={`gravity-skip gravity-level-action${complete ? " gravity-next" : ""}`}
        aria-label={complete ? "Next level" : "Skip level"}
        onClick={complete ? onNext : onSkip}
      >
        <span ref={face} className="gravity-level-action-face">
          {complete && (
            <svg className="gravity-next-border" aria-hidden="true">
              <rect
                width="100%"
                height="100%"
                rx="15"
                ry="15"
                className="gravity-next-track"
              />
              <path
                ref={borderRef}
                pathLength="1"
                className="gravity-next-progress"
                style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
              />
            </svg>
          )}
          {complete ? "Next level" : "Skip level"}
          <Icon name={complete ? "play" : "skip"} />
        </span>
      </button>
      {complete && (
        <span className="visually-hidden" role="status">
          Level complete. The next level starts automatically in three seconds.
        </span>
      )}
    </>
  );
}
