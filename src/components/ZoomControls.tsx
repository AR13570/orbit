import { MAX_GAMEPLAY_ZOOM, MIN_GAMEPLAY_ZOOM } from "../zoom";
import "./zoom-controls.css";
export default function ZoomControls({
  zoom,
  onIn,
  onOut,
  onReset,
}: {
  zoom: number;
  onIn: () => void;
  onOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="gameplay-zoom-controls" role="group" aria-label="View zoom">
      <button
        className="pause-button"
        aria-label="Zoom in"
        title="Zoom in (+)"
        disabled={zoom >= MAX_GAMEPLAY_ZOOM}
        onClick={onIn}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14M12 5v14" />
        </svg>
      </button>
      <button
        className="pause-button zoom-reset"
        aria-label="Reset zoom"
        title="Reset zoom (0)"
        onClick={onReset}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        className="pause-button"
        aria-label="Zoom out"
        title="Zoom out (-)"
        disabled={zoom <= MIN_GAMEPLAY_ZOOM}
        onClick={onOut}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
