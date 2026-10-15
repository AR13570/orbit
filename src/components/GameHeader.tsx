import type { ReactNode } from "react";

export default function GameHeader({
  title,
  children,
  label,
}: {
  title: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="scene-hud" aria-label={label}>
      <img className="game-header-mark" src="/orbit.svg" alt="" />
      <div className="game-header-copy">
        <span className="game-header-title" title={title}>
          {title}
        </span>
        <div className="game-header-status">{children}</div>
      </div>
    </div>
  );
}
