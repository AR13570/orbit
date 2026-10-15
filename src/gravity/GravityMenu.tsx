import { dialogControls } from "../components/dialogFocus";
import { useEffect, useRef, type ReactNode } from "react";
import Attribution from "../components/Attribution";
export default function GravityMenu({
  title,
  onClose,
  dismissOnBackdrop = false,
  children,
  showAttribution = false,
}: {
  title: string;
  onClose: () => void;
  dismissOnBackdrop?: boolean;
  children: ReactNode;
  showAttribution?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [title]);
  return (
    <div
      className={`dialog-backdrop pause-backdrop${showAttribution ? " pause-backdrop-attributed" : ""}`}
      onClick={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget)
          onClose();
      }}
    >
      <section
        ref={ref}
        className="game-dialog pause-menu gravity-menu"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape" || e.key.toLowerCase() === "p") {
            e.preventDefault();
            onClose();
          }
          if (e.key === "Tab") {
            const buttons = dialogControls(ref.current!);
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
          <h1>{title}</h1>
        </div>
        <div className="pause-actions">{children}</div>
      </section>
      {showAttribution && <Attribution />}
    </div>
  );
}
