import { useEffect, useRef } from "react";
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
    <div className="dialog-backdrop">
      <section
        ref={ref}
        className="game-dialog"
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
        <div className="dialog-header">
          <h1 id="pause-title">Paused</h1>
        </div>
        <div className="dialog-actions">
          <button className="button-primary" onClick={onResume}>
            Resume
          </button>
          <button
            className="button-secondary"
            onClick={onSound}
            aria-pressed={!muted}
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
          <button className="button-secondary" onClick={onHelp}>
            How to play
          </button>
          {flying && (
            <button className="button-secondary" onClick={onResetShot}>
              Reset shot
            </button>
          )}
          <button className="button-secondary" onClick={onRestart}>
            New seed
          </button>
        </div>
      </section>
    </div>
  );
}
