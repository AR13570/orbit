import { useId, useState, type ReactNode } from "react";

export default function AdvancedSettings({
  children,
}: {
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div className="pause-advanced" data-expanded={expanded}>
      <button
        type="button"
        className="pause-option pause-advanced-toggle"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((value) => !value)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 17h16" />
          <circle cx="9" cy="7" r="2.5" fill="var(--ground)" />
          <circle cx="15" cy="17" r="2.5" fill="var(--ground)" />
        </svg>
        <span>Advanced</span>
        <span className="pause-chevron" aria-hidden="true" />
      </button>
      <div
        id={id}
        className="pause-advanced-panel"
        inert={!expanded}
        aria-hidden={!expanded}
      >
        <div className="pause-advanced-clip">
          <div className="pause-advanced-options">{children}</div>
        </div>
      </div>
    </div>
  );
}
