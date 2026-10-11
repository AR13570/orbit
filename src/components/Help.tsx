import { useEffect, useRef } from "react";
export default function Help({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="game-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
          if (e.key === "Tab") {
            const buttons = ref.current!.querySelectorAll("button"),
              first = buttons[0],
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
          <h2 id="help-title">How to play</h2>
          <button
            className="icon-button"
            aria-label="Close help"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="help-list">
          <div className="help-row">
            <span className="help-icon" aria-hidden="true">
              ↔
            </span>
            <div className="help-copy">
              <strong>Pull back and release</strong>
              <p>
                Click or touch anywhere and drag backward. Your ship flies in
                the opposite direction when you release. Pull farther to fly
                faster. A small tap cancels. Double-tap to switch between one
                ship and split mode. In split mode, tap during flight to split
                your ship into three. You can split once per shot. The mode
                stays selected as you explore or choose New seed.
              </p>
            </div>
          </div>
          <div className="help-row">
            <span className="help-icon" aria-hidden="true">
              ◉
            </span>
            <div className="help-copy">
              <strong>Read the gravity</strong>
              <p>
                Curve around the central obstacles. Every solid object pulls or
                pushes; larger objects exert stronger forces. Blue inward marks
                attract; rust outward marks repel. Avoid hitting the solids.
              </p>
            </div>
          </div>
          <div className="help-row">
            <span className="help-icon" aria-hidden="true">
              ○
            </span>
            <div className="help-copy">
              <strong>Keep moving right</strong>
              <p>
                The blue gravity well with the tiny flag is your next
                checkpoint. Its small ring pulls approaching ships strongly
                inward. Reach it to move forward automatically. You cannot steer
                after release.
              </p>
            </div>
          </div>
          <div className="help-row">
            <span className="help-icon" aria-hidden="true">
              ↻
            </span>
            <div className="help-copy">
              <strong>Keep exploring</strong>
              <p>
                Gravity keeps acting outside the visible field. Each ship has
                six seconds to return; coming back resets its timer. Pause
                freezes the countdown. When every ship is lost, the same shot
                resets after brief feedback. Retry as often as you like. Your
                checkpoint progress stays with you.
              </p>
            </div>
          </div>
        </div>
        <p className="help-controls">
          Escape or P pauses and cancels a held pull. R or the top reset icon
          resets your current shot without losing checkpoint progress. Rotating,
          resizing, or switching apps cancels safely. Sound, New seed, and a
          free shot reset are in the pause menu.
        </p>
        <div className="dialog-actions">
          <button className="button-primary" onClick={onClose}>
            Back to pause
          </button>
        </div>
      </div>
    </div>
  );
}
