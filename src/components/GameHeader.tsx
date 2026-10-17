import type { ReactNode } from "react";

export default function GameHeader({
  title,
  children,
  label,
  onHome,
}: {
  title: string;
  children: ReactNode;
  label?: string;
  onHome?: () => void;
}) {
  return (
    <div className="scene-hud" aria-label={label}>
      {onHome ? (
        <button
          className="game-header-home"
          aria-label="Back to main menu"
          title="Main menu"
          onClick={onHome}
        >
          <img className="game-header-mark" src="/orbit.svg" alt="" />
        </button>
      ) : (
        <img className="game-header-mark" src="/orbit.svg" alt="" />
      )}
      <div className="game-header-copy">
        <span className="game-header-title" title={title}>
          {title}
        </span>
        <div className="game-header-status">{children}</div>
      </div>
    </div>
  );
}
