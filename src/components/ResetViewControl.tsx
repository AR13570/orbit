import Icon from "./Icon";

export default function ResetViewControl({
  zoom,
  onReset,
}: {
  zoom: number;
  onReset: () => void;
}) {
  if (Math.abs(zoom - 1) < 0.0001) return null;
  return (
    <button
      className="reset-view-control"
      type="button"
      aria-label="Reset view"
      onClick={onReset}
    >
      <Icon name="frame" />
    </button>
  );
}
