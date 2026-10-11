import { useEffect, useRef } from "react";
import Icon from "./Icon";
export default function PauseMenu({
  onResume,
  onHelp,
  onRestart,
  onResetShot,
  onSound,
  muted,
  flying,
}: {
  onResume: () => void;
  onHelp: () => void;
  onRestart: () => void;
  onResetShot: () => void;
  onSound: () => void;
  muted: boolean;
  flying: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);
  return (
    <div className="dialog-backdrop pause-backdrop">
      <section
        ref={ref}
        className="game-dialog pause-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape" || e.key.toLowerCase() === "p") {
            e.preventDefault();
            onResume();
          }
          if (e.key === "Tab") {
            const buttons = ref.current!.querySelectorAll("button");
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="pause-heading">
          <div className="pause-emblem" aria-hidden="true">
            <Icon name="pause" />
          </div>
          <h1 id="pause-title">Paused</h1>
        </div>
        <div className="pause-actions">
          <button className="pause-resume" onClick={onResume}>
            Resume
            <Icon name="play" />
          </button>
          <div className="pause-options">
            <button
              className="pause-option"
              onClick={onSound}
              aria-pressed={!muted}
            >
              <Icon name={muted ? "muted" : "sound"} />
              <span>{muted ? "Sound off" : "Sound on"}</span>
              <span className="pause-switch" aria-hidden="true" />
            </button>
            <button className="pause-option" onClick={onHelp}>
              <Icon name="help" />
              <span>How to play</span>
              <span className="pause-chevron" aria-hidden="true" />
            </button>
            {flying && (
              <button className="pause-option" onClick={onResetShot}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 10a8 8 0 1 1 1.8 7M4 5v5h5" />
                </svg>
                <span>Reset shot</span>
                <span className="pause-chevron" aria-hidden="true" />
              </button>
            )}
          </div>
          <button className="pause-option pause-new-seed" onClick={onRestart}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m4 7 4-2 8 14 4-2M4 17l4 2L16 5l4 2M17 4l3 3-3 3m0 4 3 3-3 3" />
            </svg>
            <span>New seed</span>
            <span className="pause-chevron" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
